-- ============================================================================
-- TNPSC Mentors — storage buckets
-- ----------------------------------------------------------------------------
-- These four buckets were created by hand in the Supabase Cloud dashboard and
-- were therefore the ONE part of the schema no migration in this repo owned.
-- On the self-hosted stack a database-only restore can leave `storage.buckets`
-- empty, and every upload/download then fails with "Bucket not found" — the CA
-- Telegram broadcast archives its PDFs in `ca-deliverables` before sending, so
-- it breaks first and loudest.
--
-- All four are PRIVATE: the app never links to them directly, it mints signed
-- URLs server-side (service-role). Idempotent — safe to re-run.
-- ============================================================================

insert into storage.buckets (id, name, public, file_size_limit)
values
  -- CA magazine deliverables: the EN/TA PDFs sent to Telegram, plus the monthly
  -- auto-publish output (pdf/docx/json) under ca-deliverables/<month>/.
  -- 50 MB matches DOCUMENT_MAX_BYTES in server/src/lib/telegramChannel.ts, which
  -- is itself Telegram's bot upload ceiling.
  ('ca-deliverables', 'ca-deliverables', false, 52428800),
  -- Superadmin-curated study materials (videos/images/PDFs/docs), served to
  -- students as signed URLs.
  ('materials',       'materials',       false, null),
  -- Direct-download APK builds behind /api/app/download.
  ('app-releases',    'app-releases',    false, null),
  -- Capgo live-update web bundles served by /api/app/web-bundle/check.
  ('web-bundles',     'web-bundles',     false, null)
on conflict (id) do nothing;
