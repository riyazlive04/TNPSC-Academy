-- ============================================================================
-- TNPSC Mentors — "your reported question is fixed" message
-- ----------------------------------------------------------------------------
-- Run AFTER question_report_status.sql + app_settings.sql. Closes the loop on a
-- student question report: when an admin marks a reported question RESOLVED the
-- server messages everyone who flagged it (in-app notification + Web Push), with
-- copy the superadmin edits from the console. Idempotent / re-runnable.
--
-- Two pieces:
--   1. `notified_at` on the triage row — the watermark that stops a second
--      "Resolve" click from re-messaging students who were already told. Only
--      reports NEWER than this stamp are notified, so a reopen → fresh report →
--      resolve cycle reaches the new reporter and nobody else.
--   2. The editable copy, seeded into app_settings as ONE jsonb object. Server
--      defaults live in server/src/lib/settings.ts (REPORT_RESOLVED_MESSAGE_
--      DEFAULT) and apply per-field, so this seed is a convenience, not a
--      requirement — the message sends correctly with no row at all.
-- ============================================================================

-- ─── 1. Re-send watermark ────────────────────────────────────────────────────
alter table public.question_report_status
  add column if not exists notified_at timestamptz;

comment on column public.question_report_status.notified_at is
  'When the reporters of this question were last told it was resolved. Only reports with updated_at > this value are notified again.';

-- ─── 2. Editable message copy ────────────────────────────────────────────────
-- Insert-only: a re-run must never clobber wording the superadmin has changed.
-- Written from the console via POST /api/superadmin/settings (the key is on the
-- WRITABLE_SETTING_KEYS allow-list); the browser cannot touch app_settings
-- directly (RLS on, no client policies).
--
-- {subject} and {note} in any field are replaced at send time with the
-- question's subject and the admin's resolution note (blank when absent).
insert into public.app_settings (key, value) values (
  'report_resolved_message',
  jsonb_build_object(
    'enabled', true,
    'title',   'The question you reported has been fixed',
    'body',    'Thanks for flagging it. Our team reviewed the question and made the correction. Please keep reporting anything that looks wrong.',
    'title_ta', 'நீங்கள் தெரிவித்த வினா சரிசெய்யப்பட்டது',
    'body_ta',  'தவறைச் சுட்டிக்காட்டியதற்கு நன்றி. எங்கள் குழு அந்த வினாவைப் பரிசீலித்துத் திருத்தியுள்ளது. தவறாகத் தோன்றும் எதையும் தொடர்ந்து தெரிவியுங்கள்.'
  )
)
on conflict (key) do nothing;
