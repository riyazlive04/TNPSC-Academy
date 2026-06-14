-- ============================================================================
-- TNPSC Mentor — Superadmin role, platform metrics, user management & feedback
-- ----------------------------------------------------------------------------
-- Run AFTER schema.sql + secure.sql. Introduces a 3rd role tier (superadmin)
-- that INHERITS every admin ability (is_admin() is widened) and additionally
-- owns the platform console. All console RPCs are SECURITY DEFINER and gated by
-- is_superadmin(), mirroring the admin_write.sql pattern. Idempotent.
-- ============================================================================

-- ─── 1. Widen the role CHECK constraint to allow 'superadmin' ────────────────
-- The inline column check from schema.sql is named profiles_role_check.
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check check (role in ('user', 'admin', 'superadmin'));

-- ─── 2. Role helpers ────────────────────────────────────────────────────────
-- Widen is_admin() so superadmins pass every existing admin gate unchanged.
create or replace function public.is_admin()
returns boolean as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('admin', 'superadmin')
  );
$$ language sql security definer stable;

create or replace function public.is_superadmin()
returns boolean as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'superadmin'
  );
$$ language sql security definer stable;

-- ─── 3. In-app feedback (student ratings + messages) ────────────────────────
create table if not exists public.app_feedback (
  id         uuid default uuid_generate_v4() primary key,
  user_id    uuid references auth.users(id) on delete set null,
  rating     integer not null check (rating between 1 and 5),
  message    text,
  page       text,
  created_at timestamptz default now()
);

create index if not exists idx_feedback_created on public.app_feedback(created_at desc);

alter table public.app_feedback enable row level security;

-- Students may submit feedback and read back their own.
drop policy if exists "Users submit own feedback" on public.app_feedback;
create policy "Users submit own feedback"
  on public.app_feedback for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users read own feedback" on public.app_feedback;
create policy "Users read own feedback"
  on public.app_feedback for select to authenticated
  using (auth.uid() = user_id);

-- Superadmins may read all feedback (RLS path; the console uses the RPC below).
drop policy if exists "Superadmins read all feedback" on public.app_feedback;
create policy "Superadmins read all feedback"
  on public.app_feedback for select to authenticated
  using (public.is_superadmin());

grant select, insert on public.app_feedback to authenticated;

-- ─── 4. Platform metrics (single jsonb payload for the Overview tab) ─────────
create or replace function public.get_platform_metrics()
returns jsonb
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v jsonb;
begin
  if not public.is_superadmin() then
    raise exception 'not authorized';
  end if;

  select jsonb_build_object(
    'totalUsers',       (select count(*) from public.profiles),
    'activeToday',      (select count(distinct user_id) from public.daily_activity
                          where activity_date = current_date),
    'active7d',         (select count(distinct user_id) from public.daily_activity
                          where activity_date >= current_date - 6),
    'active30d',        (select count(distinct user_id) from public.daily_activity
                          where activity_date >= current_date - 29),
    'testsCompleted',   (select count(*) from public.test_sessions where status = 'completed'),
    'totalQuestions',   (select count(*) from public.questions),
    'feedbackCount',    (select count(*) from public.app_feedback),
    'avgRating',        (select round(coalesce(avg(rating), 0)::numeric, 2) from public.app_feedback),
    'roleBreakdown',    (select coalesce(jsonb_object_agg(role, c), '{}'::jsonb)
                          from (select role, count(*) c from public.profiles group by role) r),
    'questionsByCategory', (select coalesce(jsonb_object_agg(category, c), '{}'::jsonb)
                          from (select category, count(*) c from public.questions group by category) q),
    'signups14d',       (select coalesce(jsonb_agg(jsonb_build_object('date', d, 'count', c) order by d), '[]'::jsonb)
                          from (
                            select created_at::date d, count(*) c
                            from public.profiles
                            where created_at >= current_date - 13
                            group by created_at::date
                          ) s)
  ) into v;

  return v;
end;
$$;

grant execute on function public.get_platform_metrics() to authenticated;

-- ─── 5. User management — list with activity, search ────────────────────────
create or replace function public.superadmin_list_users(
  p_limit int default 200,
  p_search text default null
)
returns table (
  id uuid,
  full_name text,
  email text,
  role text,
  created_at timestamptz,
  tests_taken bigint,
  last_active date
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
    p.role,
    p.created_at,
    (select count(*) from public.test_sessions ts
       where ts.user_id = p.id and ts.status = 'completed') as tests_taken,
    (select max(da.activity_date) from public.daily_activity da
       where da.user_id = p.id) as last_active
  from public.profiles p
  where p_search is null
     or p.full_name ilike '%' || p_search || '%'
     or p.email ilike '%' || p_search || '%'
  order by p.created_at desc
  limit greatest(1, least(p_limit, 1000));
end;
$$;

grant execute on function public.superadmin_list_users(int, text) to authenticated;

-- ─── 6. Guarded role change ─────────────────────────────────────────────────
-- Cannot set an invalid role; cannot remove the LAST remaining superadmin.
create or replace function public.superadmin_set_role(p_user uuid, p_role text)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.profiles;
  v_current text;
  v_super_count int;
begin
  if not public.is_superadmin() then
    raise exception 'not authorized';
  end if;
  if p_role not in ('user', 'admin', 'superadmin') then
    raise exception 'invalid role: %', p_role;
  end if;

  select role into v_current from public.profiles where id = p_user;
  if v_current is null then
    raise exception 'user not found';
  end if;

  -- Protect against locking everyone out: don't demote the last superadmin.
  if v_current = 'superadmin' and p_role <> 'superadmin' then
    select count(*) into v_super_count from public.profiles where role = 'superadmin';
    if v_super_count <= 1 then
      raise exception 'cannot demote the last superadmin';
    end if;
  end if;

  update public.profiles set role = p_role where id = p_user returning * into v_row;
  return v_row;
end;
$$;

grant execute on function public.superadmin_set_role(uuid, text) to authenticated;

-- ─── 7. Feedback inbox (joined with submitter identity) ─────────────────────
create or replace function public.list_app_feedback(p_limit int default 100)
returns table (
  id uuid,
  rating int,
  message text,
  page text,
  created_at timestamptz,
  user_name text,
  user_email text
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
  select f.id, f.rating, f.message, f.page, f.created_at,
         p.full_name as user_name, p.email as user_email
  from public.app_feedback f
  left join public.profiles p on p.id = f.user_id
  order by f.created_at desc
  limit greatest(1, least(p_limit, 1000));
end;
$$;

grant execute on function public.list_app_feedback(int) to authenticated;

-- ─── 8. Promote a user to superadmin (run manually, replacing the email) ────
--   update public.profiles set role = 'superadmin' where email = 'you@example.com';
