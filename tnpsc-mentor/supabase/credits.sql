-- ─── Credit system ───────────────────────────────────────────────────────────
-- Replaces the per-topic / per-subject free gate with a single credit balance.
--   • 50 credits on signup (column default → back-fills every existing profile).
--   • +10 once per IST day, only on days the user logs in (grant_daily_credit).
--   • 10 credits per test, spent at submit (spend_credits), for gated tests only.
--   • Premium/Vettri/staff never spend — enforced in the server (bundleAccess).
-- Balances live on profiles; credit_transactions is an append-only audit ledger.
-- Idempotent: safe to re-run.

-- 1. Balance + daily-grant bookmark on the profile. Adding the column with a
--    default of 50 sets EVERY existing row to 50 (the requested back-fill) and
--    every future signup inherits it.
alter table public.profiles add column if not exists credits integer not null default 50;
alter table public.profiles add column if not exists last_daily_grant date;

-- 2. Audit ledger — one row per grant/spend. RLS: a user reads only their own;
--    nobody writes directly (only the SECURITY DEFINER RPCs / service role).
create table if not exists public.credit_transactions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  amount     integer not null,                         -- signed: +grant / -spend
  kind       text not null check (kind in ('signup','daily','spend','backfill','admin')),
  reason     text,
  created_at timestamptz not null default now()
);
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
  update public.profiles set credits = credits - p_amount where id = auth.uid();
  insert into public.credit_transactions (user_id, amount, kind, reason)
    values (auth.uid(), -p_amount, 'spend', coalesce(p_reason, 'test'));
  return v_bal - p_amount;
end;
$$;

-- 4. Daily login bonus: grant p_amount once per IST calendar day. Returns
--    { granted: bool, balance: int }. No-op (granted=false) if already granted
--    today, so it's safe to call on every app load.
create or replace function public.grant_daily_credit(p_amount integer)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today date := (now() at time zone 'Asia/Kolkata')::date;
  v_last  date;
  v_bal   integer;
begin
  if auth.uid() is null then return jsonb_build_object('granted', false, 'balance', 0); end if;
  select last_daily_grant, credits into v_last, v_bal
    from public.profiles where id = auth.uid() for update;
  if v_last is distinct from v_today then
    update public.profiles
      set credits = credits + p_amount, last_daily_grant = v_today
      where id = auth.uid()
      returning credits into v_bal;
    insert into public.credit_transactions (user_id, amount, kind, reason)
      values (auth.uid(), p_amount, 'daily', 'Daily login bonus');
    return jsonb_build_object('granted', true, 'balance', v_bal);
  end if;
  return jsonb_build_object('granted', false, 'balance', v_bal);
end;
$$;

grant execute on function public.spend_credits(integer, text)   to authenticated;
grant execute on function public.grant_daily_credit(integer)    to authenticated;
