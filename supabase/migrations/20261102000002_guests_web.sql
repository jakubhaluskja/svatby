-- =============================================================================
-- Hosté, události, RSVP a svatební web
-- =============================================================================

create type app.rsvp_status as enum ('pending', 'yes', 'no');
create type app.actor_kind  as enum ('guest', 'member', 'system');

-- Lokalizovaný text ukládáme jako {"cs": "...", "en": "..."}.

-- -----------------------------------------------------------------------------
-- Události (obřad, hostina, večer, páteční grilovačka…)
-- -----------------------------------------------------------------------------
create table public.events (
  id                    uuid primary key default gen_random_uuid(),
  wedding_id            uuid not null references public.weddings (id) on delete cascade,
  name                  jsonb not null,
  description           jsonb not null default '{}'::jsonb,
  starts_at             timestamptz,
  ends_at               timestamptz,
  location_name         text,
  address               text,
  lat                   double precision,
  lng                   double precision,
  visibility            text not null default 'public' check (visibility in ('public', 'invited')),
  is_seated             boolean not null default false,  -- má zasedací pořádek
  -- plán B
  plan_b_location_name  text,
  plan_b_address        text,
  plan_b_lat            double precision,
  plan_b_lng            double precision,
  plan_b_note           jsonb not null default '{}'::jsonb,
  plan_b_active         boolean not null default false,
  plan_b_activated_at   timestamptz,
  sort                  int not null default 0,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
create index on public.events (wedding_id, sort);
create trigger events_touch before update on public.events
  for each row execute function app.touch_updated_at();

-- -----------------------------------------------------------------------------
-- Věkové kategorie a štítky
-- -----------------------------------------------------------------------------
create table public.age_categories (
  id          uuid primary key default gen_random_uuid(),
  wedding_id  uuid not null references public.weddings (id) on delete cascade,
  name        jsonb not null,
  min_age     int,
  max_age     int,
  is_adult    boolean not null default false,
  sort        int not null default 0,
  check (min_age is null or max_age is null or min_age <= max_age)
);
create index on public.age_categories (wedding_id, sort);

create table public.tags (
  id          uuid primary key default gen_random_uuid(),
  wedding_id  uuid not null references public.weddings (id) on delete cascade,
  name        text not null,
  color       text not null default 'neutral',
  unique (wedding_id, name)
);

-- -----------------------------------------------------------------------------
-- Domácnosti a hosté
-- -----------------------------------------------------------------------------
create table public.households (
  id                uuid primary key default gen_random_uuid(),
  wedding_id        uuid not null references public.weddings (id) on delete cascade,
  name              text not null,
  token             text not null unique default app.random_token(24),
  short_code        text not null default app.random_code(6),
  locale            text not null default 'cs' check (locale in ('cs', 'en')),
  email             extensions.citext,
  plus_ones_allowed int not null default 0 check (plus_ones_allowed between 0 and 10),
  notes             text,
  -- odpovědi za domácnost
  needs_lodging     boolean,
  lodging_note      text,
  song_wish         text,
  message           text,
  rsvp_submitted_at timestamptz,
  -- pozvánka a e-maily
  invited_at        timestamptz,
  unsubscribed_at   timestamptz,
  thanked_at        timestamptz,
  sort              int not null default 0,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (wedding_id, short_code)
);
create index on public.households (wedding_id, sort);
create trigger households_touch before update on public.households
  for each row execute function app.touch_updated_at();

create table public.household_events (
  household_id  uuid not null references public.households (id) on delete cascade,
  event_id      uuid not null references public.events (id) on delete cascade,
  wedding_id    uuid not null references public.weddings (id) on delete cascade,
  primary key (household_id, event_id)
);
create index on public.household_events (event_id);

create table public.guests (
  id                uuid primary key default gen_random_uuid(),
  wedding_id        uuid not null references public.weddings (id) on delete cascade,
  household_id      uuid not null references public.households (id) on delete cascade,
  first_name        text not null,
  last_name         text,
  age_category_id   uuid references public.age_categories (id) on delete set null,
  needs_high_chair  boolean not null default false,
  is_plus_one       boolean not null default false,
  diet              text,          -- vegetarián, vegan, bezlepkové…
  allergies         text,          -- zdravotní údaj (GDPR čl. 9)
  email             extensions.citext,
  notes             text,
  sort              int not null default 0,
  anonymized_at     timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index on public.guests (household_id, sort);
create index on public.guests (wedding_id);
create trigger guests_touch before update on public.guests
  for each row execute function app.touch_updated_at();

create table public.guest_tags (
  guest_id    uuid not null references public.guests (id) on delete cascade,
  tag_id      uuid not null references public.tags (id) on delete cascade,
  wedding_id  uuid not null references public.weddings (id) on delete cascade,
  primary key (guest_id, tag_id)
);

-- Odpověď za osobu a událost.
create table public.rsvp_responses (
  guest_id    uuid not null references public.guests (id) on delete cascade,
  event_id    uuid not null references public.events (id) on delete cascade,
  wedding_id  uuid not null references public.weddings (id) on delete cascade,
  status      app.rsvp_status not null default 'pending',
  updated_by  app.actor_kind not null default 'guest',
  updated_at  timestamptz not null default now(),
  primary key (guest_id, event_id)
);
create index on public.rsvp_responses (event_id, status);

-- Historie všech změn odpovědí.
create table public.rsvp_log (
  id              bigint generated always as identity primary key,
  wedding_id      uuid not null references public.weddings (id) on delete cascade,
  household_id    uuid references public.households (id) on delete set null,
  actor_kind      app.actor_kind not null,
  actor_user_id   uuid references auth.users (id) on delete set null,
  payload         jsonb not null,
  created_at      timestamptz not null default now()
);
create index on public.rsvp_log (wedding_id, created_at desc);

-- -----------------------------------------------------------------------------
-- Obsah svatebního webu (koncept a zveřejněná verze)
-- -----------------------------------------------------------------------------
-- sections: [{"id":"hero","type":"hero","enabled":true,"content":{...}}, ...]
create table public.site_pages (
  wedding_id  uuid not null references public.weddings (id) on delete cascade,
  state       text not null check (state in ('draft', 'published')),
  sections    jsonb not null default '[]'::jsonb,
  theme       jsonb not null default '{}'::jsonb,
  template    text not null default 'modern',
  updated_at  timestamptz not null default now(),
  updated_by  uuid references auth.users (id) on delete set null,
  primary key (wedding_id, state)
);

-- Plán B a zprávy v den D (e-mail + banner na webu).
create table public.broadcasts (
  id              uuid primary key default gen_random_uuid(),
  wedding_id      uuid not null references public.weddings (id) on delete cascade,
  kind            text not null check (kind in ('plan_b', 'message')),
  audience        text not null default 'all' check (audience in ('all', 'event', 'households')),
  event_id        uuid references public.events (id) on delete cascade,
  household_ids   uuid[] not null default '{}',
  subject         jsonb not null default '{}'::jsonb,
  body            jsonb not null default '{}'::jsonb,
  send_email      boolean not null default true,
  show_banner     boolean not null default true,
  scheduled_at    timestamptz,
  sent_at         timestamptz,
  banner_until    timestamptz,
  created_by      uuid references auth.users (id) on delete set null,
  created_at      timestamptz not null default now()
);
create index on public.broadcasts (wedding_id, scheduled_at);

-- -----------------------------------------------------------------------------
-- E-maily (log rozesílání a doručení)
-- -----------------------------------------------------------------------------
create table public.email_log (
  id            uuid primary key default gen_random_uuid(),
  wedding_id    uuid references public.weddings (id) on delete cascade,
  household_id  uuid references public.households (id) on delete set null,
  template      text not null,
  to_email      extensions.citext not null,
  provider_id   text unique,
  status        text not null default 'queued'
                  check (status in ('queued', 'sent', 'delivered', 'opened', 'bounced', 'complained', 'failed')),
  error         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index on public.email_log (wedding_id, created_at desc);
create index on public.email_log (household_id);

-- -----------------------------------------------------------------------------
-- RLS
-- Veřejný přístup hostů (osobní odkaz) jde výhradně přes server se service_role
-- a ověřením tokenu domácnosti. Anonymní klient nemá k tabulkám přístup.
-- -----------------------------------------------------------------------------
do $$
declare
  t text;
  m text;
begin
  for t, m in
    select * from (values
      ('events', 'guests'), ('age_categories', 'guests'), ('tags', 'guests'),
      ('households', 'guests'), ('household_events', 'guests'), ('guests', 'guests'),
      ('guest_tags', 'guests'), ('rsvp_responses', 'guests'),
      ('site_pages', 'web'), ('broadcasts', 'web')
    ) as x(t, m)
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy %I on public.%I for select using (app.can_read(wedding_id, %L))',
      t || '_read', t, m);
    execute format(
      'create policy %I on public.%I for all using (app.can_write(wedding_id, %L)) with check (app.can_write(wedding_id, %L))',
      t || '_write', t, m, m);
  end loop;
end;
$$;

alter table public.rsvp_log  enable row level security;
alter table public.email_log enable row level security;
create policy rsvp_log_read  on public.rsvp_log  for select using (app.can_read(wedding_id, 'guests'));
create policy email_log_read on public.email_log for select using (app.can_read(wedding_id, 'guests'));
