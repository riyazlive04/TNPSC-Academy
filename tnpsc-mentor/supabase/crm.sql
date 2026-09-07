-- ============================================================================
-- TNPSC Mentors — Telecaller CRM (/crm)
-- ----------------------------------------------------------------------------
-- A staff-facing lead desk for the people who phone cold lists and call back
-- fresh signups. Three tables and a 4th role:
--
--   crm_intents       superadmin-defined intent categories ("Will join next
--                     month", "Wants demo", "Wrong number", …). Editable from
--                     the console so the taxonomy changes without a redeploy.
--   crm_leads         one row per callable person. Either mirrors an app
--                     account (source='signup', user_id set — filed by trigger
--                     the moment a profile is created) or is a cold record
--                     imported by a superadmin (source='import'|'manual').
--   crm_interactions  every touch. kind='click' rows are fired by the tel: /
--                     wa.me / mailto: links themselves (that is what makes
--                     "calls today per agent" countable); kind='outcome' rows
--                     are the agent's logged intent + notes.
--
-- The `telecaller` role is a FOURTH tier that sits OUTSIDE the
-- superadmin ⊃ admin ⊃ user hierarchy: it grants the CRM and nothing else.
-- is_admin() is deliberately NOT widened for it.
--
-- Like `notifications` / `user_messages`, RLS is ON with NO policies: every
-- read/write goes through the Express server on the service-role client, which
-- does its own role checks (requireCrmStaff / requireSuperadmin).
--
-- RLS alone is what stops PostgREST here, because the self-hosted stack's
-- ALTER DEFAULT PRIVILEGES hands `anon` and `authenticated` a blanket
-- GRANT ALL on every new table in `public` (verified on prod 2026-09-07 —
-- notifications, payments and user_messages all carry it too). Section 9 takes
-- those grants back for the crm_ tables specifically: this is the one place in
-- the schema where every student's phone and email sit in a single list built
-- to be dialled, so it should not be one loosened policy away from readable.
--
-- Idempotent: safe to re-run. Run with:
--   node run-migration.mjs ../supabase/crm.sql
-- ============================================================================

-- ─── 1. The telecaller role ─────────────────────────────────────────────────
-- Widen the CHECK last set by superadmin.sql. Deliberately does NOT touch
-- is_admin(): a telecaller must not inherit the question editor, the admin
-- report triage, or anything else behind an admin gate.
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check
  check (role in ('user', 'admin', 'superadmin', 'telecaller'));

create or replace function public.is_telecaller()
returns boolean as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'telecaller'
  );
$$ language sql security definer stable;

-- Anyone who may open /crm: the telecallers themselves plus admins and
-- superadmins (who supervise, assign and audit).
create or replace function public.is_crm_staff()
returns boolean as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('telecaller', 'admin', 'superadmin')
  );
$$ language sql security definer stable;

-- superadmin_set_role() hard-codes its own allow-list; re-declare it here so a
-- superadmin can actually appoint a telecaller from the console. Everything
-- else (last-superadmin protection, the is_superadmin() gate) is unchanged.
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
  if p_role not in ('user', 'admin', 'superadmin', 'telecaller') then
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

-- ─── 2. Intent categories ───────────────────────────────────────────────────
-- `outcome` is what the intent MEANS to the pipeline, so logging an intent can
-- move the lead's status without the agent picking a status separately.
create table if not exists public.crm_intents (
  id          uuid primary key default uuid_generate_v4(),
  label       text not null,
  label_ta    text,
  outcome     text not null default 'neutral'
              check (outcome in ('interested', 'callback', 'converted', 'not_interested', 'unreachable', 'neutral')),
  -- Tailwind-ish token name the chip renders with; validated app-side.
  color       text not null default 'slate',
  sort_order  int  not null default 0,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

create index if not exists idx_crm_intents_order
  on public.crm_intents (active, sort_order, created_at);

alter table public.crm_intents enable row level security;

-- Seed a usable starter taxonomy once (only when the table is empty, so a
-- re-run never resurrects an intent a superadmin deleted).
insert into public.crm_intents (label, label_ta, outcome, color, sort_order)
select * from (values
  ('Interested — will buy',      'ஆர்வம் — வாங்குவார்',        'interested',     'emerald', 10),
  ('Wants a call back',          'மீண்டும் அழைக்கச் சொன்னார்',  'callback',       'amber',   20),
  ('Purchased',                  'வாங்கிவிட்டார்',              'converted',      'violet',  30),
  ('Price is too high',          'விலை அதிகம்',                 'not_interested', 'rose',    40),
  ('Preparing on their own',     'சொந்தமாகப் படிக்கிறார்',      'not_interested', 'rose',    50),
  ('Not answering',              'பதில் இல்லை',                 'unreachable',    'slate',   60),
  ('Wrong / invalid number',     'தவறான எண்',                   'unreachable',    'slate',   70),
  ('Just exploring the app',     'செயலியைப் பார்க்கிறார்',      'neutral',        'sky',     80)
) as seed(label, label_ta, outcome, color, sort_order)
where not exists (select 1 from public.crm_intents);

-- ─── 3. Leads ───────────────────────────────────────────────────────────────
create table if not exists public.crm_leads (
  id                uuid primary key default uuid_generate_v4(),
  -- Set for leads that ARE app accounts (every signup). Null for cold imports.
  -- ON DELETE SET NULL, not CASCADE: a deleted account must not silently erase
  -- the call history the team built against it (see ca-update-inplace lesson).
  user_id           uuid references auth.users(id) on delete set null,

  full_name         text,
  -- Bare 10-digit Indian mobile, normalised on write. This is what the dialer
  -- link and the dedupe index key on.
  phone             text,
  -- Usually the same as `phone`; kept separate because a lead can hand over a
  -- different WhatsApp number.
  whatsapp          text,
  email             text,
  city              text,
  target_group      text,

  source            text not null default 'signup'
                    check (source in ('signup', 'import', 'manual', 'backfill')),
  -- Free text: the CSV batch name, campaign, or ad set a cold lead came from.
  source_detail     text,

  status            text not null default 'new'
                    check (status in ('new', 'in_progress', 'follow_up', 'converted', 'not_interested', 'unreachable', 'invalid')),
  -- The most recently logged intent (the full history lives in crm_interactions).
  intent_id         uuid references public.crm_intents(id) on delete set null,

  assigned_to       uuid references auth.users(id) on delete set null,
  assigned_at       timestamptz,

  -- The response timer. first_response_at is stamped by the FIRST contact
  -- attempt of any channel; first_response_secs freezes how long that took so
  -- reporting never has to re-derive it.
  first_response_at    timestamptz,
  first_response_secs  int,

  last_contacted_at timestamptz,
  next_follow_up_at timestamptz,
  attempts          int not null default 0,
  notes             text,

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- One lead per account, and one per phone number — a cold import must merge
-- into the signup row rather than create a duplicate someone calls twice.
create unique index if not exists idx_crm_leads_user
  on public.crm_leads (user_id) where user_id is not null;
create unique index if not exists idx_crm_leads_phone
  on public.crm_leads (phone) where phone is not null and phone <> '';

-- The three queue reads: the unclaimed pool (newest first), an agent's own
-- desk, and follow-ups coming due.
create index if not exists idx_crm_leads_pool
  on public.crm_leads (created_at desc) where assigned_to is null;
create index if not exists idx_crm_leads_agent
  on public.crm_leads (assigned_to, status, created_at desc);
create index if not exists idx_crm_leads_followup
  on public.crm_leads (next_follow_up_at) where next_follow_up_at is not null;

alter table public.crm_leads enable row level security;

create or replace function public.crm_touch_updated_at()
returns trigger as $$
begin
  new.updated_at := now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_crm_leads_updated on public.crm_leads;
create trigger trg_crm_leads_updated
  before update on public.crm_leads
  for each row execute function public.crm_touch_updated_at();

-- ─── 4. Interactions ────────────────────────────────────────────────────────
-- kind='click'   : the agent tapped Call / WhatsApp / Email. Fired by the link
--                  itself, which is what makes daily call volume countable
--                  without trusting the agent to log every attempt.
-- kind='outcome' : the agent recorded what happened (intent + notes).
create table if not exists public.crm_interactions (
  id              uuid primary key default uuid_generate_v4(),
  lead_id         uuid not null references public.crm_leads(id) on delete cascade,
  agent_id        uuid references auth.users(id) on delete set null,
  kind            text not null check (kind in ('click', 'outcome', 'system')),
  channel         text not null default 'call'
                  check (channel in ('call', 'whatsapp', 'email', 'sms', 'note', 'system')),
  intent_id       uuid references public.crm_intents(id) on delete set null,
  status_after    text,
  notes           text,
  duration_secs   int,
  -- IST calendar day the touch belongs to, frozen at write time so the daily
  -- volume report is a plain group-by and never re-derives a timezone.
  day_ist         date not null default ((now() at time zone 'Asia/Kolkata')::date),
  created_at      timestamptz not null default now()
);

create index if not exists idx_crm_interactions_lead
  on public.crm_interactions (lead_id, created_at desc);
-- The per-agent daily report reads exactly this shape.
create index if not exists idx_crm_interactions_agent_day
  on public.crm_interactions (agent_id, day_ist, kind, channel);

alter table public.crm_interactions enable row level security;

-- ─── 5. Fresh inbound leads: file one for every new signup ──────────────────
-- Runs on the profiles row, not auth.users, because that is where the name /
-- phone / target group actually land. Fires on INSERT and again on UPDATE so a
-- Google signup that fills its phone in later (via /complete-profile) enriches
-- the lead that was already filed for it.
--
-- Admins, superadmins and telecallers are staff, not leads — skipped.
create or replace function public.crm_lead_from_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_phone text;
  v_mine  uuid;   -- the lead already keyed to this account, if any
  v_other uuid;   -- a different lead already holding this phone number
  v_freed boolean := false;
begin
  -- Staff are not leads. An account promoted out of 'user' also gives up the
  -- lead that was filed for it while it was a student — unless a call has
  -- already been logged against it, in which case that history is worth more
  -- than the tidiness.
  if new.role is distinct from 'user' then
    delete from public.crm_leads l
     where l.user_id = new.id
       and not exists (select 1 from public.crm_interactions i where i.lead_id = l.id);
    return new;
  end if;

  -- Normalise to a bare 10-digit Indian mobile; anything else is stored as
  -- null so the unique index doesn't collide on junk.
  v_phone := nullif(regexp_replace(coalesce(new.phone, ''), '[^0-9]', '', 'g'), '');
  if v_phone is not null then
    v_phone := right(v_phone, 10);
    if v_phone !~ '^[6-9][0-9]{9}$' then
      v_phone := null;
    end if;
  end if;

  select l.id into v_mine from public.crm_leads l where l.user_id = new.id;

  if v_phone is not null then
    select l.id into v_other
      from public.crm_leads l
     where l.phone = v_phone
       and (l.user_id is null or l.user_id = new.id)
     limit 1;

    -- A cold-import row already holds this number: the same person, who has
    -- now signed up. Adopt it rather than leaving the team with two records of
    -- one human that two agents can call independently.
    --
    -- The obstacle is this account's OWN lead, filed by handle_new_user() at
    -- profile-insert time before any phone existed. It occupies the unique
    -- user_id index, so the adoption cannot happen until it is released — and
    -- it is only safe to release while nothing has been logged against it.
    if v_other is not null and v_other is distinct from v_mine then
      if v_mine is not null then
        delete from public.crm_leads l
         where l.id = v_mine
           and not exists (select 1 from public.crm_interactions i where i.lead_id = l.id);
        get diagnostics v_freed = row_count;
        if v_freed then v_mine := null; end if;
      end if;

      if v_mine is null then
        update public.crm_leads
           set user_id      = new.id,
               full_name    = coalesce(full_name, new.full_name),
               email        = coalesce(email, new.email),
               whatsapp     = coalesce(whatsapp, v_phone),
               target_group = coalesce(target_group, new.target_group)
         where id = v_other;
        return new;
      end if;
      -- Otherwise both rows carry call history. Leave them alone and let a
      -- human merge them; silently destroying either one is worse.
    end if;
  end if;

  insert into public.crm_leads
    (user_id, full_name, phone, whatsapp, email, target_group, source, created_at)
  values
    (new.id, new.full_name, v_phone, v_phone, new.email, new.target_group, 'signup', coalesce(new.created_at, now()))
  on conflict (user_id) where user_id is not null
  do update set
    -- Only ever fill gaps from the profile; never clobber what a telecaller
    -- corrected by hand on the lead.
    full_name    = coalesce(crm_leads.full_name, excluded.full_name),
    phone        = coalesce(crm_leads.phone, excluded.phone),
    whatsapp     = coalesce(crm_leads.whatsapp, excluded.whatsapp),
    email        = coalesce(crm_leads.email, excluded.email),
    target_group = coalesce(crm_leads.target_group, excluded.target_group);

  return new;
exception
  -- A lead must NEVER be able to fail a signup. If anything above raises (a
  -- phone that races another row onto the unique index, say), swallow it: the
  -- account is created, and the superadmin backfill below can pick the lead up
  -- later.
  when others then
    return new;
end;
$$;

drop trigger if exists trg_crm_lead_from_profile on public.profiles;
create trigger trg_crm_lead_from_profile
  after insert or update of phone, full_name, email, target_group, role on public.profiles
  for each row execute function public.crm_lead_from_profile();

-- ─── 6. Backfill existing signups on demand ─────────────────────────────────
-- Deliberately NOT run automatically: dropping every historical account into
-- the unclaimed pool would bury the fresh leads the timer exists to protect.
-- The superadmin console calls this with an explicit window.
create or replace function public.crm_backfill_leads(p_days int default 30)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  if not public.is_superadmin() then
    raise exception 'not authorized';
  end if;

  with candidates as (
    select
      p.id,
      p.full_name,
      p.email,
      p.target_group,
      p.created_at,
      case
        when right(regexp_replace(coalesce(p.phone, ''), '[^0-9]', '', 'g'), 10) ~ '^[6-9][0-9]{9}$'
          then right(regexp_replace(p.phone, '[^0-9]', '', 'g'), 10)
        else null
      end as phone
    from public.profiles p
    where p.role = 'user'
      and p.created_at >= now() - make_interval(days => greatest(p_days, 0))
      and not exists (select 1 from public.crm_leads l where l.user_id = p.id)
  )
  insert into public.crm_leads
    (user_id, full_name, phone, whatsapp, email, target_group, source, created_at)
  select id, full_name, phone, phone, email, target_group, 'backfill', created_at
  from candidates
  -- A cold import may already hold this number; leave that row alone.
  on conflict do nothing;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

grant execute on function public.crm_backfill_leads(int) to authenticated;

-- ─── 7. Per-agent daily volume ──────────────────────────────────────────────
-- The report behind "how many calls did each agent make today". Counts CLICKS
-- (the dialer/WhatsApp taps), logged outcomes, conversions, distinct leads
-- worked, and the average first-response time on the leads that agent opened.
create or replace function public.crm_agent_stats(
  p_from date default ((now() at time zone 'Asia/Kolkata')::date),
  p_to   date default ((now() at time zone 'Asia/Kolkata')::date),
  p_agent uuid default null
)
returns table (
  agent_id        uuid,
  agent_name      text,
  agent_email     text,
  day_ist         date,
  calls           bigint,
  whatsapps       bigint,
  emails          bigint,
  outcomes        bigint,
  conversions     bigint,
  leads_touched   bigint,
  avg_response_secs numeric
)
language sql
security definer
set search_path = public
as $$
  select
    i.agent_id,
    p.full_name                                                as agent_name,
    p.email                                                    as agent_email,
    i.day_ist,
    count(*) filter (where i.kind = 'click' and i.channel = 'call')     as calls,
    count(*) filter (where i.kind = 'click' and i.channel = 'whatsapp') as whatsapps,
    count(*) filter (where i.kind = 'click' and i.channel = 'email')    as emails,
    count(*) filter (where i.kind = 'outcome')                          as outcomes,
    count(*) filter (where i.kind = 'outcome' and i.status_after = 'converted') as conversions,
    count(distinct i.lead_id)                                  as leads_touched,
    avg(l.first_response_secs) filter (where l.first_response_secs is not null) as avg_response_secs
  from public.crm_interactions i
  left join public.profiles p on p.id = i.agent_id
  left join public.crm_leads l on l.id = i.lead_id
  where i.day_ist between p_from and p_to
    and (p_agent is null or i.agent_id = p_agent)
    and (public.is_superadmin() or public.is_admin() or i.agent_id = auth.uid())
  group by i.agent_id, p.full_name, p.email, i.day_ist
  order by i.day_ist desc, calls desc;
$$;

grant execute on function public.crm_agent_stats(date, date, uuid) to authenticated;

-- ─── 8. Pipeline snapshot for the console ───────────────────────────────────
create or replace function public.crm_pipeline_metrics()
returns jsonb
language sql
security definer
set search_path = public
as $$
  select case when public.is_crm_staff() then jsonb_build_object(
    'total',          (select count(*) from public.crm_leads),
    'unclaimed',      (select count(*) from public.crm_leads where assigned_to is null and status = 'new'),
    'new_today',      (select count(*) from public.crm_leads
                        where (created_at at time zone 'Asia/Kolkata')::date = (now() at time zone 'Asia/Kolkata')::date),
    'awaiting_first_contact',
                      (select count(*) from public.crm_leads where first_response_at is null),
    'follow_ups_due', (select count(*) from public.crm_leads
                        where next_follow_up_at is not null and next_follow_up_at <= now()
                          and status not in ('converted', 'not_interested', 'invalid')),
    'converted',      (select count(*) from public.crm_leads where status = 'converted'),
    'calls_today',    (select count(*) from public.crm_interactions
                        where kind = 'click' and channel = 'call'
                          and day_ist = (now() at time zone 'Asia/Kolkata')::date),
    'median_response_secs',
                      (select percentile_cont(0.5) within group (order by first_response_secs)
                         from public.crm_leads where first_response_secs is not null),
    'by_status',      (select coalesce(jsonb_object_agg(status, n), '{}'::jsonb)
                         from (select status, count(*) as n from public.crm_leads group by status) s),
    'logged_today',   (select count(*) from public.crm_interactions
                        where kind = 'outcome'
                          and day_ist = (now() at time zone 'Asia/Kolkata')::date),
    -- What the leads are actually SAYING, by category. Two counts per intent:
    -- `leads` is how many leads currently sit on it (a lead has one live
    -- answer), `logged_today` is how many times it was recorded today — the
    -- second is what moves minute to minute while a shift is calling.
    -- Retired categories still appear while any lead is parked on one, so the
    -- board never silently loses rows.
    'by_intent',      (select coalesce(jsonb_agg(jsonb_build_object(
                          'id', i.id, 'label', i.label, 'color', i.color,
                          'outcome', i.outcome, 'active', i.active,
                          'leads', coalesce(l.n, 0),
                          'logged_today', coalesce(t.n, 0)
                        ) order by coalesce(l.n, 0) desc, i.sort_order), '[]'::jsonb)
                        from public.crm_intents i
                        left join (select intent_id, count(*) as n from public.crm_leads
                                    where intent_id is not null group by intent_id) l
                          on l.intent_id = i.id
                        left join (select intent_id, count(*) as n from public.crm_interactions
                                    where intent_id is not null and kind = 'outcome'
                                      and day_ist = (now() at time zone 'Asia/Kolkata')::date
                                    group by intent_id) t
                          on t.intent_id = i.id
                        where i.active or coalesce(l.n, 0) > 0)
  ) else '{}'::jsonb end;
$$;

grant execute on function public.crm_pipeline_metrics() to authenticated;

-- ─── 9. What a lead has already paid for ────────────────────────────────────
-- A telecaller must never pitch premium to somebody who already bought it.
-- 682 backfilled leads include existing paying customers, so the desk shows
-- each lead's plan beside their name.
--
-- The plan windows below are a DELIBERATE MIRROR of superadmin_list_users
-- (supabase/superadmin_users_v2.sql) and bundleAccess (server/src/lib/premium.ts):
-- premium_annual = 90 days, vettri_nichayam = 60, vettri_month = 30. If those
-- windows ever change, this function has to change with them — there is no
-- shared definition to inherit from, which is exactly why this note is here.
create or replace function public.crm_lead_plans(p_ids uuid[])
returns table (
  user_id       uuid,
  premium       boolean,
  premium_until timestamptz,
  vettri        boolean,
  vettri_until  timestamptz
)
language sql
security definer
set search_path = public
as $$
  select
    u.id,
    pay.latest_paid is not null,
    (pay.latest_paid + interval '90 days'),
    (vet.vettri_end is not null),
    vet.vettri_end
  from unnest(p_ids) as u(id)
  left join lateral (
    select max(pm.created_at) as latest_paid
    from public.payments pm
    where pm.user_id = u.id
      and pm.status = 'paid'
      and pm.notes->>'plan' = 'premium_annual'
      and pm.created_at >= now() - interval '90 days'
  ) pay on true
  left join lateral (
    select max(pm.created_at + case pm.notes->>'plan'
             when 'vettri_nichayam' then interval '60 days'
             else interval '30 days'
           end) as vettri_end
    from public.payments pm
    where pm.user_id = u.id
      and pm.status = 'paid'
      and (
        (pm.notes->>'plan' = 'vettri_nichayam' and pm.created_at >= now() - interval '60 days')
        or (pm.notes->>'plan' = 'vettri_month' and pm.created_at >= now() - interval '30 days')
      )
  ) vet on true
  where public.is_crm_staff();
$$;

grant execute on function public.crm_lead_plans(uuid[]) to authenticated;

-- ─── 9. Take back the stack's blanket grants ────────────────────────────────
-- Defence in depth behind RLS, not instead of it. The Express server reaches
-- these tables as `service_role` (which both keeps its grants and bypasses RLS),
-- and the three RPCs above are SECURITY DEFINER, so `authenticated` needs no
-- table privilege of its own to use the CRM — only EXECUTE, granted explicitly.
--
-- Re-runnable, and it must stay LAST: a later CREATE TABLE in this file would
-- pick the default grants straight back up.
revoke all on public.crm_leads        from anon, authenticated;
revoke all on public.crm_intents      from anon, authenticated;
revoke all on public.crm_interactions from anon, authenticated;
