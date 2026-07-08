-- ============================================================================
-- TNPSC Mentors — Superadmin per-user insights (activity, weakness, credits)
-- ----------------------------------------------------------------------------
-- One read-only RPC behind the console's user-detail popup: how much the user
-- studies (tests, questions, time, 7/30-day recency), WHAT they practise
-- (per-subject + per-section breakdown with accuracy, so weak areas stand
-- out), and their credit economy (live balance, today's expiring remainder,
-- lifetime spent/expired/granted from the ledger).
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

  return jsonb_build_object(
    'totals',     v_totals,
    'subjects',   v_subjects,
    'categories', v_categories,
    'credits',    v_credits
  );
end;
$$;

grant execute on function public.superadmin_user_insights(uuid) to authenticated;
