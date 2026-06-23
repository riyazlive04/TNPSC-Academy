-- ============================================================================
-- TNPSC Mentors — free-tier explanation-PDF download counter
-- ----------------------------------------------------------------------------
-- Downloading the explanation PDF is now open to EVERY user (it used to be a
-- premium-only perk), but free users are capped at a small number of downloads
-- (mirrors the 3-test free allowance). Premium users are unlimited and never
-- touch this counter — the Node layer only calls record_pdf_download() for a
-- free user, passing the cap.
--
-- The counter lives on the profile (one int per user). The atomic
-- increment-under-cap means concurrent download clicks can never push a free
-- user past the cap.
-- ============================================================================

alter table public.profiles
  add column if not exists pdf_downloads int not null default 0;

-- Consume one download slot if still under p_cap. SECURITY DEFINER so the guarded
-- UPDATE runs regardless of profiles RLS, scoped to the caller via auth.uid().
-- Returns { allowed, used, remaining }:
--   allowed=true  → a slot was consumed (used = the new running total)
--   allowed=false → the cap was already reached (nothing incremented)
create or replace function public.record_pdf_download(p_cap int)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user  uuid := auth.uid();
  v_count int;
begin
  if v_user is null then
    raise exception 'not authenticated';
  end if;

  -- Atomic: only increments while strictly under the cap, so racing clicks
  -- (or a double-submit) can't over-count past p_cap.
  update public.profiles
     set pdf_downloads = pdf_downloads + 1
   where id = v_user
     and pdf_downloads < p_cap
  returning pdf_downloads into v_count;

  if found then
    return jsonb_build_object(
      'allowed',   true,
      'used',      v_count,
      'remaining', greatest(p_cap - v_count, 0)
    );
  end if;

  -- Cap already reached — report current usage without incrementing.
  select pdf_downloads into v_count from public.profiles where id = v_user;
  return jsonb_build_object(
    'allowed',   false,
    'used',      coalesce(v_count, 0),
    'remaining', 0
  );
end;
$$;

grant execute on function public.record_pdf_download(int) to authenticated;
