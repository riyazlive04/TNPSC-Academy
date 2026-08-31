-- ============================================================================
-- TNPSC Mentors — CA magazine → Telegram channel broadcast
-- ----------------------------------------------------------------------------
-- A superadmin sends an approved current-affairs issue to the public Telegram
-- channel as two PDFs (English + Tamil), each with its own editable caption.
-- The PDFs are rendered in the browser (only the browser can shape Tamil),
-- archived in the private `ca-deliverables` bucket, then uploaded to Telegram
-- by the Express layer.
--
-- This table is the send LOG: one row per document that actually reached the
-- channel, so the console can show "already sent" and a re-send is an explicit,
-- visible act. Like ca_magazine it is server-only: RLS on with NO policies.
-- Idempotent — safe to re-run.
-- ============================================================================

create table if not exists public.ca_telegram_posts (
  id           uuid primary key default gen_random_uuid(),
  ca_type      text not null check (ca_type in ('day_wise', 'month_wise')),
  date         date not null,                 -- the issue, matching ca_magazine
  lang         text not null check (lang in ('en', 'ta')),
  chat_id      text not null,                 -- '@channel' or a numeric id
  message_id   bigint,                        -- Telegram's id for the post
  caption      text,                          -- exactly what was published
  file_name    text,
  file_size    int,
  storage_path text,                          -- the archived PDF in ca-deliverables
  sent_at      timestamptz not null default now(),
  sent_by      uuid references auth.users(id)
);

-- The console asks "what has been sent for this issue?" — newest first.
create index if not exists ca_telegram_posts_issue_idx
  on public.ca_telegram_posts (ca_type, date desc, sent_at desc);

alter table public.ca_telegram_posts enable row level security;

-- ─── Caption templates + channel (superadmin-editable) ───────────────────────
-- Stored in app_settings so the copy can change without a redeploy. The channel
-- falls back to the TELEGRAM_CA_CHANNEL env var when left blank.
-- Placeholders resolved at send time: {date} {items} {link} {name}
-- Insert-only so re-running never clobbers edited copy.
insert into public.app_settings (key, value) values
  ('telegram_ca_channel', '"-1004443543961"'::jsonb),  -- TNPSC Mentors (private: numeric id)
  (
    'telegram_ca_caption_en',
    to_jsonb(
      '📘 Current Affairs — {date}' || chr(10) ||
      '{items} news items, exam-ready.' || chr(10) || chr(10) ||
      'Daily current affairs, PYQs and mock tests: {link}'
    )
  ),
  (
    'telegram_ca_caption_ta',
    to_jsonb(
      '📘 நடப்பு நிகழ்வுகள் — {date}' || chr(10) ||
      '{items} செய்திகள், தேர்வுக்குத் தயார்.' || chr(10) || chr(10) ||
      'தினசரி நடப்பு நிகழ்வுகள், PYQ மற்றும் மாதிரித் தேர்வுகள்: {link}'
    )
  )
on conflict (key) do nothing;
