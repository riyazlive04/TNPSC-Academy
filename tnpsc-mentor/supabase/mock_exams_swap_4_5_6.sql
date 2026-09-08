-- ============================================================================
-- TNPSC Mentors — swap: new Group 1 papers into 4/5/6, old ones up to 7/8/9
-- ----------------------------------------------------------------------------
-- Run AFTER mock_exams.sql. The three papers authored in parser/Group1/mock
-- (mock01/02/03) take slots 4/5/6. The papers currently there — loaded with the
-- original six-paper set but never enabled — move up to 7/8/9 and are kept.
--
-- NOTHING IS DELETED. The displaced questions are UPDATED in place, so each row
-- keeps its `id` and every bookmark, SRS card, seen-questions entry and recorded
-- answer that references it stays valid and simply follows the question to its
-- new exam. That is the whole reason this is a move and not a delete+reload.
--
-- Afterwards six exams are visible where three were before:
--   exam1-3  unchanged
--   exam4-6  the new papers (statement-evaluation / assertion-reason, every
--            option explained in both languages) — ENABLED
--   exam7-9  the previous exam4/5/6 content — kept, but left HIDDEN as it has
--            always been. It is the weakest material in the bank (up to 81% of
--            answers on option A, and options are never shuffled at serve
--            time), so it stays parked until it is worth showing. Switch it on
--            from the superadmin Mock Exams tab.
--
-- server/load-group1-mocks{,-studio}.mjs performs all of this; this file is the
-- manual equivalent. Run the steps in order.
-- ============================================================================

-- ─── 1. Pre-flight (RUN FIRST — all four must be 0) ──────────────────────────
-- Destination slots must be empty, no attempt may exist against exam4/5/6
-- (those ids stay but come to serve different content, so an attempt would be
-- silently reattributed), and no M7-/M8-/M9- external_id may already be taken.
--
--   select (select count(*) from public.questions
--            where category='mock' and mock_set in (7,8,9))          as occupying_destination,
--          (select count(*) from public.mock_exam_attempts
--            where exam_id in ('exam4','exam5','exam6'))             as attempts_on_reused_exams,
--          (select count(*) from public.questions
--            where external_id ~ '^M[789]-')                         as ids_blocking_rename;

-- ─── 2. Move the displaced papers 4/5/6 → 7/8/9 ──────────────────────────────
-- external_id is renamed in the SAME statement: it carries a UNIQUE index and
-- the incoming papers claim M4-/M5-/M6-, so the outgoing ids must step aside.
-- The section suffix is preserved (M4-GS-001 → M7-GS-001, M6-REA-010 →
-- M9-REA-010); every existing id matches ^M[456]-. `mock_set + 3` on the right
-- reads the pre-update value, so both columns move together.
--
--   update public.questions
--      set mock_set    = mock_set + 3,
--          external_id = regexp_replace(external_id, '^M[456]-', 'M' || (mock_set + 3) || '-')
--    where category = 'mock' and mock_set in (4,5,6);
--
-- Confirm the slots are now empty before loading into them:
--   select count(*) from public.questions where category='mock' and mock_set in (4,5,6);  -- 0

-- ─── 3. Load the new papers into 4/5/6 ───────────────────────────────────────
--   STUDIO_USER=… STUDIO_PASSWORD=… node server/load-group1-mocks-studio.mjs

-- ─── 4. Catalog rows for the displaced papers ────────────────────────────────
-- exam4/5/6 keep their mock_set and so serve the new papers with no change.
-- These arrive DISABLED: the content has never been visible and moving it to a
-- new slot number is not a reason to expose it. Insert-only, so a re-run never
-- clobbers a tier or enabled edited from the console.
insert into public.mock_exams (id, mock_set, title, title_ta, tier, enabled, sort_order) values
  ('exam7', 7, 'Full Mock Exam 7', 'முழு மாதிரித் தேர்வு 7', 'paid', false, 7),
  ('exam8', 8, 'Full Mock Exam 8', 'முழு மாதிரித் தேர்வு 8', 'paid', false, 8),
  ('exam9', 9, 'Full Mock Exam 9', 'முழு மாதிரித் தேர்வு 9', 'paid', false, 9)
on conflict (id) do nothing;

-- ─── 5. Enable the new papers only ───────────────────────────────────────────
-- Guarded on the question count: an enabled exam whose paper is short would
-- serve a partial test and charge credits for it.
update public.mock_exams e
   set enabled = true, updated_at = now()
 where e.id in ('exam4', 'exam5', 'exam6')
   and (select count(*) from public.questions q
         where q.category = 'mock' and q.mock_set = e.mock_set) = e.total_questions;

-- To show the parked papers later (check their answer-key balance first):
--   update public.mock_exams set enabled = true, updated_at = now()
--    where id in ('exam7', 'exam8', 'exam9');

-- ─── 6. Exactly one free mock ────────────────────────────────────────────────
-- `tier` is independent of `enabled`: enabled decides whether an exam is listed,
-- tier decides whether opening it needs a paid plan. Only exam1 may be free —
-- the catalog is editable from the superadmin console and had drifted, leaving a
-- second exam open to everyone. Idempotent; touches only rows that are wrong.
update public.mock_exams
   set tier = case when id = 'exam1' then 'free' else 'paid' end,
       updated_at = now()
 where tier is distinct from (case when id = 'exam1' then 'free' else 'paid' end);

-- ─── Verification ────────────────────────────────────────────────────────────
-- Nine rows, every enabled one showing questions = total_questions.
--
--   select e.id, e.mock_set, e.tier, e.enabled, e.total_questions,
--          (select count(*) from public.questions q
--            where q.category='mock' and q.mock_set = e.mock_set) as questions
--     from public.mock_exams e order by e.sort_order;

-- ─── Undo the move (before step 3 only) ──────────────────────────────────────
--   update public.questions
--      set mock_set    = mock_set - 3,
--          external_id = regexp_replace(external_id, '^M[789]-', 'M' || (mock_set - 3) || '-')
--    where category = 'mock' and mock_set in (7,8,9);
