-- ============================================================================
-- TNPSC Mentors — TOTP two-factor authentication for admin/superadmin
-- ----------------------------------------------------------------------------
-- Admin and superadmin accounts previously shared the exact same single-
-- password auth as any student account, despite controlling PII, payments and
-- every user's credits. This adds an opt-in TOTP step-up.
--
-- Opt-in, not forced: totp_enabled defaults false, so no existing admin/
-- superadmin is switched over by this migration alone — each enrolls
-- deliberately from Profile → Security and sees their backup codes before it
-- ever activates for their account.
--
-- totp_secret and totp_backup_codes must NEVER reach the client — the server
-- strips them from every profile response it sends (see stripTotpSecrets in
-- routes/auth.ts). Accordingly NO RLS policies or grants are added here; only
-- the service role can read/write these two columns, same convention as
-- user_messages.sql. totp_enabled is a plain status flag and is fine to ship
-- to the client as-is. Idempotent.
-- ============================================================================

alter table public.profiles add column if not exists totp_secret text;
alter table public.profiles add column if not exists totp_enabled boolean not null default false;
alter table public.profiles add column if not exists totp_backup_codes text[];

comment on column public.profiles.totp_secret is
  'TOTP shared secret (base32). Server-only — never returned in a profile response.';
comment on column public.profiles.totp_backup_codes is
  'HMAC-hashed one-time backup codes. Server-only — never returned in a profile response.';

notify pgrst, 'reload schema';
