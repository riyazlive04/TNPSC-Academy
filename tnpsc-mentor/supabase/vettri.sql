-- ============================================================================
-- TNPSC Mentors — "Vettri Nichayam" bundle: the 13-exam paid bank (category='vettri')
-- ----------------------------------------------------------------------------
-- Vettri Nichayam is a second paid product (₹999, 90-day) that unlocks THREE
-- things: this fixed 13-exam bank, unlimited PYQ, and unlimited Current Affairs
-- tests. Premium (₹1,699) is a superset and unlocks it too. Entitlement is still
-- computed from the payments ledger (notes.plan = 'vettri_nichayam'); no flag is
-- stored. This file adds only the exam CATALOG + a leak-guard update; the actual
-- questions are loaded later by server/load-vettri-exams.mjs.
--
-- Run AFTER schema.sql + secure.sql + superadmin.sql (needs is_admin()).
-- Idempotent: safe to re-run. Apply with:
--   node run-migration.mjs ../supabase/vettri.sql
-- ============================================================================

-- ─── 1. Allow category = 'vettri' (and repair the out-of-sync constraint) ────
-- The live questions_category_check had drifted: it listed only the original 6
-- categories yet the table already holds mock / pyq2 / testseries rows (added by
-- later migrations that were themselves overwritten). We recreate it with EVERY
-- category currently in use plus 'vettri', so the constraint is honest again and
-- the loader can insert vettri rows. Every listed value already validates, so the
-- ADD scan passes.
alter table public.questions drop constraint if exists questions_category_check;
alter table public.questions add constraint questions_category_check
  check (category in (
    'pyq', 'pyq2', 'samacheer', 'current_affairs', 'aptitude',
    'outer', 'subject', 'mock', 'testseries', 'vettri'
  ));

-- ─── 2. Link a question row to its Vettri exam (1..13) ───────────────────────
alter table public.questions add column if not exists vettri_set integer;
create index if not exists idx_questions_vettri_set
  on public.questions (category, vettri_set);
-- Column-level select grants are used on `questions` to hide answer columns, so a
-- newly added column is NOT readable by `authenticated` until granted — and a
-- `where vettri_set = ...` filter would otherwise be denied.
grant select (vettri_set) on public.questions to authenticated;

-- ─── 3. Vettri-exam catalog ──────────────────────────────────────────────────
-- The whole bank is bundle-gated (no free tier) and attempts are UNLIMITED, so —
-- unlike mock_exams / test_series — there is no `tier` column and no attempts
-- ledger. Gating (premium OR vettri) is enforced server-side at start.
create table if not exists public.vettri_exams (
  id               text primary key,                 -- 'vettri1'..'vettri13'
  vettri_set       integer not null unique,          -- 1..13 (matches questions.vettri_set)
  title            text not null,
  title_ta         text,
  total_questions  integer not null default 100,
  duration_seconds integer not null default 7200,    -- 120 min (adjust per real content)
  negative_mark    numeric  not null default 0,
  enabled          boolean not null default false,   -- flip on once content is loaded
  sort_order       integer not null,
  created_at       timestamptz default now(),
  updated_at       timestamptz default now()
);

-- Seed 13 placeholder exams (disabled). Insert-only: re-runs never clobber admin
-- edits or the counts the loader writes. The loader flips `enabled` per exam.
insert into public.vettri_exams (id, vettri_set, title, title_ta, enabled, sort_order) values
  ('vettri1',  1,  'Vettri Nichayam Test 1',  'வெற்றி நிச்சயம் தேர்வு 1',  false, 1),
  ('vettri2',  2,  'Vettri Nichayam Test 2',  'வெற்றி நிச்சயம் தேர்வு 2',  false, 2),
  ('vettri3',  3,  'Vettri Nichayam Test 3',  'வெற்றி நிச்சயம் தேர்வு 3',  false, 3),
  ('vettri4',  4,  'Vettri Nichayam Test 4',  'வெற்றி நிச்சயம் தேர்வு 4',  false, 4),
  ('vettri5',  5,  'Vettri Nichayam Test 5',  'வெற்றி நிச்சயம் தேர்வு 5',  false, 5),
  ('vettri6',  6,  'Vettri Nichayam Test 6',  'வெற்றி நிச்சயம் தேர்வு 6',  false, 6),
  ('vettri7',  7,  'Vettri Nichayam Test 7',  'வெற்றி நிச்சயம் தேர்வு 7',  false, 7),
  ('vettri8',  8,  'Vettri Nichayam Test 8',  'வெற்றி நிச்சயம் தேர்வு 8',  false, 8),
  ('vettri9',  9,  'Vettri Nichayam Test 9',  'வெற்றி நிச்சயம் தேர்வு 9',  false, 9),
  ('vettri10', 10, 'Vettri Nichayam Test 10', 'வெற்றி நிச்சயம் தேர்வு 10', false, 10),
  ('vettri11', 11, 'Vettri Nichayam Test 11', 'வெற்றி நிச்சயம் தேர்வு 11', false, 11),
  ('vettri12', 12, 'Vettri Nichayam Test 12', 'வெற்றி நிச்சயம் தேர்வு 12', false, 12),
  ('vettri13', 13, 'Vettri Nichayam Test 13', 'வெற்றி நிச்சயம் தேர்வு 13', false, 13)
on conflict (id) do nothing;

-- ─── 4. Row-level security ───────────────────────────────────────────────────
-- Any authenticated user may READ the catalog (the server applies the bundle gate
-- and filters to `enabled`; disabled rows are not secret). No client writes — the
-- superadmin console edits flow through the is_admin()-gated RPC below.
alter table public.vettri_exams enable row level security;
drop policy if exists vettri_exams_select on public.vettri_exams;
create policy vettri_exams_select on public.vettri_exams
  for select to authenticated using (true);

-- ─── 5. Admin write RPC (SECURITY DEFINER + is_admin()) ──────────────────────
-- NULL params leave the column unchanged so the client can patch a single field.
create or replace function public.admin_set_vettri_exam(
  p_id               text,
  p_enabled          boolean default null,
  p_title            text    default null,
  p_total_questions  integer default null,
  p_duration_seconds integer default null,
  p_negative_mark    numeric default null
)
returns public.vettri_exams
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.vettri_exams;
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  update public.vettri_exams set
    enabled          = coalesce(p_enabled, enabled),
    title            = coalesce(p_title, title),
    total_questions  = coalesce(p_total_questions, total_questions),
    duration_seconds = coalesce(p_duration_seconds, duration_seconds),
    negative_mark    = coalesce(p_negative_mark, negative_mark),
    updated_at       = now()
  where id = p_id
  returning * into v_row;

  if v_row.id is null then
    raise exception 'vettri exam % not found', p_id;
  end if;
  return v_row;
end;
$$;

grant execute on function
  public.admin_set_vettri_exam(text, boolean, text, integer, integer, numeric)
  to authenticated;

-- ─── 6. Leak guard: keep category='vettri' out of the general sampler ────────
-- Copied VERBATIM from the live get_quiz_questions / count_quiz_questions (dumped
-- via pg_get_functiondef) with a single line added next to the existing 'mock' /
-- 'testseries' guards: `and q.category <> 'vettri'`. The vettri bank is served
-- ONLY by /api/questions/vettri-exam; without this line a group-exam mock (whose
-- config sets mock=true, scope_to_category=false → no category filter) would pull
-- vettri questions in. Return signatures are unchanged, so `create or replace`
-- is safe (no drop needed).
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
    -- 'vettri' is the fixed paid bank, served only by /api/questions/vettri-exam.
    and q.category <> 'vettri'
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
    -- 'vettri' is the fixed paid bank, served only by /api/questions/vettri-exam.
    and q.category <> 'vettri'
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
    and (cfg.mock or cfg.aptitude_topic is null or q.aptitude_topic = cfg.aptitude_topic);
$$;
