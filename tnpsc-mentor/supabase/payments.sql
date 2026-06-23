-- ============================================================================
-- TNPSC Mentors — Payments (Razorpay)
-- ----------------------------------------------------------------------------
-- Run AFTER schema.sql. Records every Razorpay order/payment so we have a
-- trusted, server-written ledger. Deliberately model-agnostic: it does NOT
-- grant any entitlement yet (no premium flag, no per-item unlock). When the
-- monetisation model is decided, gating reads from this table (or a derived
-- column) — the recording layer stays the same. Idempotent.
--
-- Trust model: the browser never writes here. The Express server creates the
-- `created` row when it opens an order, then flips it to `paid` ONLY after it
-- has HMAC-verified the Razorpay signature server-side. Writes go through the
-- service-role client (bypasses RLS); RLS below only governs user reads.
-- ============================================================================

create table if not exists public.payments (
  id                  uuid default uuid_generate_v4() primary key,
  user_id             uuid not null references auth.users(id) on delete cascade,

  -- Razorpay identifiers. order_id is created first (unique); payment_id and
  -- signature arrive on the checkout callback and are filled in on verify.
  razorpay_order_id   text not null unique,
  razorpay_payment_id text unique,
  razorpay_signature  text,

  -- Amount is stored in the smallest currency unit (paise for INR), exactly as
  -- Razorpay expects/returns it — avoids float rounding on money.
  amount              integer not null check (amount >= 0),
  currency            text not null default 'INR',

  -- Free-form provenance: a human receipt string and any notes we attach to the
  -- order (e.g. a future SKU / plan id). Kept generic so the model can change.
  receipt             text,
  notes               jsonb,

  -- created → paid (signature verified) | failed (verify mismatch / abandoned).
  status              text not null default 'created'
                        check (status in ('created', 'paid', 'failed')),

  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists idx_payments_user on public.payments(user_id, created_at desc);
create index if not exists idx_payments_status on public.payments(status);

-- Keep updated_at fresh on every status transition.
create or replace function public.touch_payments_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_payments_updated_at on public.payments;
create trigger trg_payments_updated_at
  before update on public.payments
  for each row execute function public.touch_payments_updated_at();

-- ─── Row-level security ──────────────────────────────────────────────────────
-- Users may READ their own payment history; they may never write (the server
-- writes via the service-role key, which bypasses RLS). No insert/update/delete
-- policies are defined for `authenticated`, so direct client writes are denied.
alter table public.payments enable row level security;

drop policy if exists "Users read own payments" on public.payments;
create policy "Users read own payments"
  on public.payments for select to authenticated
  using (auth.uid() = user_id);

grant select on public.payments to authenticated;
