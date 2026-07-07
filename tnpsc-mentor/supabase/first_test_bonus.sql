-- ─── First-test activation funnel ────────────────────────────────────────────
-- New users sign up but never take a test. This migration backs the funnel that
-- fixes it:
--   • starter_test_questions() — the "Starter Challenge" paper: a fixed-shape
--     HARD mixed test (3 questions of each Subject-bank style — statements,
--     match, assertion-reason, chronological, direct — plus 3 aptitude = 18).
--     Hard-first sampling per slot; backfills medium/easy only when a style's
--     hard pool is thinner than the slot (aptitude has no hard rows today).
--   • grant_first_test_bonus() — +N credits, once ever, the moment the user's
--     FIRST completed test is graded (called from POST /api/tests/submit).
--   • widens credit_transactions.kind with 'bonus' for the ledger row.
-- Idempotent: safe to re-run.
--
-- Apply with:  node run-migration.mjs ../supabase/first_test_bonus.sql

-- 1. Ledger kind for one-off reward credits (signup/daily/spend/… + 'bonus').
alter table public.credit_transactions drop constraint if exists credit_transactions_kind_check;
alter table public.credit_transactions add constraint credit_transactions_kind_check
  check (kind in ('signup','daily','spend','backfill','admin','expire','bonus'));

-- 2. One-time reward for the user's first COMPLETED test. Guards:
--    • only after exactly one completed session exists (the grader inserts the
--      session before this runs, so "first test" ⇒ count = 1 — veterans whose
--      history predates this feature are never retro-granted), and
--    • only once ever (the ledger row is the idempotency record).
--    Safe to expose to authenticated: calling it directly can't mint anything
--    a legitimate first submit wouldn't. Bonus credits are permanent (they do
--    NOT touch daily_left, so end-of-day expiry never claws them back).
create or replace function public.grant_first_test_bonus(p_amount integer)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_bal integer;
begin
  if auth.uid() is null or p_amount is null or p_amount <= 0 then
    return jsonb_build_object('granted', false, 'balance', 0);
  end if;
  -- Row lock so two concurrent submits can't double-grant.
  select credits into v_bal from public.profiles where id = auth.uid() for update;
  if v_bal is null then
    return jsonb_build_object('granted', false, 'balance', 0);
  end if;
  if exists (
    select 1 from public.credit_transactions
    where user_id = auth.uid() and kind = 'bonus' and reason = 'first_test'
  ) then
    return jsonb_build_object('granted', false, 'balance', v_bal);
  end if;
  if (select count(*) from public.test_sessions
      where user_id = auth.uid() and status = 'completed') <> 1 then
    return jsonb_build_object('granted', false, 'balance', v_bal);
  end if;
  update public.profiles set credits = credits + p_amount where id = auth.uid()
    returning credits into v_bal;
  insert into public.credit_transactions (user_id, amount, kind, reason)
    values (auth.uid(), p_amount, 'bonus', 'first_test');
  return jsonb_build_object('granted', true, 'balance', v_bal);
end;
$$;

grant execute on function public.grant_first_test_bonus(integer) to authenticated;

-- 3. The Starter Challenge paper. Returns ONLY the safe quiz columns (same shape
--    the /quiz sampler serves — answers/explanations never leave the function).
--    Each slot orders hard-first then random, so the paper is as hard as the
--    bank allows while still always filling. Served by
--    POST /api/questions/starter-test, which charges credits at start.
create or replace function public.starter_test_questions()
returns table (
  id uuid, category text, group_type text, year integer, standard integer,
  ca_month text, ca_year integer, ca_type text, ca_topic text,
  aptitude_type text, aptitude_topic text, subject text, topic text,
  question_type text, external_id text,
  question_text text, option_a text, option_b text, option_c text, option_d text,
  option_e text, difficulty text, images jsonb, source_tag text,
  question_text_ta text, option_a_ta text, option_b_ta text,
  option_c_ta text, option_d_ta text, option_e_ta text
)
language sql
security definer
stable
set search_path = public
as $$
  with picks as (
    (select q.* from public.questions q
      where q.active and q.category = 'subject' and q.question_type = 'statements'
      order by (q.difficulty = 'hard') desc, random() limit 3)
    union all
    (select q.* from public.questions q
      where q.active and q.category = 'subject' and q.question_type = 'match'
      order by (q.difficulty = 'hard') desc, random() limit 3)
    union all
    (select q.* from public.questions q
      where q.active and q.category = 'subject' and q.question_type = 'assertion_reason'
      order by (q.difficulty = 'hard') desc, random() limit 3)
    union all
    (select q.* from public.questions q
      where q.active and q.category = 'subject' and q.question_type = 'chronological'
      order by (q.difficulty = 'hard') desc, random() limit 3)
    union all
    (select q.* from public.questions q
      where q.active and q.category = 'subject' and q.question_type = 'direct'
      order by (q.difficulty = 'hard') desc, random() limit 3)
    union all
    (select q.* from public.questions q
      where q.active and q.category = 'aptitude'
      order by (q.difficulty = 'hard') desc, random() limit 3)
  )
  select p.id, p.category, p.group_type, p.year, p.standard,
         p.ca_month, p.ca_year, p.ca_type, p.ca_topic,
         p.aptitude_type, p.aptitude_topic, p.subject, p.topic,
         p.question_type, p.external_id,
         p.question_text, p.option_a, p.option_b, p.option_c, p.option_d,
         p.option_e, p.difficulty, p.images, p.source_tag,
         p.question_text_ta, p.option_a_ta, p.option_b_ta,
         p.option_c_ta, p.option_d_ta, p.option_e_ta
  from picks p;
$$;

grant execute on function public.starter_test_questions() to authenticated;
