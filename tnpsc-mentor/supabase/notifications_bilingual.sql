-- ============================================================================
-- TNPSC Mentors — Bilingual notifications (English + Tamil variants)
-- ----------------------------------------------------------------------------
-- Run AFTER notifications.sql. Adds optional Tamil title/body to the
-- superadmin-authored notifications, mirroring app_alerts (alerts.sql):
--   • Web Push picks the variant per subscriber from profiles.language at send
--     time ('ta' → Tamil, 'both' → English + Tamil stacked, else English).
--   • The in-app feed returns both variants; the bell renders by the user's
--     LIVE language choice, so switching language re-localizes old items too.
-- NULL Tamil fields = English-only notification (previous behavior). Idempotent.
-- ============================================================================

alter table public.notifications add column if not exists title_ta text;
alter table public.notifications add column if not exists body_ta  text;
