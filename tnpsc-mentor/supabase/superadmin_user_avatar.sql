-- ============================================================================
-- TNPSC Mentor — Surface avatar_url in the superadmin user list
-- ----------------------------------------------------------------------------
-- Adds the Google profile photo (profiles.avatar_url) to superadmin_list_users so
-- the console's Users tab can show each user's photo. CREATE OR REPLACE can't add
-- a column to a function's return type, so drop + recreate. Mirrors the current
-- definition in revoke_payment.sql (with the premium lateral join) — keep them in
-- sync if either changes. Idempotent / re-runnable.
-- ============================================================================

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
