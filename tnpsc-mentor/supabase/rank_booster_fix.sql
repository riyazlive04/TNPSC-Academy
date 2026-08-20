-- ============================================================================
-- Rank Booster follow-up fix
-- ----------------------------------------------------------------------------
-- rank_booster.sql based its superadmin_list_users redefinition on the OLDER
-- superadmin_users_v2.sql shape (p_limit, p_search — no p_offset/total). Live
-- prod had already moved on to supabase/superadmin_users_paging.sql (3-arg,
-- with a `total` window column) — a drift rank_booster.sql's author didn't
-- know about. `create or replace` can't change a function's arg list, so this
-- created a SECOND, unused 2-arg overload instead of updating the live one;
-- the server always calls with all 3 named params, so it kept resolving to
-- the untouched 3-arg version — which has no rank_booster/rank_booster_until
-- columns. Net effect: nothing broke, but the Rank Booster badge/grant/revoke
-- UI in the Superadmin Users popup silently read undefined for those two
-- columns. This file: drops the stray 2-arg overload, drops the orphaned
-- 7-arg admin_set_test_series overload from the same cause, and redefines
-- superadmin_list_users on the CORRECT (paging) shape with the two new columns.
--
-- Apply with:  node run-migration.mjs ../supabase/rank_booster_fix.sql
-- Idempotent / re-runnable.
-- ============================================================================

drop function if exists public.superadmin_list_users(int, text);
drop function if exists public.superadmin_list_users(int, text, int);

create or replace function public.superadmin_list_users(
  p_limit int default 200,
  p_search text default null,
  p_offset int default 0
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
  vettri_until timestamptz,
  rank_booster boolean,
  rank_booster_until timestamptz,
  total bigint
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
    vet.vettri_end as vettri_until,
    (rb.rb_end is not null) as rank_booster,
    rb.rb_end as rank_booster_until,
    -- Window functions run before LIMIT/OFFSET, so this is the size of the
    -- whole filtered set, not of the page.
    count(*) over () as total
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
  left join lateral (
    select max(pm.created_at) + interval '30 days' as rb_end
    from public.payments pm
    where pm.user_id = p.id
      and pm.status = 'paid'
      and pm.notes->>'plan' = 'rank_booster_g2'
      and pm.created_at >= now() - interval '30 days'
  ) rb on true
  where p_search is null
     or p.full_name ilike '%' || p_search || '%'
     or p.email ilike '%' || p_search || '%'
  -- created_at is not unique enough on its own to page deterministically (bulk
  -- signups share a timestamp), so id breaks the tie - without it a row could
  -- appear on two pages or on none.
  order by p.created_at desc, p.id
  limit greatest(1, least(p_limit, 1000))
  offset greatest(0, coalesce(p_offset, 0));
end;
$$;

grant execute on function public.superadmin_list_users(int, text, int) to authenticated;

-- Drop the orphaned 7-arg admin_set_test_series (the same rank_booster.sql
-- `create or replace` mistake: adding a trailing param created a second
-- overload instead of updating the original). The 8-arg version (with
-- p_tier) is what the server actually calls now, so the old one is dead.
drop function if exists public.admin_set_test_series(
  text, boolean, text, date, integer, numeric, text
);
