-- ============================================================================
-- TNPSC Mentors — In-app purchase support on the payments ledger
-- ----------------------------------------------------------------------------
-- Run AFTER payments.sql. Idempotent.
--
-- The mobile apps cannot use Razorpay: Apple guideline 3.1.1 and Google Play's
-- Payments policy both require the platform's own billing for digital content.
-- Rather than stand up a second ledger, an App Store / Play purchase lands in
-- `payments` as an ordinary `paid` row, so bundleAccess() and every gate that
-- reads it keep working untouched.
--
-- The mapping onto the existing columns:
--   razorpay_order_id   → 'ios:<transactionId>' | 'android:<purchaseToken>'
--                         Its UNIQUE constraint is what makes receipt replay a
--                         no-op: a second submission of the same purchase raises
--                         23505 and the route reports "already recorded".
--   razorpay_payment_id → the store's own order id, when it exposes one.
--   razorpay_signature  → null (the signature lives inside the store's own
--                         cryptographic proof, which the server checks before
--                         this row is ever written).
--   amount              → the price in the STORE's minor units, which is not
--                         necessarily the rupee web price.
-- ============================================================================

-- Which rail took the money. Existing rows predate IAP and are all Razorpay.
alter table public.payments
  add column if not exists provider text not null default 'razorpay';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'payments_provider_check'
  ) then
    alter table public.payments
      add constraint payments_provider_check
      check (provider in ('razorpay', 'apple', 'google', 'comp'));
  end if;
end $$;

-- Revenue reporting splits by rail (store commission differs per provider), and
-- the superadmin dashboard filters on it.
create index if not exists idx_payments_provider
  on public.payments(provider, created_at desc);

comment on column public.payments.provider is
  'Payment rail: razorpay (web) | apple (App Store IAP) | google (Play Billing) | comp (superadmin/coupon grant).';
