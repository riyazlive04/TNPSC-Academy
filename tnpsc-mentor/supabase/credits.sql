-- ─── Credit system ───────────────────────────────────────────────────────────
-- Replaces the per-topic / per-subject free gate with a single credit balance.
--   • 50 credits on signup (column default → back-fills every existing profile).
--   • +10 once per IST day, only on days the user logs in (grant_daily_credit),
--     STARTING THE DAY AFTER SIGNUP — day one is the 50 signup credits only
--     (last_daily_grant defaults to the row's IST creation day, see 1b).
--     Daily credits are use-it-or-lose-it: whatever remains of the most recent
--     daily grant expires at the IST day boundary. Enforcement is lazy — the
--     unspent remainder (daily_left) is clawed back inside the NEXT day's grant,
--     so profiles.credits stays the single authoritative balance and the claw-
--     back happens before the user can see or spend the stale amount (the daily
--     check-in runs on app load, before any test can start).
--   • 1 credit per question — a test costs its question count, spent at test
--     start (spend_credits), gated tests only. Spends drain the expiring daily
--     bucket first, so expiry only ever claws back genuinely untouched daily
--     credits — never signup/admin credits.
--   • Premium/Vettri/staff never spend — enforced in the server (bundleAccess).
-- Balances live on profiles; credit_transactions is an append-only audit ledger.
-- Idempotent: safe to re-run.

-- 1. Balance + daily-grant bookmark on the profile. Adding the column with a
--    default of 50 sets EVERY existing row to 50 (the requested back-fill) and
--    every future signup inherits it. daily_left tracks the unspent remainder of
--    the most recent daily grant (0 for pre-expiry rows: their past grants are
--    grandfathered as permanent; expiry applies from their next grant onwards).
alter table public.profiles add column if not exists credits integer not null default 50;
alter table public.profiles add column if not exists last_daily_grant date;
alter table public.profiles add column if not exists daily_left integer not null default 0;

-- 1b. New accounts start with EXACTLY the 50 signup credits: the row is born
--     with last_daily_grant = its IST creation day, so the same-day check-in
--     no-ops and the +10 daily bonus starts the day AFTER signup. (The
--     handle_new_user trigger inserts without this column, so the default
--     applies; existing rows are untouched.)
alter table public.profiles
  alter column last_daily_grant set default ((now() at time zone 'Asia/Kolkata')::date);

-- 2. Audit ledger — one row per grant/spend. RLS: a user reads only their own;
--    nobody writes directly (only the SECURITY DEFINER RPCs / service role).
create table if not exists public.credit_transactions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  amount     integer not null,                         -- signed: +grant / -spend
  kind       text not null check (kind in ('signup','daily','spend','backfill','admin','expire')),
  reason     text,
  created_at timestamptz not null default now()
);
-- Widen the kind check on pre-existing installs to admit 'expire' rows.
alter table public.credit_transactions drop constraint if exists credit_transactions_kind_check;
alter table public.credit_transactions add constraint credit_transactions_kind_check
  check (kind in ('signup','daily','spend','backfill','admin','expire'));
create index if not exists idx_credit_tx_user on public.credit_transactions (user_id, created_at desc);
alter table public.credit_transactions enable row level security;
drop policy if exists credit_tx_own_select on public.credit_transactions;
create policy credit_tx_own_select on public.credit_transactions
  for select using (auth.uid() = user_id);

-- 3. Spend N credits for the current user. Atomic (row lock). Returns the NEW
--    balance on success, or -1 when the balance is insufficient (nothing spent).
create or replace function public.spend_credits(p_amount integer, p_reason text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_bal integer;
begin
  if auth.uid() is null then return -1; end if;
  if p_amount is null or p_amount <= 0 then return -1; end if;
  select credits into v_bal from public.profiles where id = auth.uid() for update;
  if v_bal is null or v_bal < p_amount then return -1; end if;
  -- daily_left drains first so end-of-day expiry only claws back untouched
  -- daily credits, never the signup/admin balance the user is saving up.
  update public.profiles
    set credits = credits - p_amount,
        daily_left = greatest(0, daily_left - p_amount)
    where id = auth.uid();
  insert into public.credit_transactions (user_id, amount, kind, reason)
    values (auth.uid(), -p_amount, 'spend', coalesce(p_reason, 'test'));
  return v_bal - p_amount;
end;
$$;

-- 4. Daily login bonus: grant p_amount once per IST calendar day. Returns
--    { granted: bool, balance: int }. No-op (granted=false) if already granted
--    today, so it's safe to call on every app load. On a new day it FIRST
--    expires whatever remains of the previous grant (daily_left) — that is the
--    "daily credits are revoked at end of day" rule, enforced lazily at the
--    next check-in so no cron is needed and the user never observes the stale
--    balance (check-in runs on app load, before any test can start).
create or replace function public.grant_daily_credit(p_amount integer)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today  date := (now() at time zone 'Asia/Kolkata')::date;
  v_last   date;
  v_bal    integer;
  v_left   integer;
  v_revoke integer := 0;
begin
  if auth.uid() is null then return jsonb_build_object('granted', false, 'balance', 0); end if;
  select last_daily_grant, credits, daily_left into v_last, v_bal, v_left
    from public.profiles where id = auth.uid() for update;
  if v_bal is null then return jsonb_build_object('granted', false, 'balance', 0); end if;
  if v_last is distinct from v_today then
    -- Expire the previous day's unused daily credits, then grant today's.
    -- least(): never claw back more than the actual balance.
    v_revoke := least(coalesce(v_left, 0), v_bal);
    update public.profiles
      set credits = credits - v_revoke + p_amount,
          daily_left = p_amount,
          last_daily_grant = v_today
      where id = auth.uid()
      returning credits into v_bal;
    if v_revoke > 0 then
      insert into public.credit_transactions (user_id, amount, kind, reason)
        values (auth.uid(), -v_revoke, 'expire', 'Unused daily credits expired (end of day)');
    end if;
    insert into public.credit_transactions (user_id, amount, kind, reason)
      values (auth.uid(), p_amount, 'daily', 'Daily login bonus');
    return jsonb_build_object('granted', true, 'balance', v_bal);
  end if;
  return jsonb_build_object('granted', false, 'balance', v_bal);
end;
$$;

grant execute on function public.spend_credits(integer, text)   to authenticated;
grant execute on function public.grant_daily_credit(integer)    to authenticated;
