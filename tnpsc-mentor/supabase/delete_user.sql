-- ============================================================================
-- TNPSC Mentors — Superadmin: hard-delete a user (cascade everything)
-- ----------------------------------------------------------------------------
-- Run AFTER schema.sql. The server deletes the account via the GoTrue admin API
-- (supabaseAdmin.auth.admin.deleteUser), which removes the auth.users row. Every
-- user-owned table already references auth.users(id) ON DELETE CASCADE — EXCEPT
-- profiles, whose FK was created without it (schema.sql), so the auth delete
-- would be blocked by the lingering profile row.
--
-- This migration adds ON DELETE CASCADE to profiles.id so a single auth-user
-- delete tears down the profile + all dependent rows atomically. Idempotent.
-- ============================================================================

alter table public.profiles drop constraint if exists profiles_id_fkey;
alter table public.profiles
  add constraint profiles_id_fkey
    foreign key (id) references auth.users(id) on delete cascade;
