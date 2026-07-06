-- ─── Signup phone verification via Telegram (bot contact-share) ──────────────
-- Fallback for numbers with no WhatsApp: the user opens the bot through a
-- one-time deep-link token, taps "Share my phone number", and the webhook
-- marks the row verified when Telegram's authenticated contact matches the
-- phone being registered. The signup page polls the row's status and then
-- receives the same phone-verified ticket the WhatsApp flow issues.
-- Service-role only: RLS enabled with NO policies, client roles revoked.

create table if not exists public.telegram_verifications (
  token       text primary key,                    -- one-time deep-link token (crypto-random)
  phone       text not null,                       -- bare 10-digit mobile being registered
  status      text not null default 'pending',     -- pending | verified | mismatch
  chat_id     bigint,                              -- bot chat, set when the user taps Start
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null
);

-- The contact webhook only knows the chat it arrived in — find its pending row.
create index if not exists telegram_verifications_chat_idx
  on public.telegram_verifications (chat_id)
  where status = 'pending';

alter table public.telegram_verifications enable row level security;
revoke all on table public.telegram_verifications from anon, authenticated;
