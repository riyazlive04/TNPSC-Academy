-- ============================================================================
-- Superadmin Users tab: real paging over the WHOLE user table
-- ----------------------------------------------------------------------------
-- The console listed only the newest 200 accounts and said nothing about the
-- rest: superadmin_list_users took a limit but no offset, so there was no way
-- to reach page 2, and the hard cap inside the function silently truncated the
-- result. This adds:
--   • p_offset  — the missing half of a page request.
--   • total     — the size of the FULL filtered set (a window function, so it
--                 is computed before LIMIT), returned on every row. The console
--                 uses it to keep fetching until it holds every account, and to
--                 show "x-y of z".
-- Body is otherwise identical to superadmin_users_v2.sql (which this file
-- supersedes for the list definition — keep future edits here).
--
-- The new parameter has a DEFAULT, so an older server calling with just
-- (p_limit, p_search) keeps resolving. Apply this BEFORE deploying the server
-- that sends p_offset.
--
-- Apply with:  node run-migration.mjs ../supabase/superadmin_users_paging.sql
-- Idempotent / re-runnable.
-- ============================================================================

-- CREATE OR REPLACE can't change a function's return type; drop first. Both
-- signatures are dropped so re-running after a partial apply is still clean.
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
