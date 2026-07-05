-- ─── Email registration lookup ───────────────────────────────────────────────
-- One email = one account, and an email already registered through Google must
-- NOT be re-used for an email/password signup. This SECURITY DEFINER function
-- reads auth.users (which the service role can't reach via PostgREST) and reports
-- how an email is registered, so the /register route can block + message clearly.
--   returns 'none'     → not registered, signup may proceed
--           'google'   → a Google account owns it → tell them to sign in with Google
--           'password' → an email/password account owns it → tell them to sign in
-- Locked to the service role (the server mediates it) so it isn't an open
-- email-enumeration oracle for anon/authenticated callers.
create or replace function public.email_registration_status(p_email text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_meta jsonb;
begin
  if p_email is null or btrim(p_email) = '' then return 'none'; end if;
  select raw_app_meta_data into v_meta
    from auth.users
    where lower(email) = lower(btrim(p_email))
    limit 1;
  if v_meta is null then return 'none'; end if;
  if coalesce(v_meta->'providers', '[]'::jsonb) ? 'google'
     or v_meta->>'provider' = 'google' then
    return 'google';
  end if;
  return 'password';
end;
$$;

revoke execute on function public.email_registration_status(text) from public, anon, authenticated;
grant execute on function public.email_registration_status(text) to service_role;
