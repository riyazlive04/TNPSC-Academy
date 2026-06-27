-- ============================================================================
-- TNPSC Mentors — "don't show the same question twice" (per-user seen ledger)
-- ----------------------------------------------------------------------------
-- Every question served to a learner (practice quiz, subject/group mock, or a
-- revision re-test) is recorded here. The question-sampling RPCs then order
-- UNSEEN questions first, so a learner keeps getting fresh questions and only
-- starts seeing repeats once they've exhausted the unseen pool for that scope
-- (at which point the longest-ago-seen come back first). This is a soft
-- de-prioritisation, NOT a hard exclude — a hard exclude would make tests run
-- short/empty on small banks; this degrades seamlessly.
--
-- Scale (100k+ users): one row per (user, question). The composite PRIMARY KEY
-- (user_id, question_id) is exactly the index the LEFT JOIN probes, so the
-- per-candidate lookup is an index hit. Recording is insert-or-ignore, so a
-- question already seen costs nothing on subsequent fetches.
--
-- No-repeat cooldown: the 180 most-recently-seen questions are suppressed
-- (sunk to the very back of every draw), so a question the learner just saw
-- won't reappear until ~180 other questions have gone by. It's a soft sink,
-- NOT a hard exclude: if the fresh pool (unseen + seen-more-than-180-ago) can't
-- fill the requested count, the suppressed ones come back (longest-ago first)
-- rather than the test running short/empty on a small bank. The cutoff is the
-- seen_at of the user's 180th-newest seen row (null when they've seen <180,
-- i.e. every seen question is still within the window).
-- ============================================================================

create table if not exists public.seen_questions (
  user_id     uuid not null references auth.users(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete cascade,
  seen_at     timestamptz not null default now(),
  primary key (user_id, question_id)
);

alter table public.seen_questions enable row level security;

drop policy if exists "manage own seen_questions" on public.seen_questions;
create policy "manage own seen_questions"
  on public.seen_questions for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

grant select, insert, update, delete on public.seen_questions to authenticated;

-- The cooldown cutoff lookup orders one user's seen rows by seen_at desc and
-- skips to the 180th — a backwards index scan on (user_id, seen_at).
create index if not exists idx_seen_questions_user_seen_at
  on public.seen_questions (user_id, seen_at desc);

-- ─── Practice quiz sampler: unseen-first ordering (+ exclude_ids hard filter) ─
create or replace function public.get_quiz_questions(p_config jsonb)
returns table (
  id uuid, category text, group_type text, year integer, standard integer,
  ca_month text, ca_year integer, ca_type text, ca_topic text,
  aptitude_type text, aptitude_topic text, subject text, topic text,
  question_type text, external_id text,
  question_text text, option_a text, option_b text, option_c text, option_d text,
  difficulty text, images jsonb, source_tag text,
  question_text_ta text, option_a_ta text, option_b_ta text,
  option_c_ta text, option_d_ta text
)
language sql
security definer
stable
set search_path = public
as $$
  with cfg as (
    select
      p_config->>'category'                            as category,
      p_config->>'subject'                             as subject,
      (p_config->>'standard')::int                     as standard,
      p_config->>'topic'                               as topic,
      p_config->>'unit'                                as unit,
      p_config->>'question_type'                       as question_type,
      p_config->>'ca_type'                             as ca_type,
      p_config->>'ca_month'                            as ca_month,
      p_config->>'ca_topic'                            as ca_topic,
      p_config->>'aptitude_type'                       as aptitude_type,
      p_config->>'aptitude_topic'                      as aptitude_topic,
      coalesce((p_config->>'mock')::boolean, false)    as mock,
      coalesce((p_config->>'scopeToCategory')::boolean, false) as scope_to_category,
      case when p_config ? 'exclude_ids'
        then array(select (jsonb_array_elements_text(p_config->'exclude_ids'))::uuid)
        else null end                                  as exclude_ids,
      greatest(coalesce((p_config->>'limit')::int, 100), 1)    as lim
  ),
  -- Cooldown cutoff: seen_at of the caller's 180th-most-recent seen question.
  -- Null when they've seen fewer than 180 (so every seen question is still in
  -- the window). Uncorrelated → evaluated once (InitPlan), not per row.
  cd as (
    select seen_at as ts
    from public.seen_questions
    where user_id = auth.uid()
    order by seen_at desc
    offset 179 limit 1
  )
  select q.id, q.category, q.group_type, q.year, q.standard,
         q.ca_month, q.ca_year, q.ca_type, q.ca_topic,
         q.aptitude_type, q.aptitude_topic, q.subject, q.topic,
         q.question_type, q.external_id,
         q.question_text, q.option_a, q.option_b, q.option_c, q.option_d,
         q.difficulty, q.images, q.source_tag,
         q.question_text_ta, q.option_a_ta, q.option_b_ta,
         q.option_c_ta, q.option_d_ta
  from public.questions q
  cross join cfg
  left join public.seen_questions sq
    on sq.question_id = q.id and sq.user_id = auth.uid()
  where
    q.active
    and (q.category <> 'outer' or cfg.category = 'outer')
    and case when cfg.mock
      then (not cfg.scope_to_category or q.category = cfg.category)
      else q.category = cfg.category
    end
    and (cfg.mock or cfg.subject        is null or q.subject        = cfg.subject)
    and (cfg.mock or cfg.standard       is null or q.standard       = cfg.standard)
    and (cfg.mock or cfg.topic          is null or q.topic          = cfg.topic)
    and (cfg.mock or cfg.unit           is null or q.unit           = cfg.unit)
    and (cfg.mock or cfg.question_type  is null or q.question_type  = cfg.question_type)
    and (cfg.mock or cfg.ca_type        is null or q.ca_type        = cfg.ca_type)
    and (cfg.mock or cfg.ca_month       is null or q.ca_month       = cfg.ca_month)
    and (cfg.mock or cfg.ca_topic       is null or q.ca_topic       = cfg.ca_topic)
    and (cfg.mock or cfg.aptitude_type  is null or q.aptitude_type  = cfg.aptitude_type)
    and (cfg.mock or cfg.aptitude_topic is null or q.aptitude_topic = cfg.aptitude_topic)
    and (cfg.exclude_ids is null or not (q.id = any(cfg.exclude_ids)))
  -- 1) Cooldown: questions seen within the last 180 sink to the very back (only
  --    used to top up when the fresh pool is too small to fill the count).
  -- 2) Among the fresh pool, unseen first; 3) then longest-ago-seen; 4) random.
  order by
    (sq.question_id is not null
       and ((select ts from cd) is null or sq.seen_at >= (select ts from cd))),
    (sq.question_id is not null),
    sq.seen_at asc nulls first,
    random()
  limit (select lim from cfg);
$$;

-- ─── Subject/topic mock sampler: unseen-first ordering ──────────────────────
create or replace function public.subject_mock_questions(
  p_subject text, p_topic text, p_difficulty text, p_count int
)
returns table (
  id uuid, category text, group_type text, year integer, standard integer,
  ca_month text, ca_year integer, ca_type text, ca_topic text,
  aptitude_type text, aptitude_topic text, subject text, topic text,
  question_type text, external_id text,
  question_text text, option_a text, option_b text, option_c text, option_d text,
  difficulty text, images jsonb,
  question_text_ta text, option_a_ta text, option_b_ta text,
  option_c_ta text, option_d_ta text
)
language sql
security definer
stable
set search_path = public
as $$
  with cd as (
    select seen_at as ts
    from public.seen_questions
    where user_id = auth.uid()
    order by seen_at desc
    offset 179 limit 1
  )
  select q.id, q.category, q.group_type, q.year, q.standard,
         q.ca_month, q.ca_year, q.ca_type, q.ca_topic,
         q.aptitude_type, q.aptitude_topic, q.subject, q.topic,
         q.question_type, q.external_id,
         q.question_text, q.option_a, q.option_b, q.option_c, q.option_d,
         q.difficulty, q.images,
         q.question_text_ta, q.option_a_ta, q.option_b_ta,
         q.option_c_ta, q.option_d_ta
  from public.questions q
  left join public.seen_questions sq
    on sq.question_id = q.id and sq.user_id = auth.uid()
  where q.category = 'subject' and q.active
    and (p_subject    is null or q.subject    = p_subject)
    and (p_topic      is null or q.topic      = p_topic)
    and (p_difficulty is null or q.difficulty = p_difficulty)
  -- Cooldown sink (last 180 seen) → unseen first → longest-ago-seen → random.
  order by
    (sq.question_id is not null
       and ((select ts from cd) is null or sq.seen_at >= (select ts from cd))),
    (sq.question_id is not null),
    sq.seen_at asc nulls first,
    random()
  limit greatest(least(coalesce(p_count, 50), 200), 1);
$$;

-- ─── Group-exam slot sampler: unseen-first ordering ─────────────────────────
create or replace function public.mock_slot_questions(p_queries jsonb, p_count int)
returns table (
  id uuid, category text, group_type text, year integer, standard integer,
  ca_month text, ca_year integer, ca_type text, ca_topic text,
  aptitude_type text, aptitude_topic text, subject text, topic text,
  question_type text, external_id text,
  question_text text, option_a text, option_b text, option_c text, option_d text,
  difficulty text, images jsonb,
  question_text_ta text, option_a_ta text, option_b_ta text,
  option_c_ta text, option_d_ta text
)
language sql
security definer
stable
set search_path = public
as $$
  with cd as (
    select seen_at as ts
    from public.seen_questions
    where user_id = auth.uid()
    order by seen_at desc
    offset 179 limit 1
  )
  select q.id, q.category, q.group_type, q.year, q.standard,
         q.ca_month, q.ca_year, q.ca_type, q.ca_topic,
         q.aptitude_type, q.aptitude_topic, q.subject, q.topic,
         q.question_type, q.external_id,
         q.question_text, q.option_a, q.option_b, q.option_c, q.option_d,
         q.difficulty, q.images,
         q.question_text_ta, q.option_a_ta, q.option_b_ta,
         q.option_c_ta, q.option_d_ta
  from public.questions q
  left join public.seen_questions sq
    on sq.question_id = q.id and sq.user_id = auth.uid()
  where q.active
    and exists (
      select 1
      from jsonb_array_elements(p_queries) elem
      where q.category = elem->>'category'
        and (
          jsonb_typeof(elem->'subjects') is distinct from 'array'
          or q.subject = any (
            select jsonb_array_elements_text(elem->'subjects')
          )
        )
    )
  -- Cooldown sink (last 180 seen) → unseen first → longest-ago-seen → random.
  order by
    (sq.question_id is not null
       and ((select ts from cd) is null or sq.seen_at >= (select ts from cd))),
    (sq.question_id is not null),
    sq.seen_at asc nulls first,
    random()
  limit greatest(coalesce(p_count, 0), 0);
$$;

grant execute on function public.get_quiz_questions(jsonb)                       to authenticated;
grant execute on function public.subject_mock_questions(text, text, text, int)   to authenticated;
grant execute on function public.mock_slot_questions(jsonb, int)                 to authenticated;
