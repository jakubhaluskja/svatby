-- =============================================================================
-- Plánování: zasedací pořádek, ubytování, checklist, harmonogram dne D,
-- rozpočet a dodavatelé
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Dodavatelé (potřebují je rozpočet, checklist i harmonogram)
-- -----------------------------------------------------------------------------
create table public.vendors (
  id            uuid primary key default gen_random_uuid(),
  wedding_id    uuid not null references public.weddings (id) on delete cascade,
  name          text not null,
  category      text,
  contact_name  text,
  email         extensions.citext,
  phone         text,
  website       text,
  notes         text,
  created_at    timestamptz not null default now()
);
create index on public.vendors (wedding_id);

create table public.vendor_files (
  id          uuid primary key default gen_random_uuid(),
  wedding_id  uuid not null references public.weddings (id) on delete cascade,
  vendor_id   uuid not null references public.vendors (id) on delete cascade,
  name        text not null,
  storage_key text not null,
  bytes       bigint not null default 0,
  created_at  timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Zasedací pořádek
-- -----------------------------------------------------------------------------
create table public.venue_layouts (
  id                uuid primary key default gen_random_uuid(),
  wedding_id        uuid not null references public.weddings (id) on delete cascade,
  event_id          uuid not null unique references public.events (id) on delete cascade,
  background_key    text,              -- nahraný půdorys sálu
  width             int not null default 2000,
  height            int not null default 1400,
  updated_at        timestamptz not null default now()
);

create table public.layout_items (
  id          uuid primary key default gen_random_uuid(),
  wedding_id  uuid not null references public.weddings (id) on delete cascade,
  layout_id   uuid not null references public.venue_layouts (id) on delete cascade,
  kind        text not null check (kind in ('table', 'decor')),
  shape       text not null check (shape in (
                'round', 'rect', 'oval', 'head', 't', 'u', 'banquet',
                'dancefloor', 'bar', 'stage', 'dj', 'entrance')),
  label       text,
  seats       int not null default 0 check (seats between 0 and 200),
  x           double precision not null default 0,
  y           double precision not null default 0,
  w           double precision not null default 120,
  h           double precision not null default 120,
  rotation    double precision not null default 0,
  sort        int not null default 0
);
create index on public.layout_items (layout_id);

create table public.seat_assignments (
  guest_id    uuid not null references public.guests (id) on delete cascade,
  event_id    uuid not null references public.events (id) on delete cascade,
  wedding_id  uuid not null references public.weddings (id) on delete cascade,
  table_id    uuid not null references public.layout_items (id) on delete cascade,
  seat_index  int,
  locked      boolean not null default false,
  primary key (guest_id, event_id),
  unique (table_id, seat_index)
);
create index on public.seat_assignments (table_id);

create table public.seating_rules (
  id          uuid primary key default gen_random_uuid(),
  wedding_id  uuid not null references public.weddings (id) on delete cascade,
  event_id    uuid references public.events (id) on delete cascade, -- null = všechny události
  kind        text not null check (kind in ('together', 'apart', 'fixed_table')),
  guest_ids   uuid[] not null check (cardinality(guest_ids) >= 1),
  table_id    uuid references public.layout_items (id) on delete cascade,
  note        text,
  created_at  timestamptz not null default now(),
  check (kind <> 'fixed_table' or table_id is not null),
  check (kind = 'fixed_table' or cardinality(guest_ids) >= 2)
);
create index on public.seating_rules (wedding_id);

-- -----------------------------------------------------------------------------
-- Ubytování po pokojích
-- -----------------------------------------------------------------------------
create table public.lodgings (
  id            uuid primary key default gen_random_uuid(),
  wedding_id    uuid not null references public.weddings (id) on delete cascade,
  name          text not null,
  address       text,
  url           text,
  check_in_info jsonb not null default '{}'::jsonb,
  sort          int not null default 0
);

create table public.rooms (
  id          uuid primary key default gen_random_uuid(),
  wedding_id  uuid not null references public.weddings (id) on delete cascade,
  lodging_id  uuid not null references public.lodgings (id) on delete cascade,
  name        text not null,
  capacity    int not null check (capacity between 1 and 50),
  price       numeric(12, 2),
  currency    app.currency not null default 'CZK',
  paid_by     text not null default 'guest' check (paid_by in ('guest', 'couple')),
  notes       text,
  sort        int not null default 0
);
create index on public.rooms (lodging_id);

create table public.room_assignments (
  guest_id    uuid primary key references public.guests (id) on delete cascade,
  room_id     uuid not null references public.rooms (id) on delete cascade,
  wedding_id  uuid not null references public.weddings (id) on delete cascade
);
create index on public.room_assignments (room_id);

-- -----------------------------------------------------------------------------
-- Rozpočet
-- -----------------------------------------------------------------------------
create table public.budget_categories (
  id              uuid primary key default gen_random_uuid(),
  wedding_id      uuid not null references public.weddings (id) on delete cascade,
  name            text not null,
  planned_amount  numeric(12, 2),
  sort            int not null default 0
);

create table public.budget_items (
  id                  uuid primary key default gen_random_uuid(),
  wedding_id          uuid not null references public.weddings (id) on delete cascade,
  category_id         uuid references public.budget_categories (id) on delete set null,
  vendor_id           uuid references public.vendors (id) on delete set null,
  contributor_id      uuid references public.contributors (id) on delete set null,
  name                text not null,
  currency            app.currency not null default 'CZK',
  estimate_amount     numeric(12, 2),
  actual_amount       numeric(12, 2),
  -- cena za osobu dopočítaná z potvrzených RSVP dané události
  per_person          boolean not null default false,
  per_person_event_id uuid references public.events (id) on delete set null,
  notes               text,
  sort                int not null default 0,
  created_at          timestamptz not null default now()
);
create index on public.budget_items (wedding_id, category_id);

create table public.budget_item_rates (
  item_id          uuid not null references public.budget_items (id) on delete cascade,
  age_category_id  uuid not null references public.age_categories (id) on delete cascade,
  wedding_id       uuid not null references public.weddings (id) on delete cascade,
  price            numeric(12, 2) not null,
  primary key (item_id, age_category_id)
);

create table public.budget_payments (
  id              uuid primary key default gen_random_uuid(),
  wedding_id      uuid not null references public.weddings (id) on delete cascade,
  item_id         uuid not null references public.budget_items (id) on delete cascade,
  contributor_id  uuid references public.contributors (id) on delete set null,
  label           text,
  amount          numeric(12, 2) not null,
  currency        app.currency not null default 'CZK',
  due_date        date,
  paid_at         date,
  paid_amount_default_currency numeric(12, 2), -- skutečně zaplaceno ve výchozí měně svatby
  exchange_rate   numeric(12, 6),               -- kurz ČNB ke dni platby
  created_at      timestamptz not null default now()
);
create index on public.budget_payments (item_id);
create index on public.budget_payments (wedding_id, due_date) where paid_at is null;

-- Kurzy ČNB (sdílené, plní je cron).
create table public.exchange_rates (
  rate_date   date not null,
  currency    app.currency not null,
  czk_per_unit numeric(12, 6) not null,
  primary key (rate_date, currency)
);

-- -----------------------------------------------------------------------------
-- Checklist a harmonogram dne D
-- -----------------------------------------------------------------------------
create table public.tasks (
  id                  uuid primary key default gen_random_uuid(),
  wedding_id          uuid not null references public.weddings (id) on delete cascade,
  parent_id           uuid references public.tasks (id) on delete cascade,
  title               text not null,
  description         text,
  due_date            date,
  offset_days         int,               -- relativně k datu svatby; posouvá se s ním
  done_at             timestamptz,
  assignee_member_id  uuid references public.wedding_members (id) on delete set null,
  assignee_name       text,
  assignee_email      extensions.citext,
  budget_payment_id   uuid references public.budget_payments (id) on delete cascade,
  source              text not null default 'custom' check (source in ('template', 'custom', 'system')),
  system_key          text,              -- např. 'rsvp.send_links' – úkoly vytvářené moduly
  sort                int not null default 0,
  created_at          timestamptz not null default now(),
  unique (wedding_id, system_key)
);
create index on public.tasks (wedding_id, due_date);

create table public.schedule_items (
  id                uuid primary key default gen_random_uuid(),
  wedding_id        uuid not null references public.weddings (id) on delete cascade,
  starts_at         timestamptz not null,
  ends_at           timestamptz,
  title             text not null,
  location          text,
  responsible_name  text,
  vendor_id         uuid references public.vendors (id) on delete set null,
  contact           text,
  notes             text,
  sort              int not null default 0
);
create index on public.schedule_items (wedding_id, starts_at);

create table public.schedule_links (
  id          uuid primary key default gen_random_uuid(),
  wedding_id  uuid not null references public.weddings (id) on delete cascade,
  vendor_id   uuid references public.vendors (id) on delete cascade, -- null = hlavní odkaz
  token       text not null unique default app.random_token(24),
  created_at  timestamptz not null default now(),
  revoked_at  timestamptz
);
create unique index schedule_links_active
  on public.schedule_links (wedding_id, coalesce(vendor_id, '00000000-0000-0000-0000-000000000000'::uuid))
  where revoked_at is null;

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
do $$
declare
  t text;
  m text;
begin
  for t, m in
    select * from (values
      ('venue_layouts', 'seating'), ('layout_items', 'seating'),
      ('seat_assignments', 'seating'), ('seating_rules', 'seating'),
      ('lodgings', 'lodging'), ('rooms', 'lodging'), ('room_assignments', 'lodging'),
      ('tasks', 'checklist'), ('schedule_items', 'checklist'), ('schedule_links', 'checklist'),
      ('vendors', 'budget'), ('vendor_files', 'budget'),
      ('budget_categories', 'budget'), ('budget_item_rates', 'budget'),
      ('contributors', 'budget')
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

-- Položky a platby rozpočtu: úroveň 'own' vidí jen část svého přispěvatele.
alter table public.budget_items    enable row level security;
alter table public.budget_payments enable row level security;

create policy budget_items_read on public.budget_items for select using (
  app.can_read(wedding_id, 'budget')
  or (app.module_level(wedding_id, 'budget') = 'own'
      and contributor_id = app.member_contributor(wedding_id)));
create policy budget_items_write on public.budget_items for all
  using (app.can_write(wedding_id, 'budget')) with check (app.can_write(wedding_id, 'budget'));

create policy budget_payments_read on public.budget_payments for select using (
  app.can_read(wedding_id, 'budget')
  or (app.module_level(wedding_id, 'budget') = 'own'
      and contributor_id = app.member_contributor(wedding_id)));
create policy budget_payments_write on public.budget_payments for all
  using (app.can_write(wedding_id, 'budget')) with check (app.can_write(wedding_id, 'budget'));

-- Úroveň 'own' vidí i svůj záznam přispěvatele.
create policy contributors_own on public.contributors for select using (
  app.module_level(wedding_id, 'budget') = 'own' and id = app.member_contributor(wedding_id));

alter table public.exchange_rates enable row level security;
create policy exchange_rates_read on public.exchange_rates for select using (true);
