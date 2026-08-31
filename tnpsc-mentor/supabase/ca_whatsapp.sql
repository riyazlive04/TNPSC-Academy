-- ============================================================================
-- TNPSC Mentors — CA magazine → WhatsApp Channel (manual post helper)
-- ----------------------------------------------------------------------------
-- WhatsApp Channels have no posting API — official or otherwise, confirmed
-- against Meta's own docs (a Channel is admin-post-only with no Graph API
-- endpoint). So unlike ca_telegram_posts, nothing here is ever sent by the
-- server: a superadmin copies a caption and downloads a PDF in the console,
-- pastes both into the WhatsApp Business app by hand, then marks the language
-- as posted. This table is just that log — one row per language marked done —
-- so the console can show "already posted" the same way the Telegram tab does.
-- Server-only: RLS on with NO policies. Idempotent — safe to re-run.
-- ============================================================================

create table if not exists public.ca_whatsapp_posts (
  id        uuid primary key default gen_random_uuid(),
  ca_type   text not null check (ca_type in ('day_wise', 'month_wise')),
  date      date not null,                 -- the issue, matching ca_magazine
  lang      text not null check (lang in ('en', 'ta')),
  caption   text,                          -- exactly what was marked posted
  sent_at   timestamptz not null default now(),
  sent_by   uuid references auth.users(id)
);

-- The console asks "what has been marked posted for this issue?" — newest first.
create index if not exists ca_whatsapp_posts_issue_idx
  on public.ca_whatsapp_posts (ca_type, date desc, sent_at desc);

alter table public.ca_whatsapp_posts enable row level security;

-- ─── Caption templates (superadmin-editable) ─────────────────────────────────
-- Stored in app_settings so the copy can change without a redeploy.
-- Placeholders resolved at open time: {date} {items} {link} {name}
-- WhatsApp captions use *asterisks* for bold (no HTML), unlike the Telegram copy.
-- Insert-only so re-running never clobbers edited copy.
insert into public.app_settings (key, value) values
  (
    'whatsapp_ca_caption_en',
    to_jsonb(
      '📘 *Current Affairs — {date}*' || chr(10) ||
      '{items} news items, exam-ready.' || chr(10) || chr(10) ||
      'Daily current affairs, PYQs and mock tests: {link}'
    )
  ),
  (
    'whatsapp_ca_caption_ta',
    to_jsonb(
      '📘 *நடப்பு நிகழ்வுகள் — {date}*' || chr(10) ||
      '{items} செய்திகள், தேர்வுக்குத் தயார்.' || chr(10) || chr(10) ||
      'தினசரி நடப்பு நிகழ்வுகள், PYQ மற்றும் மாதிரித் தேர்வுகள்: {link}'
    )
  )
on conflict (key) do nothing;
