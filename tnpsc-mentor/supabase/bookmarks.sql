-- ============================================================================
-- TNPSC Mentor — Bookmarks (save questions to study later)
-- ----------------------------------------------------------------------------
-- Run AFTER schema.sql + secure.sql. Users can save any question and review it
-- later (with the answer + explanation revealed — these are deliberate study
-- material, not a test). Idempotent.
-- ============================================================================

create table if not exists public.bookmarks (
  user_id     uuid references auth.users(id) on delete cascade,
  question_id uuid references public.questions(id) on delete cascade,
  created_at  timestamptz default now(),
  primary key (user_id, question_id)
);

create index if not exists idx_bookmarks_user on public.bookmarks(user_id, created_at desc);

alter table public.bookmarks enable row level security;

drop policy if exists "Users manage own bookmarks" on public.bookmarks;
create policy "Users manage own bookmarks"
  on public.bookmarks for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

grant select, insert, delete on public.bookmarks to authenticated;

-- ─── List the user's saved questions, with answers revealed ──────────────────
-- SECURITY DEFINER so it can return the answer/explanation columns (which the
-- column-level grant hides from direct queries) — scoped strictly to the
-- caller's own bookmarks.
create or replace function public.get_bookmarks()
returns setof public.questions
language sql
security definer
stable
set search_path = public
as $$
  select q.*
  from public.bookmarks b
  join public.questions q on q.id = b.question_id
  where b.user_id = auth.uid()
  order by b.created_at desc;
$$;

grant execute on function public.get_bookmarks() to authenticated;
