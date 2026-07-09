-- ============================================================================
-- TNPSC Mentors — CA generator integration (see work/TNPSC/APP_INTEGRATION.md)
-- ----------------------------------------------------------------------------
-- An unattended VPS pipeline converts The Hindu print e-paper into:
--   • magazine items  → ca_magazine (day_wise every morning ~06:00 IST;
--     month_wise consolidation on the 1st) — INSERT-ONLY on external_id,
--     pushed with the service_role key.
--   • 240 bilingual MCQs/month → questions (category='current_affairs') —
--     relies on the questions_external_id_key unique index (in schema.sql).
--
-- Like materials / thirukural, ca_magazine is served only through the Express
-- layer: RLS is ON with NO policies, so anon/authenticated have no direct
-- access while the pipeline's and server's service-role clients bypass RLS.
-- Idempotent.
-- ============================================================================

create table if not exists public.ca_magazine (
  id           uuid primary key default gen_random_uuid(),
  -- ca-mag-<YYYY-MM-DD>-<NNN> (day_wise) / ca-mag-<YYYY-MM>-<NNNN> (month_wise);
  -- the pipeline dedupes on it (REST ?on_conflict=external_id, insert-only).
  external_id  text not null unique,
  category     text not null default 'current_affairs',
  ca_type      text not null check (ca_type in ('day_wise', 'month_wise')),
  date         date not null,             -- the paper's day; 1st for month_wise
  ca_month     text not null,             -- 'July 2026'
  ca_year      int  not null,
  topic        text not null,             -- UPPERCASE section label ('TNPSC BITS', …)
  title        text not null,
  title_ta     text,
  content      text not null,             -- markdown bullets; render as a list
  content_ta   text,
  source_url   text default 'the-hindu-print',
  created_at   timestamptz not null default now()
);

-- Daily feed reads by (ca_type, date); monthly compilation by (ca_type, ca_month).
create index if not exists ca_magazine_type_date_idx
  on public.ca_magazine (ca_type, date desc);
create index if not exists ca_magazine_type_month_idx
  on public.ca_magazine (ca_type, ca_month);

-- Lock the table: RLS on, no policies → only service-role clients (the Express
-- server and the pipeline) can touch it.
alter table public.ca_magazine enable row level security;

-- ─── Month picker source for /current-affairs ────────────────────────────────
-- Grouped month counts over the CA question bank so the app no longer needs a
-- hardcoded month list (a pipeline month appears the moment its rows land).
-- Groups by the label alone and derives the year from it when ca_year is null
-- (one such prod row existed), so a month can never split into two entries.
-- Chronological: year, then calendar month parsed from the 'July 2026' label.
create or replace function public.ca_month_counts()
returns table(ca_month text, ca_year int, total bigint)
language sql
security definer
stable
set search_path = public
as $$
  select q.ca_month,
         max(coalesce(q.ca_year, nullif(split_part(q.ca_month, ' ', 2), '')::int)) as ca_year,
         count(*)
  from public.questions q
  where q.category = 'current_affairs'
    and q.ca_type = 'month_wise'
    and q.ca_month is not null
  group by q.ca_month
  order by 2,
    array_position(
      array['January','February','March','April','May','June',
            'July','August','September','October','November','December'],
      split_part(q.ca_month, ' ', 1));
$$;

grant execute on function public.ca_month_counts() to authenticated;
