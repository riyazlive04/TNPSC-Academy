-- ============================================================================
-- TNPSC Mentors — Superadmin Users v2: detail fields + Vettri Nichayam controls
-- ----------------------------------------------------------------------------
-- Run AFTER revoke_payment.sql + superadmin_user_avatar.sql. Three changes:
--   1. superadmin_list_users gains phone/target_group (for the detail popup)
--      and vettri/vettri_until (badge + controls), mirroring bundleAccess in
--      server/src/lib/premium.ts: full plan 'vettri_nichayam' = 60-day window,
--      monthly 'vettri_month' = 30-day window, whichever expiry is later.
--   2. superadmin_revoke_premium is SCOPED to premium_annual rows (it used to
--      flip EVERY paid row, which would also kill an unrelated Vettri purchase);
--      a new superadmin_revoke_vettri does the same for the two Vettri plans.
--   3. superadmin_grant_plan comps a plan: inserts a ₹0 'paid' ledger row (the
--      same shape the 100%-off coupon path produces), so the normal computed
--      entitlement picks it up — no parallel grant mechanism to drift.
-- This file supersedes the list-users definition in superadmin_user_avatar.sql —
-- keep future edits here. Idempotent / re-runnable.
-- ============================================================================

-- ─── 1. Re-list users WITH phone, target_group and vettri state ──────────────
-- CREATE OR REPLACE can't change a function's return type; drop first.
drop function if exists public.superadmin_list_users(int, text);

create or replace function public.superadmin_list_users(
  p_limit int default 200,
  p_search text default null
)
returns table (
  id uuid,
  full_name text,
  email text,
  phone text,
  target_group text,
  avatar_url text,
  role text,
  created_at timestamptz,
  tests_taken bigint,
  last_active date,
  premium boolean,
  premium_until timestamptz,
  vettri boolean,
  vettri_until timestamptz
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
    p.phone,
    p.target_group,
    p.avatar_url,
    p.role,
    p.created_at,
    (select count(*) from public.test_sessions ts
       where ts.user_id = p.id and ts.status = 'completed') as tests_taken,
    (select max(da.activity_date) from public.daily_activity da
       where da.user_id = p.id) as last_active,
    pay.latest_paid is not null as premium,
    (pay.latest_paid + interval '90 days') as premium_until,
    (vet.vettri_end is not null) as vettri,
    vet.vettri_end as vettri_until
  from public.profiles p
  left join lateral (
    select max(pm.created_at) as latest_paid
    from public.payments pm
    where pm.user_id = p.id
      and pm.status = 'paid'
      and pm.notes->>'plan' = 'premium_annual'
      and pm.created_at >= now() - interval '90 days'
  ) pay on true
  left join lateral (
    -- Later of the two plans' own expiries, NULL when neither is active
    -- (mirrors bundleAccess: each plan bounded by its OWN validity window).
    select max(pm.created_at + case pm.notes->>'plan'
             when 'vettri_nichayam' then interval '60 days'
             else interval '30 days'
           end) as vettri_end
    from public.payments pm
    where pm.user_id = p.id
      and pm.status = 'paid'
      and (
        (pm.notes->>'plan' = 'vettri_nichayam' and pm.created_at >= now() - interval '60 days')
        or (pm.notes->>'plan' = 'vettri_month' and pm.created_at >= now() - interval '30 days')
      )
  ) vet on true
  where p_search is null
     or p.full_name ilike '%' || p_search || '%'
     or p.email ilike '%' || p_search || '%'
  order by p.created_at desc
  limit greatest(1, least(p_limit, 1000));
end;
$$;

grant execute on function public.superadmin_list_users(int, text) to authenticated;

-- ─── 2a. Revoke premium — now scoped to the premium plan only ─────────────────
-- Previously flipped EVERY paid row (so revoking premium also destroyed a
-- Vettri purchase). Rows without a plan grant nothing, so they're left alone.
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
    where user_id = p_user and status = 'paid'
      and notes->>'plan' = 'premium_annual';
  get diagnostics v_count = row_count;

  return v_count;
end;
$$;

grant execute on function public.superadmin_revoke_premium(uuid) to authenticated;

-- ─── 2b. Revoke Vettri Nichayam (both the full and the monthly plan) ─────────
create or replace function public.superadmin_revoke_vettri(p_user uuid)
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
    where user_id = p_user and status = 'paid'
      and notes->>'plan' in ('vettri_nichayam', 'vettri_month');
  get diagnostics v_count = row_count;

  return v_count;
end;
$$;

grant execute on function public.superadmin_revoke_vettri(uuid) to authenticated;

-- ─── 3. Grant (comp) a plan ──────────────────────────────────────────────────
-- Inserts a ₹0 'paid' ledger row carrying the plan, exactly like a 100%-off
-- coupon order — the computed entitlement (bundleAccess / premiumEntitlement)
-- then grants access for the plan's own validity window from now. The synthetic
-- order id keeps the razorpay_order_id NOT NULL UNIQUE constraint happy and is
-- prefixed 'comp_' so the ledger stays auditable.
--
-- gen_random_uuid(), NOT uuid_generate_v4(): this function pins
-- `search_path = public`, and uuid-ossp lives in the `extensions` schema on
-- Supabase, so the unqualified uuid_generate_v4() call failed here with
-- "42883 function uuid_generate_v4() does not exist". gen_random_uuid() is core
-- (pg_catalog) from PG13 on and resolves under any search_path.
create or replace function public.superadmin_grant_plan(p_user uuid, p_plan text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if not public.is_superadmin() then
    raise exception 'not authorized';
  end if;

  if p_plan not in ('premium_annual', 'vettri_nichayam', 'vettri_month') then
    raise exception 'unknown plan: %', p_plan;
  end if;

  if not exists (select 1 from public.profiles where id = p_user) then
    raise exception 'user not found';
  end if;

  insert into public.payments (user_id, razorpay_order_id, amount, currency, receipt, notes, status)
  values (
    p_user,
    'comp_' || replace(gen_random_uuid()::text, '-', ''),
    0,
    'INR',
    'superadmin comp',
    jsonb_build_object('plan', p_plan, 'comp', true, 'granted_by', auth.uid()),
    'paid'
  )
  returning payments.id into v_id;

  return v_id;
end;
$$;

grant execute on function public.superadmin_grant_plan(uuid, text) to authenticated;
