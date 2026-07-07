-- ─── Signup phone verification (WhatsApp OTP) ────────────────────────────────
-- Pending one-time codes sent (via AiSensy, an official WhatsApp Business API
-- platform) to a mobile number while it is being registered. One row per phone.
-- The code itself is stored ONLY as an HMAC (keyed with the service-role key),
-- so a DB leak reveals nothing usable. Service-role only: RLS is enabled with
-- NO policies and client roles are revoked — the browser can never touch it.

create table if not exists public.phone_otps (
  phone        text primary key,                    -- bare 10-digit Indian mobile
  otp_hash     text not null,                       -- HMAC-SHA256(phone.code), base64url
  expires_at   timestamptz not null,
  attempts     int not null default 0,              -- wrong guesses so far (row dies at 5)
  last_sent_at timestamptz not null default now(),  -- drives the resend cooldown
  created_at   timestamptz not null default now()
);

alter table public.phone_otps enable row level security;
revoke all on table public.phone_otps from anon, authenticated;
