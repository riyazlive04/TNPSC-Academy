-- ============================================================================
-- TNPSC Mentors — Flashcards ("Instants")
-- ----------------------------------------------------------------------------
-- A story-style flashcard layer: subject decks surfaced as tappable avatars on
-- the dashboard, opened as a full-screen card viewer. Each card is a plain
-- question -> answer pair with a difficulty tag; there are no options and no
-- scoring - the learner self-assesses by swiping ("Knew it" / "Need to study").
--
-- --- How this rides on the existing SRS ------------------------------------
-- Flashcard outcomes are stored in the SAME `review_items` deck the MCQ spaced
-- revision uses, on the SAME SM-2-lite curve (intervals 1,3,7,16,35,75), so a
-- card the learner keeps missing keeps coming back.
--
-- It could NOT go through `grade_review` itself, for two hard reasons:
--   1. `review_items.question_id` is a FK to `questions(id)`, and grade_review
--      reads `questions.correct_answer` for the item. A flashcard is not a row
--      in `questions`, so it fails the FK and finds no answer key.
--   2. grade_review's verdict is `p_selected = correct_answer` - it grades a
--      submitted OPTION LETTER. A swipe is a self-assessment; the client has no
--      letter to send, and by design never holds the answer key to derive one.
-- So `review_items` grows a nullable `flashcard_item_id` and this file adds a
-- sibling RPC, `grade_flashcard(item, knew)`, that applies the identical curve.
-- grade_review is left untouched and remains the only path for MCQ reviews.
--
-- The MCQ revision screen is unaffected: `get_due_reviews` INNER JOINs
-- `questions` on `review_items.question_id`, so flashcard rows (question_id
-- NULL) can never appear in it.
--
-- Content is curated server-side (service-role writes, like materials); the
-- browser gets read-only access to ACTIVE rows. Unlike the question bank there
-- is no answer key to withhold - the answer is the back of the card.
-- Idempotent.
-- ============================================================================

-- --- Decks ------------------------------------------------------------------
-- One deck = one subject's avatar in the dashboard tray.
create table if not exists public.flashcard_decks (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,          -- stable import/deep-link key
  subject     text not null,                 -- canonical bank subject (drives the icon)
  title_en    text not null,
  title_ta    text,
  -- The one-line hook rendered in the floating speech bubble above the avatar.
  teaser_en   text,
  teaser_ta   text,
  -- Optional explicit subject-icon slug; null lets src/lib/subjectIcons.ts
  -- resolve it from `subject`, and the UI falls back to a Lucide glyph.
  icon_slug   text,
  sort_order  int not null default 0,        -- ascending; ties broken by title
  active      boolean not null default true, -- hidden from the tray when false
  created_at  timestamptz not null default now()
);

-- --- Cards ------------------------------------------------------------------
create table if not exists public.flashcard_items (
  id           uuid primary key default gen_random_uuid(),
  deck_id      uuid not null references public.flashcard_decks(id) on delete cascade,
  -- Stable import key so re-running a loader UPDATEs in place instead of
  -- delete+reinsert - review_items FKs this table and would lose user history.
  external_id  text unique,
  question_en  text not null,
  question_ta  text,
  answer_en    text not null,
  answer_ta    text,
  difficulty   text not null default 'medium'
                 check (difficulty in ('medium', 'hard-medium', 'hard')),
  sort_order   int not null default 0,
  active       boolean not null default true,
  created_at   timestamptz not null default now()
);

create index if not exists idx_flashcard_items_deck
  on public.flashcard_items(deck_id, sort_order);

-- --- review_items grows a second kind of target -----------------------------
-- `question_id` was already nullable. A row now points at EITHER a question
-- (MCQ revision) or a flashcard item - never both, never neither.
alter table public.review_items
  add column if not exists flashcard_item_id uuid
    references public.flashcard_items(id) on delete cascade;

-- NOT VALID: enforced for every new/updated row, but existing rows are not
-- re-checked, so this can never fail on a drifted production table.
alter table public.review_items
  drop constraint if exists review_items_target_ck;
alter table public.review_items
  add constraint review_items_target_ck
  check (num_nonnulls(question_id, flashcard_item_id) = 1) not valid;

-- One review row per (user, card). Partial, because the MCQ half of the table
-- leaves this column NULL and NULLs must stay non-colliding.
create unique index if not exists uq_review_items_user_flashcard
  on public.review_items(user_id, flashcard_item_id)
  where flashcard_item_id is not null;

-- --- RLS --------------------------------------------------------------------
-- Read-only for learners, and only for live content. Writes have no policy at
-- all, so they are reachable exclusively by the service-role key the Express
-- layer holds (same posture as materials / app_releases).
alter table public.flashcard_decks enable row level security;
alter table public.flashcard_items enable row level security;

drop policy if exists "read active flashcard decks" on public.flashcard_decks;
create policy "read active flashcard decks"
  on public.flashcard_decks for select to authenticated
  using (active);

drop policy if exists "read active flashcard items" on public.flashcard_items;
create policy "read active flashcard items"
  on public.flashcard_items for select to authenticated
  using (
    active and exists (
      select 1 from public.flashcard_decks d
      where d.id = flashcard_items.deck_id and d.active
    )
  );

grant select on public.flashcard_decks to authenticated;
grant select on public.flashcard_items to authenticated;

-- --- get_flashcard_decks: the dashboard tray --------------------------------
-- Every live deck with its size and how much of it is waiting for this user.
-- `due_count` = cards never swiped yet + cards the SRS has brought back round.
create or replace function public.get_flashcard_decks()
returns table (
  id uuid, slug text, subject text,
  title_en text, title_ta text, teaser_en text, teaser_ta text,
  icon_slug text, sort_order int,
  card_count bigint, due_count bigint, started_count bigint
)
language sql
security definer
stable
set search_path = public
as $$
  select d.id, d.slug, d.subject, d.title_en, d.title_ta, d.teaser_en, d.teaser_ta,
         d.icon_slug, d.sort_order,
         count(i.id) as card_count,
         count(*) filter (
           where i.id is not null and (r.id is null or r.due_at <= now())
         ) as due_count,
         count(r.id) as started_count
  from public.flashcard_decks d
  left join public.flashcard_items i
         on i.deck_id = d.id and i.active
  left join public.review_items r
         on r.flashcard_item_id = i.id and r.user_id = auth.uid()
  where d.active
  group by d.id
  order by d.sort_order asc, d.title_en asc;
$$;

-- --- get_flashcard_deck: the cards of one deck, with their SRS state --------
-- due_at NULL means "never swiped". The viewer leads with everything due.
create or replace function public.get_flashcard_deck(p_deck_id uuid)
returns table (
  id uuid, question_en text, question_ta text, answer_en text, answer_ta text,
  difficulty text, sort_order int,
  reps int, interval_days int, due_at timestamptz, last_result text
)
language sql
security definer
stable
set search_path = public
as $$
  select i.id, i.question_en, i.question_ta, i.answer_en, i.answer_ta,
         i.difficulty, i.sort_order,
         coalesce(r.reps, 0), coalesce(r.interval_days, 0), r.due_at, r.last_result
  from public.flashcard_items i
  join public.flashcard_decks d on d.id = i.deck_id and d.active
  left join public.review_items r
         on r.flashcard_item_id = i.id and r.user_id = auth.uid()
  where i.deck_id = p_deck_id and i.active
  order by i.sort_order asc, i.created_at asc;
$$;

-- --- grade_flashcard: a swipe becomes a review ------------------------------
-- Right swipe ("Knew it")       -> p_knew = true  -> advance along the curve.
-- Left swipe  ("Need to study") -> p_knew = false -> reset; due again now.
--
-- Deliberately the same interval array, the same reps reset and the same
-- 'correct'/'wrong' vocabulary as grade_review, so both halves of the deck age
-- identically. The first swipe on a card also enrols it (there is no separate
-- enqueue step - a card enters the deck by being studied).
create or replace function public.grade_flashcard(p_item_id uuid, p_knew boolean)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_review uuid;
  v_reps int;
  v_interval int;
  v_due timestamptz;
  intervals int[] := array[1, 3, 7, 16, 35, 75];
begin
  if v_user is null then raise exception 'not authenticated'; end if;
  if p_knew is null then raise exception 'p_knew is required'; end if;

  -- A retired card (or one in a retired deck) can't be graded.
  if not exists (
    select 1
    from public.flashcard_items i
    join public.flashcard_decks d on d.id = i.deck_id
    where i.id = p_item_id and i.active and d.active
  ) then
    raise exception 'flashcard item not found';
  end if;

  -- Enrol on first contact. The WHERE mirrors the partial unique index so the
  -- conflict target resolves to it.
  insert into public.review_items (user_id, flashcard_item_id, due_at, interval_days, reps)
  values (v_user, p_item_id, now(), 0, 0)
  on conflict (user_id, flashcard_item_id) where flashcard_item_id is not null
  do nothing;

  select id, reps into v_review, v_reps
  from public.review_items
  where user_id = v_user and flashcard_item_id = p_item_id;

  if p_knew then
    v_interval := intervals[least(v_reps, array_length(intervals, 1) - 1) + 1];
    v_reps := v_reps + 1;
  else
    v_interval := 0;
    v_reps := 0;
  end if;

  v_due := now() + make_interval(days => v_interval);

  update public.review_items
  set reps = v_reps,
      interval_days = v_interval,
      last_result = case when p_knew then 'correct' else 'wrong' end,
      due_at = v_due
  where id = v_review and user_id = v_user;

  return jsonb_build_object(
    'ok',            true,
    'knew',          p_knew,
    'reps',          v_reps,
    'interval_days', v_interval,
    'due_at',        v_due
  );
end;
$$;

grant execute on function public.get_flashcard_decks()          to authenticated;
grant execute on function public.get_flashcard_deck(uuid)       to authenticated;
grant execute on function public.grade_flashcard(uuid, boolean) to authenticated;
