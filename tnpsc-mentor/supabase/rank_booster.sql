-- ============================================================================
-- TNPSC Mentors — Group II/IIA "Rank Booster" (2nd scheduled test series)
-- ----------------------------------------------------------------------------
-- Run AFTER test_series.sql + vettri.sql + superadmin_users_paging.sql (NOT
-- just superadmin_users_v2.sql — prod had already moved past that file to add
-- p_offset/total pagination; §6 below is written against the PAGING shape).
-- Generalizes the single-series `test_series` catalog into a multi-series one
-- (a `series` key), adds the Rank Booster's 10-test catalog under
-- series='g2a_rankbooster', and wires standalone-plan support (grant/revoke/
-- list) for the new 'rank_booster_g2' plan — mirrors Vettri Nichayam's shape.
--
-- Questions themselves stay partitioned by `category` (the proven pattern
-- already used for pyq/pyq2/pyq4/mock/vettri/testseries) rather than adding a
-- `series` column to `questions`: Rank Booster's rows will load under
-- category='testseries_g2'. The catalog table is what gains the series key.
--
-- Live state verified before writing this file (2026-08-18):
--   questions_category_check = pyq, pyq2, pyq4, samacheer, current_affairs,
--     aptitude, outer, subject, mock, testseries, vettri
--   test_series: 17 columns incl. `tier` (NOT NULL, default 'paid'), bare
--     UNIQUE(test_set), no `series` column yet.
--   get_quiz_questions / count_quiz_questions live bodies dumped directly from
--     the DB (via pg_get_functiondef) and reproduced verbatim below with one
--     added line each — do NOT apply supabase/test_series_leak_guard.sql after
--     this file, it is a stale (pre-vettri, pre-year-filter) snapshot.
--
-- Apply with:  node run-migration.mjs ../supabase/rank_booster.sql
-- ============================================================================

-- ─── 1. Allow category = 'testseries_g2' ─────────────────────────────────────
alter table public.questions drop constraint if exists questions_category_check;
alter table public.questions add constraint questions_category_check
  check (category in (
    'pyq', 'pyq2', 'pyq4', 'samacheer', 'current_affairs', 'aptitude', 'outer',
    'subject', 'mock', 'testseries', 'vettri', 'testseries_g2'
  ));

-- ─── 2. Generalize test_series into a multi-series catalog ───────────────────
alter table public.test_series add column if not exists series text;
update public.test_series set series = 'g1_marathon' where series is null;
alter table public.test_series alter column series set not null;
alter table public.test_series alter column series set default 'g1_marathon';

-- test_set was globally unique (1..13); a second series also numbering 1..10
-- would collide under a bare unique constraint. Scope it per series instead.
alter table public.test_series drop constraint if exists test_series_test_set_key;
alter table public.test_series add constraint test_series_series_test_set_key
  unique (series, test_set);

create index if not exists idx_test_series_series on public.test_series (series);

-- ─── 3. Rank Booster catalog: 10 tests, series='g2a_rankbooster' ─────────────
-- Blueprint derived from the supplied papers (100Q each, 75 GS + 25
-- Aptitude/Reasoning per test, matching the real Group 2/2A prelim). Test 1 is
-- free (mirrors the Test Marathon "try before you enroll" hook). Dates seed a
-- weekly cadence starting a week out; every field here is editable later from
-- Superadmin exactly like the Marathon catalog was tuned post-launch.
insert into public.test_series
  (id, series, test_set, title, title_ta, unit_label, unit_label_ta,
   subjects_label, subjects_label_ta,
   total_questions, duration_seconds, scheduled_date, sort_order, tier)
values
  ('g2rb1', 'g2a_rankbooster', 1, 'Test 1', 'தேர்வு 1',
   'General Science & Geography', 'பொது அறிவியல் & புவியியல்',
   'General Science · Geography of India · Aptitude: Simplification',
   'பொது அறிவியல் · இந்திய புவியியல் · எண்ணியல்: எளிமையாக்கல்',
   100, 5400, '2026-08-25', 1, 'free'),
  ('g2rb2', 'g2a_rankbooster', 2, 'Test 2', 'தேர்வு 2',
   'History & INM', 'வரலாறு & தேசிய இயக்கம்',
   'History & Culture of India · Indian National Movement · Aptitude: HCF & LCM',
   'இந்திய வரலாறு & பண்பாடு · இந்திய தேசிய இயக்கம் · எண்ணியல்: மீ.பொ.வ & மீ.பொ.ம',
   100, 5400, '2026-09-01', 2, 'paid'),
  ('g2rb3', 'g2a_rankbooster', 3, 'Test 3', 'தேர்வு 3',
   'Indian Polity', 'இந்திய அரசியலமைப்பு',
   'Indian Polity · Aptitude: Ratio & Proportion, Percentage',
   'இந்திய அரசியலமைப்பு · எண்ணியல்: விகிதம் & விகிதாசாரம், சதவீதம்',
   100, 5400, '2026-09-08', 3, 'paid'),
  ('g2rb4', 'g2a_rankbooster', 4, 'Test 4', 'தேர்வு 4',
   'Economy & TN Admin', 'பொருளாதாரம் & தமிழ்நாடு நிர்வாகம்',
   'Economy & Development Administration in TN · Aptitude: Simple & Compound Interest',
   'பொருளாதாரம் & தமிழ்நாடு வளர்ச்சி நிர்வாகம் · எண்ணியல்: தனி & கூட்டு வட்டி',
   100, 5400, '2026-09-15', 4, 'paid'),
  ('g2rb5', 'g2a_rankbooster', 5, 'Test 5', 'தேர்வு 5',
   'TN History & Culture', 'தமிழ்நாடு வரலாறு & பண்பாடு',
   'TN History, Culture, Heritage & Socio-Political Movements · Aptitude: Area & Volume',
   'தமிழ்நாடு வரலாறு, பண்பாடு, பாரம்பரியம் & சமூக-அரசியல் இயக்கங்கள் · எண்ணியல்: பரப்பளவு & கன அளவு',
   100, 5400, '2026-09-22', 5, 'paid'),
  ('g2rb6', 'g2a_rankbooster', 6, 'Test 6', 'தேர்வு 6',
   'Full Syllabus Review I', 'முழு பாடத்திட்ட மீள்பார்வை I',
   'General Studies (mixed) · Aptitude: Time & Work',
   'பொது அறிவு (கலவை) · எண்ணியல்: வேலை & நேரம்',
   100, 5400, '2026-09-29', 6, 'paid'),
  ('g2rb7', 'g2a_rankbooster', 7, 'Test 7', 'தேர்வு 7',
   'Full Syllabus Review II', 'முழு பாடத்திட்ட மீள்பார்வை II',
   'General Studies (mixed) · Reasoning',
   'பொது அறிவு (கலவை) · தர்க்கப் பகுத்தறிவு',
   100, 5400, '2026-10-06', 7, 'paid'),
  ('g2rb8', 'g2a_rankbooster', 8, 'Test 8', 'தேர்வு 8',
   'Full Mock', 'முழு மாதிரி',
   'General Studies (all subjects) · Aptitude & Reasoning',
   'பொது அறிவு (அனைத்து பாடங்களும்) · எண்ணியல் & தர்க்கப் பகுத்தறிவு',
   100, 5400, '2026-10-13', 8, 'paid'),
  ('g2rb9', 'g2a_rankbooster', 9, 'Test 9', 'தேர்வு 9',
   'Full Mock', 'முழு மாதிரி',
   'General Studies (all subjects) · Aptitude & Reasoning',
   'பொது அறிவு (அனைத்து பாடங்களும்) · எண்ணியல் & தர்க்கப் பகுத்தறிவு',
   100, 5400, '2026-10-20', 9, 'paid'),
  ('g2rb10', 'g2a_rankbooster', 10, 'Test 10', 'தேர்வு 10',
   'Full Mock', 'முழு மாதிரி',
   'General Studies (all subjects) · Aptitude & Reasoning',
   'பொது அறிவு (அனைத்து பாடங்களும்) · எண்ணியல் & தர்க்கப் பகுத்தறிவு',
   100, 5400, '2026-10-27', 10, 'paid')
on conflict (id) do nothing;

-- ─── 4. admin_set_test_series: also allow flipping tier (free/paid) ──────────
-- `tier` already existed as a column but was never exposed to the admin RPC
-- (the one time it mattered — Test Marathon's Test 1 — was flipped via raw
-- SQL). Rank Booster wants the same "Test 1 free" trial, so wire it into the
-- RPC properly this time. Adding a trailing param changes the signature, so
-- CREATE OR REPLACE would leave the old 7-arg version as a second, orphaned
-- overload — drop it first.
drop function if exists public.admin_set_test_series(
  text, boolean, text, date, integer, numeric, text
);
create or replace function public.admin_set_test_series(
  p_id               text,
  p_enabled          boolean default null,
  p_open_override    text    default null,
  p_scheduled_date   date    default null,
  p_duration_seconds integer default null,
  p_negative_mark    numeric default null,
  p_title            text    default null,
  p_tier             text    default null
)
returns public.test_series
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.test_series;
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;
  if p_open_override is not null
     and p_open_override not in ('auto', 'open', 'closed') then
    raise exception 'invalid open_override: %', p_open_override;
  end if;
  if p_tier is not null and p_tier not in ('free', 'paid') then
    raise exception 'invalid tier: %', p_tier;
  end if;

  update public.test_series set
    enabled          = coalesce(p_enabled, enabled),
    open_override    = coalesce(p_open_override, open_override),
    scheduled_date   = coalesce(p_scheduled_date, scheduled_date),
    duration_seconds = coalesce(p_duration_seconds, duration_seconds),
    negative_mark    = coalesce(p_negative_mark, negative_mark),
    title            = coalesce(p_title, title),
    tier             = coalesce(p_tier, tier),
    updated_at       = now()
  where id = p_id
  returning * into v_row;

  if v_row.id is null then
    raise exception 'test series % not found', p_id;
  end if;
  return v_row;
end;
$$;

grant execute on function
  public.admin_set_test_series(text, boolean, text, date, integer, numeric, text, text)
  to authenticated;

-- ─── 5. Leak guard: keep 'testseries_g2' out of the general random sampler ───
-- Reproduced verbatim from the LIVE function bodies (dumped via
-- pg_get_functiondef immediately before writing this file) plus one added
-- line each. Apply this file as the leak-guard source of truth going forward —
-- supabase/test_series_leak_guard.sql is now a stale, pre-vettri snapshot.
create or replace function public.get_quiz_questions(p_config jsonb)
returns table (
  id uuid, category text, group_type text, year integer, standard integer,
  ca_month text, ca_year integer, ca_type text, ca_topic text,
  aptitude_type text, aptitude_topic text, subject text, topic text,
  question_type text, external_id text,
  question_text text, option_a text, option_b text, option_c text, option_d text,
  difficulty text, images jsonb, source_tag text,
  question_text_ta text, option_a_ta text, option_b_ta text,
  option_c_ta text, option_d_ta text
)
language sql
security definer
stable
set search_path = public
as $$
  with cfg as (
    select
      p_config->>'category'                            as category,
      p_config->>'subject'                             as subject,
      (p_config->>'standard')::int                     as standard,
      p_config->>'topic'                               as topic,
      p_config->>'unit'                                as unit,
      p_config->>'question_type'                       as question_type,
      p_config->>'ca_type'                             as ca_type,
      p_config->>'ca_month'                            as ca_month,
      p_config->>'ca_topic'                            as ca_topic,
      p_config->>'aptitude_type'                       as aptitude_type,
      p_config->>'aptitude_topic'                      as aptitude_topic,
      (p_config->>'year')::int                         as year,
      coalesce((p_config->>'mock')::boolean, false)    as mock,
      coalesce((p_config->>'scopeToCategory')::boolean, false) as scope_to_category,
      case when p_config ? 'exclude_ids'
        then array(select (jsonb_array_elements_text(p_config->'exclude_ids'))::uuid)
        else null end                                  as exclude_ids,
      greatest(coalesce((p_config->>'limit')::int, 100), 1)    as lim
  )
  select q.id, q.category, q.group_type, q.year, q.standard,
         q.ca_month, q.ca_year, q.ca_type, q.ca_topic,
         q.aptitude_type, q.aptitude_topic, q.subject, q.topic,
         q.question_type, q.external_id,
         q.question_text, q.option_a, q.option_b, q.option_c, q.option_d,
         q.difficulty, q.images, q.source_tag,
         q.question_text_ta, q.option_a_ta, q.option_b_ta,
         q.option_c_ta, q.option_d_ta
  from public.questions q
  cross join cfg
  left join public.seen_questions sq
    on sq.question_id = q.id and sq.user_id = auth.uid()
  where
    q.active
    and (q.category <> 'outer' or cfg.category = 'outer')
    and q.category <> 'mock'
    and q.category <> 'testseries'
    and q.category <> 'vettri'
    -- Rank Booster is the second fixed, scheduled bank (served only by
    -- /api/questions/test-series?series=g2a_rankbooster) — same reasoning as
    -- the 'testseries'/'vettri' guards above.
    and q.category <> 'testseries_g2'
    and case when cfg.mock
      then (not cfg.scope_to_category or q.category = cfg.category)
      else q.category = cfg.category
    end
    and (cfg.mock or cfg.subject        is null or q.subject        = cfg.subject)
    and (cfg.mock or cfg.standard       is null or q.standard       = cfg.standard)
    and (cfg.mock or cfg.topic          is null or q.topic          = cfg.topic)
    and (cfg.mock or cfg.unit           is null or q.unit           = cfg.unit)
    and (cfg.mock or cfg.question_type  is null or q.question_type  = cfg.question_type)
    and (cfg.mock or cfg.ca_type        is null or q.ca_type        = cfg.ca_type)
    and (cfg.mock or cfg.ca_month       is null or q.ca_month       = cfg.ca_month)
    and (cfg.mock or cfg.ca_topic       is null or q.ca_topic       = cfg.ca_topic)
    and (cfg.mock or cfg.aptitude_type  is null or q.aptitude_type  = cfg.aptitude_type)
    and (cfg.mock or cfg.aptitude_topic is null or q.aptitude_topic = cfg.aptitude_topic)
    and (cfg.mock or cfg.year           is null or q.year           = cfg.year)
    and (cfg.exclude_ids is null or not (q.id = any(cfg.exclude_ids)))
  order by (sq.question_id is not null), sq.seen_at asc nulls first, random()
  limit (select lim from cfg);
$$;

create or replace function public.count_quiz_questions(p_config jsonb)
returns integer
language sql
security definer
stable
set search_path = public
as $$
  with cfg as (
    select
      p_config->>'category'                            as category,
      p_config->>'subject'                             as subject,
      (p_config->>'standard')::int                     as standard,
      p_config->>'topic'                               as topic,
      p_config->>'unit'                                as unit,
      p_config->>'question_type'                       as question_type,
      p_config->>'ca_type'                             as ca_type,
      p_config->>'ca_month'                            as ca_month,
      p_config->>'ca_topic'                            as ca_topic,
      p_config->>'aptitude_type'                       as aptitude_type,
      p_config->>'aptitude_topic'                      as aptitude_topic,
      (p_config->>'year')::int                         as year,
      coalesce((p_config->>'mock')::boolean, false)    as mock,
      coalesce((p_config->>'scopeToCategory')::boolean, false) as scope_to_category
  )
  select count(*)::int
  from public.questions q, cfg
  where
    q.active
    and (q.category <> 'outer' or cfg.category = 'outer')
    and q.category <> 'mock'
    and q.category <> 'testseries'
    and q.category <> 'vettri'
    and q.category <> 'testseries_g2'
    and case when cfg.mock
      then (not cfg.scope_to_category or q.category = cfg.category)
      else q.category = cfg.category
    end
    and (cfg.mock or cfg.subject        is null or q.subject        = cfg.subject)
    and (cfg.mock or cfg.standard       is null or q.standard       = cfg.standard)
    and (cfg.mock or cfg.topic          is null or q.topic          = cfg.topic)
    and (cfg.mock or cfg.unit           is null or q.unit           = cfg.unit)
    and (cfg.mock or cfg.question_type  is null or q.question_type  = cfg.question_type)
    and (cfg.mock or cfg.ca_type        is null or q.ca_type        = cfg.ca_type)
    and (cfg.mock or cfg.ca_month       is null or q.ca_month       = cfg.ca_month)
    and (cfg.mock or cfg.ca_topic       is null or q.ca_topic       = cfg.ca_topic)
    and (cfg.mock or cfg.aptitude_type  is null or q.aptitude_type  = cfg.aptitude_type)
    and (cfg.mock or cfg.aptitude_topic is null or q.aptitude_topic = cfg.aptitude_topic)
    and (cfg.mock or cfg.year           is null or q.year           = cfg.year);
$$;

-- ─── 6. Standalone plan support: grant / revoke / list (mirrors Vettri) ──────
-- Base shape is supabase/superadmin_users_paging.sql (3-arg, with a `total`
-- window column for pagination) — NOT the older superadmin_users_v2.sql
-- 2-arg shape. Both signatures are dropped first so a partial-apply re-run
-- stays clean, matching that file's own convention.
drop function if exists public.superadmin_list_users(int, text);
drop function if exists public.superadmin_list_users(int, text, int);

create or replace function public.superadmin_list_users(
  p_limit int default 200,
  p_search text default null,
  p_offset int default 0
)
returns table (
  id uuid,
  full_name text,
  email text,
  phone text,
  target_group text,
  avatar_url text,
  role text,
  created_at timestamptz,
  tests_taken bigint,
  last_active date,
  premium boolean,
  premium_until timestamptz,
  vettri boolean,
  vettri_until timestamptz,
  rank_booster boolean,
  rank_booster_until timestamptz,
  total bigint
)
language plpgsql
security definer
stable
set search_path = public
as $$
begin
  if not public.is_superadmin() then
    raise exception 'not authorized';
  end if;

  return query
  select
    p.id,
    p.full_name,
    p.email,
    p.phone,
    p.target_group,
    p.avatar_url,
    p.role,
    p.created_at,
    (select count(*) from public.test_sessions ts
       where ts.user_id = p.id and ts.status = 'completed') as tests_taken,
    (select max(da.activity_date) from public.daily_activity da
       where da.user_id = p.id) as last_active,
    pay.latest_paid is not null as premium,
    (pay.latest_paid + interval '90 days') as premium_until,
    (vet.vettri_end is not null) as vettri,
    vet.vettri_end as vettri_until,
    (rb.rb_end is not null) as rank_booster,
    rb.rb_end as rank_booster_until,
    -- Window functions run before LIMIT/OFFSET, so this is the size of the
    -- whole filtered set, not of the page.
    count(*) over () as total
  from public.profiles p
  left join lateral (
    select max(pm.created_at) as latest_paid
    from public.payments pm
    where pm.user_id = p.id
      and pm.status = 'paid'
      and pm.notes->>'plan' = 'premium_annual'
      and pm.created_at >= now() - interval '90 days'
  ) pay on true
  left join lateral (
    -- Later of the two plans' own expiries, NULL when neither is active
    -- (mirrors bundleAccess: each plan bounded by its OWN validity window).
    select max(pm.created_at + case pm.notes->>'plan'
             when 'vettri_nichayam' then interval '60 days'
             else interval '30 days'
           end) as vettri_end
    from public.payments pm
    where pm.user_id = p.id
      and pm.status = 'paid'
      and (
        (pm.notes->>'plan' = 'vettri_nichayam' and pm.created_at >= now() - interval '60 days')
        or (pm.notes->>'plan' = 'vettri_month' and pm.created_at >= now() - interval '30 days')
      )
  ) vet on true
  left join lateral (
    select max(pm.created_at) + interval '30 days' as rb_end
    from public.payments pm
    where pm.user_id = p.id
      and pm.status = 'paid'
      and pm.notes->>'plan' = 'rank_booster_g2'
      and pm.created_at >= now() - interval '30 days'
  ) rb on true
  where p_search is null
     or p.full_name ilike '%' || p_search || '%'
     or p.email ilike '%' || p_search || '%'
  -- created_at is not unique enough on its own to page deterministically (bulk
  -- signups share a timestamp), so id breaks the tie - without it a row could
  -- appear on two pages or on none.
  order by p.created_at desc, p.id
  limit greatest(1, least(p_limit, 1000))
  offset greatest(0, coalesce(p_offset, 0));
end;
$$;

grant execute on function public.superadmin_list_users(int, text, int) to authenticated;

-- Revoke Rank Booster (mirrors superadmin_revoke_vettri).
create or replace function public.superadmin_revoke_rank_booster(p_user uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  if not public.is_superadmin() then
    raise exception 'not authorized';
  end if;

  if not exists (select 1 from public.profiles where id = p_user) then
    raise exception 'user not found';
  end if;

  update public.payments
    set status = 'revoked'
    where user_id = p_user and status = 'paid'
      and notes->>'plan' = 'rank_booster_g2';
  get diagnostics v_count = row_count;

  return v_count;
end;
$$;

grant execute on function public.superadmin_revoke_rank_booster(uuid) to authenticated;

-- Allow comping the new plan through the existing grant RPC.
create or replace function public.superadmin_grant_plan(p_user uuid, p_plan text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if not public.is_superadmin() then
    raise exception 'not authorized';
  end if;

  if p_plan not in ('premium_annual', 'vettri_nichayam', 'vettri_month', 'rank_booster_g2') then
    raise exception 'unknown plan: %', p_plan;
  end if;

  if not exists (select 1 from public.profiles where id = p_user) then
    raise exception 'user not found';
  end if;

  insert into public.payments (user_id, razorpay_order_id, amount, currency, receipt, notes, status)
  values (
    p_user,
    'comp_' || replace(gen_random_uuid()::text, '-', ''),
    0,
    'INR',
    'superadmin comp',
    jsonb_build_object('plan', p_plan, 'comp', true, 'granted_by', auth.uid()),
    'paid'
  )
  returning payments.id into v_id;

  return v_id;
end;
$$;

grant execute on function public.superadmin_grant_plan(uuid, text) to authenticated;
