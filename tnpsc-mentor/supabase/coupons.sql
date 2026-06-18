-- ============================================================================
-- TNPSC Mentor — Promoter / affiliate coupon codes
-- ----------------------------------------------------------------------------
-- Run AFTER schema.sql + payments.sql. A coupon belongs to a named promoter and
-- gives a flat-₹ or percentage discount at Razorpay checkout. The SAME code is
-- reusable by many customers, so we can track how many sales / how much discount
-- each promoter drove. Idempotent.
--
-- Trust model (mirrors payments.sql): the browser NEVER reads or writes this
-- table. The Express server is the only client — it validates a code and computes
-- the discounted price server-side via the service-role key (which bypasses RLS).
-- RLS is enabled with NO policies, so direct `authenticated` access is denied.
-- ============================================================================

create table if not exists public.coupons (
  id              uuid default uuid_generate_v4() primary key,

  -- The redeemable code, stored UPPERCASE (matched case-insensitively at redeem).
  code            text not null unique,
  -- Who is promoting the app with this code (for reporting / payouts).
  promoter_name   text not null,

  discount_type   text not null check (discount_type in ('flat', 'percent')),
  -- flat → discount in paise (₹1 = 100); percent → whole-number 1..100.
  discount_value  integer not null,
  -- Optional cap (paise) for percentage discounts; null = uncapped.
  max_discount    integer check (max_discount is null or max_discount >= 0),
  -- Optional cap on successful redemptions; null = unlimited.
  max_redemptions integer check (max_redemptions is null or max_redemptions >= 0),
  -- Optional expiry; null = never expires.
  expires_at      timestamptz,
  -- Soft on/off switch so a code can be paused without deleting its history.
  active          boolean not null default true,

  created_by      uuid references auth.users(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  -- Value must make sense for its type: percent ∈ [1,100]; flat ≥ ₹1.
  constraint coupons_value_valid check (
    (discount_type = 'percent' and discount_value between 1 and 100) or
    (discount_type = 'flat' and discount_value >= 1)
  )
);

-- Case-insensitive lookup by code.
create unique index if not exists idx_coupons_code_lower on public.coupons (lower(code));

-- Keep updated_at fresh on every edit (toggle active, change value, etc.).
create or replace function public.touch_coupons_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_coupons_updated_at on public.coupons;
create trigger trg_coupons_updated_at
  before update on public.coupons
  for each row execute function public.touch_coupons_updated_at();

-- ─── Payments: record the applied coupon + discount breakdown ────────────────
-- `amount` stays the FINAL charged amount; we add the pre-discount base and the
-- discount so per-promoter totals are auditable straight off the ledger.
alter table public.payments add column if not exists coupon_id       uuid references public.coupons(id) on delete set null;
alter table public.payments add column if not exists coupon_code     text;
alter table public.payments add column if not exists original_amount integer;            -- pre-discount paise
alter table public.payments add column if not exists discount_amount integer default 0;  -- paise

create index if not exists idx_payments_coupon on public.payments (coupon_id) where coupon_id is not null;

-- ─── Row-level security ──────────────────────────────────────────────────────
-- Server-only. No policies for `authenticated`, so the browser can neither read
-- nor write coupons directly; everything flows through the Express API, which
-- uses the service-role client (RLS-exempt).
alter table public.coupons enable row level security;
