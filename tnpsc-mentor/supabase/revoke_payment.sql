-- ============================================================================
-- TNPSC Mentor — Superadmin: revoke a user's payment / premium entitlement
-- ----------------------------------------------------------------------------
-- Run AFTER payments.sql + superadmin.sql. Adds a 'revoked' payment status,
-- surfaces each user's premium state in the superadmin user list, and adds a
-- SECURITY DEFINER RPC that flips a user's paid rows to 'revoked' (which the
-- premium computation — eq(status,'paid') — then excludes). Idempotent.
--
-- 'revoked' is kept distinct from 'failed' so the ledger stays auditable: a
-- failed payment never granted anything; a revoked one was paid and later
-- withdrawn by a superadmin.
-- ============================================================================

-- ─── 1. Widen the payments status CHECK to allow 'revoked' ───────────────────
alter table public.payments drop constraint if exists payments_status_check;
alter table public.payments
  add constraint payments_status_check
    check (status in ('created', 'paid', 'failed', 'revoked'));

-- ─── 2. Re-list users WITH premium state ─────────────────────────────────────
-- Premium mirrors GET /api/payments/premium: a paid `premium_annual` order
-- within the 90-day window. CREATE OR REPLACE can't change a function's return
-- type, so drop first, then recreate + re-grant.
drop function if exists public.superadmin_list_users(int, text);

create or replace function public.superadmin_list_users(
  p_limit int default 200,
  p_search text default null
)
returns table (
  id uuid,
  full_name text,
  email text,
  avatar_url text,
  role text,
  created_at timestamptz,
  tests_taken bigint,
  last_active date,
  premium boolean,
  premium_until timestamptz
)
language plpgsql
security definer
stable
set search_path = public
as $$
begin
  if not public.is_superadmin() then
    raise exception 'not authorized';
  end if;

  return query
  select
    p.id,
    p.full_name,
    p.email,
    p.avatar_url,
    p.role,
    p.created_at,
    (select count(*) from public.test_sessions ts
       where ts.user_id = p.id and ts.status = 'completed') as tests_taken,
    (select max(da.activity_date) from public.daily_activity da
       where da.user_id = p.id) as last_active,
    pay.latest_paid is not null as premium,
    (pay.latest_paid + interval '90 days') as premium_until
  from public.profiles p
  left join lateral (
    select max(pm.created_at) as latest_paid
    from public.payments pm
    where pm.user_id = p.id
      and pm.status = 'paid'
      and pm.notes->>'plan' = 'premium_annual'
      and pm.created_at >= now() - interval '90 days'
  ) pay on true
  where p_search is null
     or p.full_name ilike '%' || p_search || '%'
     or p.email ilike '%' || p_search || '%'
  order by p.created_at desc
  limit greatest(1, least(p_limit, 1000));
end;
$$;

grant execute on function public.superadmin_list_users(int, text) to authenticated;

-- ─── 3. Revoke a user's premium ──────────────────────────────────────────────
-- Flips every still-'paid' row for the user to 'revoked', killing the computed
-- entitlement. Returns the number of rows revoked (0 = nothing to revoke).
create or replace function public.superadmin_revoke_premium(p_user uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  if not public.is_superadmin() then
    raise exception 'not authorized';
  end if;

  if not exists (select 1 from public.profiles where id = p_user) then
    raise exception 'user not found';
  end if;

  update public.payments
    set status = 'revoked'
    where user_id = p_user and status = 'paid';
  get diagnostics v_count = row_count;

  return v_count;
end;
$$;

grant execute on function public.superadmin_revoke_premium(uuid) to authenticated;
