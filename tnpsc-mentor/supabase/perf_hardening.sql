-- ============================================================================
-- TNPSC Mentors — Performance hardening: RLS initplan fix + missing FK indexes
-- ----------------------------------------------------------------------------
-- Run AFTER every other file in this directory (it only ALTERs policies/funcs
-- that already exist and adds indexes — nothing here creates a table).
--   node run-migration.mjs ../supabase/perf_hardening.sql
--
-- Part 1 — auth.uid() / is_admin() / is_superadmin() re-evaluate PER ROW inside
-- an RLS policy unless wrapped in a scalar subquery, e.g. `(select auth.uid())`.
-- Wrapping turns it into a Postgres initplan: evaluated ONCE per query instead
-- of once per row scanned. This is the standard Supabase/Postgres RLS
-- performance fix (see "Performance Advisor: auth_rls_initplan"). Every policy
-- touched here keeps its exact original semantics — only the evaluation
-- strategy changes — so this is safe to apply without an access-control review.
-- ALTER POLICY is used (not DROP+CREATE) so a policy is never briefly absent.
--
-- Part 2 — Postgres never auto-indexes foreign-key columns. The four busiest
-- per-question ledgers (test_answers, review_items, bookmarks, seen_questions)
-- and two attempt tables' session_id FK were missing indexes, which forces a
-- full seq-scan of those tables on every `questions`/`test_sessions` delete or
-- cascade. Also adds the composite filter index for category='pyq2' that every
-- other category (pyq4, subject, ca, mock, testseries, vettri) already has.
-- Idempotent.
-- ============================================================================

-- ─── Part 1: wrap auth.uid()/is_admin()/is_superadmin() as scalar subqueries ──

-- Role-helper functions first — every "is_admin()"/"is_superadmin()" policy
-- below inherits this fix automatically once these are wrapped internally.
create or replace function public.is_admin()
returns boolean as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role in ('admin', 'superadmin')
  );
$$ language sql security definer stable;

create or replace function public.is_superadmin()
returns boolean as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'superadmin'
  );
$$ language sql security definer stable;

alter policy "Users can manage own activity" on public.daily_activity
  using ((select auth.uid()) = user_id);

alter policy "Users can manage own review items" on public.review_items
  using ((select auth.uid()) = user_id);

alter policy "manage own seen_questions" on public.seen_questions
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

alter policy "Admins manage questions" on public.questions
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

alter policy "Users can manage own sessions" on public.test_sessions
  using ((select auth.uid()) = user_id);

alter policy "Users can manage own answers" on public.test_answers
  using (session_id in (
    select id from public.test_sessions where user_id = (select auth.uid())
  ));

alter policy "Users can read own profile" on public.profiles
  using ((select auth.uid()) = id);

alter policy "Users can insert own profile" on public.profiles
  with check ((select auth.uid()) = id and role = 'user');

alter policy "Users can update own profile" on public.profiles
  using ((select auth.uid()) = id)
  with check (
    (select auth.uid()) = id
    and role is not distinct from (select p.role from public.profiles p where p.id = (select auth.uid()))
  );

alter policy "Users submit own feedback" on public.app_feedback
  with check ((select auth.uid()) = user_id);

alter policy "Users read own feedback" on public.app_feedback
  using ((select auth.uid()) = user_id);

alter policy "Superadmins read all feedback" on public.app_feedback
  using ((select public.is_superadmin()));

alter policy "Users manage own alert dismissals" on public.alert_dismissals
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

alter policy "Users manage own bookmarks" on public.bookmarks
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

alter policy credit_tx_own_select on public.credit_transactions
  using ((select auth.uid()) = user_id);

alter policy "manage own explanation_feedback" on public.explanation_feedback
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

alter policy "superadmin read explanation_feedback" on public.explanation_feedback
  using ((select public.is_superadmin()));

alter policy free_test_usage_select on public.free_test_usage
  using (user_id = (select auth.uid()));

alter policy mock_exam_attempts_select on public.mock_exam_attempts
  using (user_id = (select auth.uid()));

alter policy mock_exam_attempts_insert on public.mock_exam_attempts
  with check (user_id = (select auth.uid()));

alter policy "Users read own push devices" on public.push_devices
  using (user_id = (select auth.uid()));

alter policy "Users manage own push subs" on public.push_subscriptions
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

alter policy "Users manage own reads" on public.notification_reads
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

alter policy "Users read own payments" on public.payments
  using ((select auth.uid()) = user_id);

alter policy "manage own question_reports" on public.question_reports
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

alter policy "admin read question_reports" on public.question_reports
  using ((select public.is_admin()) or (select public.is_superadmin()));

alter policy "admin manage report status" on public.question_report_status
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

alter policy "manage own revision_topics" on public.revision_topics
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

alter policy test_series_attempts_select on public.test_series_attempts
  using (user_id = (select auth.uid()));

alter policy test_series_attempts_insert on public.test_series_attempts
  with check (user_id = (select auth.uid()));

alter policy user_sessions_self_select on public.user_sessions
  using ((select auth.uid()) = user_id);

alter policy "superadmin read audit_log" on public.audit_log
  using ((select public.is_superadmin()));

-- ─── Part 2: missing indexes ───────────────────────────────────────────────

-- FK columns with no supporting index — each forces a seq-scan of the child
-- table on delete/update of the parent row (questions / test_sessions).
create index if not exists idx_test_answers_question on public.test_answers(question_id);
create index if not exists idx_review_items_question on public.review_items(question_id);
create index if not exists idx_bookmarks_question on public.bookmarks(question_id);
create index if not exists idx_seen_questions_question on public.seen_questions(question_id);
create index if not exists idx_mock_exam_attempts_session on public.mock_exam_attempts(session_id);
create index if not exists idx_test_series_attempts_session on public.test_series_attempts(session_id);

-- category='pyq2' filters on (subject, topic, year) same as pyq4 does, but
-- only had the generic (category, subject) index from secure.sql — mirror
-- pyq4.sql's dedicated partial index.
create index if not exists idx_questions_pyq2_section
  on public.questions (category, subject, topic, year)
  where category = 'pyq2';
