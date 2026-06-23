-- ============================================================================
-- TNPSC Mentors — Topic Revision (study-gate + similar-question re-tests)
-- ----------------------------------------------------------------------------
-- A topic-level revision layer that sits ON TOP of the per-question SRS deck
-- (review_items). When a learner finishes a topic test below the pass mark, the
-- topic is auto-saved here, the re-test is LOCKED until they've had ~12 hours of
-- *awake* time to study (sleep hours 23:00–07:00 IST don't count — the unlock
-- timestamp is computed in Node and stored, so this table needs no timezone
-- math and no cron), and the re-test serves SIMILAR (not identical) questions by
-- excluding the ids already seen. Once a re-test scores >= the pass mark the row
-- is cleared. One row per (user, topic scope); idempotent / re-runnable.
--
-- Pass mark = 40 (a score <= 40 needs revision; only > 40 clears). Mirror this
-- in the API layer (server/src/routes/tests.ts) — kept out of the DB so the
-- threshold lives in one obvious place per layer.
-- ============================================================================

create table if not exists public.revision_topics (
  id              uuid primary key default uuid_generate_v4(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  topic_key       text not null,                      -- stable hash of the scope (dedupe)
  config          jsonb not null,                     -- QuizConfig scope to regenerate similar tests
  label           text,                               -- "Subject • Topic • Type" heading
  first_score     numeric not null default 0,         -- score the first time it was flagged
  last_score      numeric not null default 0,         -- most recent attempt
  best_score      numeric not null default 0,         -- best attempt so far
  attempts        int     not null default 0,         -- times this topic has been (re)tested
  seen_ids        uuid[]  not null default '{}',      -- already-served questions (exclude => "similar")
  available_at    timestamptz not null default now(), -- when the re-test unlocks (awake-hours aware)
  cleared_at      timestamptz,                         -- set once a re-test scores >= pass mark
  dismissed_at    timestamptz,                         -- user removed it from the tab
  last_session_id uuid,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (user_id, topic_key)
);

-- Hot set = a user's still-open (not cleared, not dismissed) revisions, ordered
-- by unlock time. Partial index keeps it tiny even with 100k+ users.
create index if not exists idx_revision_user_open
  on public.revision_topics (user_id, available_at)
  where cleared_at is null and dismissed_at is null;

alter table public.revision_topics enable row level security;

drop policy if exists "manage own revision_topics" on public.revision_topics;
create policy "manage own revision_topics"
  on public.revision_topics for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

grant select, insert, update, delete on public.revision_topics to authenticated;

-- ─── Helper: merge + de-dupe + cap the seen-question list ────────────────────
-- Keeps the most recent 400 distinct ids (newest at the end of the input).
create or replace function public._revision_merge_seen(p_old uuid[], p_new uuid[])
returns uuid[]
language sql
immutable
as $$
  select coalesce(array_agg(id order by rn), '{}'::uuid[])
  from (
    select id, max(rn) as rn
    from unnest(coalesce(p_old, '{}'::uuid[]) || coalesce(p_new, '{}'::uuid[]))
         with ordinality as u(id, rn)
    group by id
    order by max(rn) desc
    limit 400
  ) s;
$$;

-- ─── Upsert: flag / re-flag a weak topic ────────────────────────────────────
-- Called after a topic test scores below the pass mark. Inserts a new row or, if
-- the same topic scope already exists, records the new attempt (resets the
-- study gate, bumps attempts, merges seen ids, and un-clears / un-dismisses it).
create or replace function public.upsert_revision_topic(
  p_topic_key    text,
  p_config       jsonb,
  p_label        text,
  p_score        numeric,
  p_session_id   uuid,
  p_seen_ids     uuid[],
  p_available_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_row  public.revision_topics%rowtype;
begin
  if v_user is null then raise exception 'not authenticated'; end if;

  insert into public.revision_topics (
    user_id, topic_key, config, label,
    first_score, last_score, best_score, attempts,
    seen_ids, available_at, last_session_id, updated_at
  ) values (
    v_user, p_topic_key, p_config, p_label,
    p_score, p_score, p_score, 1,
    coalesce(p_seen_ids, '{}'::uuid[]), p_available_at, p_session_id, now()
  )
  on conflict (user_id, topic_key) do update set
    config          = excluded.config,
    label           = excluded.label,
    last_score      = excluded.last_score,
    best_score      = greatest(public.revision_topics.best_score, excluded.last_score),
    attempts        = public.revision_topics.attempts + 1,
    seen_ids        = public._revision_merge_seen(public.revision_topics.seen_ids, excluded.seen_ids),
    available_at    = excluded.available_at,
    cleared_at      = null,
    dismissed_at    = null,
    last_session_id = excluded.last_session_id,
    updated_at      = now()
  returning * into v_row;

  return jsonb_build_object(
    'id', v_row.id,
    'status', 'locked',
    'available_at', v_row.available_at,
    'label', v_row.label,
    'attempts', v_row.attempts
  );
end;
$$;

-- ─── Clear: a re-test passed ────────────────────────────────────────────────
create or replace function public.clear_revision_topic(p_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_n int;
begin
  if v_user is null then raise exception 'not authenticated'; end if;
  update public.revision_topics
     set cleared_at = now(), updated_at = now()
   where id = p_id and user_id = v_user and cleared_at is null;
  get diagnostics v_n = row_count;
  return v_n > 0;
end;
$$;

-- ─── Dismiss: user removes a revision from the tab ──────────────────────────
create or replace function public.dismiss_revision_topic(p_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_n int;
begin
  if v_user is null then raise exception 'not authenticated'; end if;
  update public.revision_topics
     set dismissed_at = now(), updated_at = now()
   where id = p_id and user_id = v_user;
  get diagnostics v_n = row_count;
  return v_n > 0;
end;
$$;

-- ─── List: a user's revisions with a derived status ─────────────────────────
-- status is computed from now() vs available_at, so 'locked' flips to
-- 'available' purely by the passage of time — no background job needed.
create or replace function public.list_revision_topics()
returns table (
  id uuid, topic_key text, config jsonb, label text,
  first_score numeric, last_score numeric, best_score numeric, attempts int,
  available_at timestamptz, cleared_at timestamptz, last_session_id uuid,
  created_at timestamptz, status text
)
language sql
security definer
stable
set search_path = public
as $$
  select
    r.id, r.topic_key, r.config, r.label,
    r.first_score, r.last_score, r.best_score, r.attempts,
    r.available_at, r.cleared_at, r.last_session_id,
    r.created_at,
    case
      when r.cleared_at is not null then 'cleared'
      when now() >= r.available_at  then 'available'
      else 'locked'
    end as status
  from public.revision_topics r
  where r.user_id = auth.uid()
    and r.dismissed_at is null
  order by
    (r.cleared_at is not null),                                                  -- open before cleared
    (case when r.cleared_at is null and now() < r.available_at then 1 else 0 end),-- available before locked
    r.available_at asc;
$$;

-- ─── Analytics: pure-SQL aggregates for the revision dashboard ──────────────
create or replace function public.revision_analytics()
returns jsonb
language sql
security definer
stable
set search_path = public
as $$
  with rows as (
    select
      r.*,
      case
        when r.cleared_at is not null then 'cleared'
        when now() >= r.available_at  then 'available'
        else 'locked'
      end as status,
      coalesce(
        nullif(r.config->>'subject', ''),
        nullif(r.config->>'ca_topic', ''),
        nullif(r.config->>'aptitude_topic', ''),
        'General'
      ) as subject_key
    from public.revision_topics r
    where r.user_id = auth.uid()
      and r.dismissed_at is null
  ),
  by_subject as (
    select subject_key as subject,
           count(*)::int as count,
           round(avg(last_score))::int as avg_score
    from rows
    group by subject_key
    order by avg(last_score) asc, count(*) desc
  ),
  focus as (
    select id, label, last_score, best_score, attempts, status
    from rows
    where status <> 'cleared'
    order by best_score asc, attempts desc
    limit 5
  )
  select jsonb_build_object(
    'total',          (select count(*) from rows),
    'cleared',        (select count(*) from rows where status = 'cleared'),
    'pending',        (select count(*) from rows where status <> 'cleared'),
    'available_now',  (select count(*) from rows where status = 'available'),
    'locked',         (select count(*) from rows where status = 'locked'),
    'total_attempts', (select coalesce(sum(attempts), 0)::int from rows),
    'avg_last_score', (select coalesce(round(avg(last_score)), 0)::int from rows),
    'avg_best_score', (select coalesce(round(avg(best_score)), 0)::int from rows),
    -- improvement = avg gain from the first flagged score to the latest, over
    -- topics that have been re-tested at least once. Positive = improving.
    'improvement',    (select coalesce(round(avg(last_score - first_score)), 0)::int
                       from rows where attempts > 1),
    'by_subject',     coalesce((select jsonb_agg(to_jsonb(by_subject)) from by_subject), '[]'::jsonb),
    'focus',          coalesce((select jsonb_agg(to_jsonb(focus)) from focus), '[]'::jsonb)
  );
$$;

grant execute on function public.upsert_revision_topic(text, jsonb, text, numeric, uuid, uuid[], timestamptz) to authenticated;
grant execute on function public.clear_revision_topic(uuid)    to authenticated;
grant execute on function public.dismiss_revision_topic(uuid)  to authenticated;
grant execute on function public.list_revision_topics()        to authenticated;
grant execute on function public.revision_analytics()          to authenticated;

-- ─── Extend get_quiz_questions: exclude already-seen questions ──────────────
-- Adds support for p_config->'exclude_ids' (a JSON array of question uuids) so a
-- revision re-test serves SIMILAR questions from the same scope without
-- repeating the ones already attempted. (Kept in sync with secure.sql.)
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
  -- Unseen first; among seen, longest-ago first; random within each group.
  order by (sq.question_id is not null), sq.seen_at asc nulls first, random()
  limit (select lim from cfg);
$$;

grant execute on function public.get_quiz_questions(jsonb) to authenticated;
