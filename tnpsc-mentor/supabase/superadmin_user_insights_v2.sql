-- ============================================================================
-- TNPSC Mentors — Superadmin per-user insights v2: + `targeting` object
-- ----------------------------------------------------------------------------
-- Supersedes superadmin_user_insights.sql (keep future edits HERE). Same RPC,
-- same shape as v1 (totals/subjects/categories/credits) plus one new
-- `targeting` object with everything the console needs to segment and reach a
-- user: UI language, gender, exam date, daily goal, streak + 30-day activity,
-- last login, devices (from the session ledger), Web-Push reachability,
-- payment history, and content-engagement counts (feedback, reports,
-- bookmarks, revision backlog, seen questions).
-- is_superadmin()-gated SECURITY DEFINER. Idempotent / re-runnable.
-- ============================================================================

create or replace function public.superadmin_user_insights(p_user uuid)
returns jsonb
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v_totals     jsonb;
  v_subjects   jsonb;
  v_categories jsonb;
  v_credits    jsonb;
  v_targeting  jsonb;
  v_today      date;
  v_anchor     date;
  v_streak     int := 0;
begin
  if not public.is_superadmin() then
    raise exception 'not authorized';
  end if;

  if not exists (select 1 from public.profiles where id = p_user) then
    raise exception 'user not found';
  end if;

  -- Overall study volume + engagement recency.
  select jsonb_build_object(
    'tests',        count(*),
    'questions',    coalesce(sum(ts.attempted), 0),
    'correct',      coalesce(sum(ts.correct), 0),
    'accuracy',     round(100.0 * sum(ts.correct) / nullif(sum(ts.attempted), 0), 1),
    'time_seconds', coalesce(sum(ts.time_taken_seconds), 0),
    'tests_7d',     count(*) filter (where ts.completed_at >= now() - interval '7 days'),
    'tests_30d',    count(*) filter (where ts.completed_at >= now() - interval '30 days'),
    'last_test_at', max(ts.completed_at)
  )
  into v_totals
  from public.test_sessions ts
  where ts.user_id = p_user and ts.status = 'completed';

  -- Per-subject practice + accuracy (the weakness signal). Subject-less
  -- sessions (current affairs, mock papers, aptitude drills…) are covered by
  -- the per-section breakdown below instead.
  select coalesce(jsonb_agg(jsonb_build_object(
           'subject',      s.subject,
           'tests',        s.tests,
           'questions',    s.questions,
           'accuracy',     s.accuracy,
           'time_seconds', s.time_seconds
         ) order by s.tests desc, s.subject), '[]'::jsonb)
  into v_subjects
  from (
    select ts.subject,
           count(*)                       as tests,
           coalesce(sum(ts.attempted), 0) as questions,
           round(100.0 * sum(ts.correct) / nullif(sum(ts.attempted), 0), 1) as accuracy,
           coalesce(sum(ts.time_taken_seconds), 0) as time_seconds
    from public.test_sessions ts
    where ts.user_id = p_user and ts.status = 'completed' and ts.subject is not null
    group by ts.subject
  ) s;

  -- Per-section (category) breakdown: which parts of the app they live in.
  select coalesce(jsonb_agg(jsonb_build_object(
           'category',  c.category,
           'tests',     c.tests,
           'questions', c.questions,
           'accuracy',  c.accuracy
         ) order by c.tests desc, c.category), '[]'::jsonb)
  into v_categories
  from (
    select ts.category,
           count(*)                       as tests,
           coalesce(sum(ts.attempted), 0) as questions,
           round(100.0 * sum(ts.correct) / nullif(sum(ts.attempted), 0), 1) as accuracy
    from public.test_sessions ts
    where ts.user_id = p_user and ts.status = 'completed'
    group by ts.category
  ) c;

  -- Credit economy: live balance + today's expiring remainder on the profile,
  -- lifetime spent/expired/granted from the append-only ledger.
  select jsonb_build_object(
    'balance',    p.credits,
    'daily_left', p.daily_left,
    'spent',   coalesce((select -sum(ct.amount) from public.credit_transactions ct
                         where ct.user_id = p_user and ct.kind = 'spend'), 0),
    'expired', coalesce((select -sum(ct.amount) from public.credit_transactions ct
                         where ct.user_id = p_user and ct.kind = 'expire'), 0),
    'granted', coalesce((select sum(ct.amount) from public.credit_transactions ct
                         where ct.user_id = p_user and ct.amount > 0), 0)
  )
  into v_credits
  from public.profiles p
  where p.id = p_user;

  -- Current streak in IST (mirrors the app's streak: consecutive active days
  -- anchored on today, or yesterday when today has no activity yet).
  v_today := (now() at time zone 'Asia/Kolkata')::date;
  select max(da.activity_date) into v_anchor
  from public.daily_activity da
  where da.user_id = p_user and da.activity_date in (v_today, v_today - 1);
  if v_anchor is not null then
    select count(*) into v_streak
    from (
      select d.activity_date,
             row_number() over (order by d.activity_date desc) as rn
      from (select distinct da.activity_date
            from public.daily_activity da
            where da.user_id = p_user and da.activity_date <= v_anchor) d
    ) r
    where r.activity_date = v_anchor - (r.rn - 1)::int;
  end if;

  -- Everything the console needs to SEGMENT and REACH this user.
  select jsonb_build_object(
    'language',       p.language,                      -- 'en' | 'ta' | 'both' | null
    'gender',         p.gender,
    'exam_date',      p.exam_date,
    'daily_goal',     p.daily_goal,
    'signup_at',      p.created_at,
    'streak',         v_streak,
    'active_days_30d',
      (select count(distinct da.activity_date) from public.daily_activity da
        where da.user_id = p_user and da.activity_date >= v_today - 29),
    'last_login_at',
      (select max(us.last_seen_at) from public.user_sessions us
        where us.user_id = p_user),
    'devices',
      (select coalesce(jsonb_agg(jsonb_build_object(
                'label',        us.label,
                'last_seen_at', us.last_seen_at
              ) order by us.last_seen_at desc), '[]'::jsonb)
       from public.user_sessions us
       where us.user_id = p_user and us.revoked_at is null),
    'push_devices',                                    -- Web-Push reachability
      (select count(*) from public.push_subscriptions ps where ps.user_id = p_user),
    'payments', (
      select jsonb_build_object(
        'orders',        count(*) filter (where pm.amount > 0),
        'lifetime_rupees', coalesce(sum(pm.amount), 0) / 100,
        'last_plan',     (select p2.notes->>'plan' from public.payments p2
                           where p2.user_id = p_user and p2.status = 'paid'
                           order by p2.created_at desc limit 1),
        'last_paid_at',  max(pm.created_at)
      )
      from public.payments pm
      where pm.user_id = p_user and pm.status = 'paid'
    ),
    'feedback_count',
      (select count(*) from public.app_feedback f where f.user_id = p_user),
    'report_count',
      (select count(*) from public.question_reports qr where qr.user_id = p_user),
    'bookmark_count',
      (select count(*) from public.bookmarks b where b.user_id = p_user),
    'revision_pending',                                -- weak topics awaiting a re-test
      (select count(*) from public.revision_topics rt
        where rt.user_id = p_user and rt.cleared_at is null),
    'seen_questions',
      (select count(*) from public.seen_questions sq where sq.user_id = p_user)
  )
  into v_targeting
  from public.profiles p
  where p.id = p_user;

  return jsonb_build_object(
    'totals',     v_totals,
    'subjects',   v_subjects,
    'categories', v_categories,
    'credits',    v_credits,
    'targeting',  v_targeting
  );
end;
$$;

grant execute on function public.superadmin_user_insights(uuid) to authenticated;
