-- =============================================================================
-- Dary, fotogalerie, objednávky a platby
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Dary
-- Peníze nikdy nejdou přes platformu – QR platba míří přímo na účet páru.
-- -----------------------------------------------------------------------------
create table public.gift_settings (
  wedding_id        uuid primary key references public.weddings (id) on delete cascade,
  account_number    text,           -- číslo účtu páru pro QR platby (CZ formát nebo IBAN)
  iban              text,
  account_holder    text,
  reveal_reservations boolean not null default true   -- false = překvapení
);

create table public.gifts (
  id                  uuid primary key default gen_random_uuid(),
  wedding_id          uuid not null references public.weddings (id) on delete cascade,
  kind                text not null check (kind in ('item', 'fund', 'group')),
  title               jsonb not null,
  description         jsonb not null default '{}'::jsonb,
  url                 text,
  price               numeric(12, 2),
  image_key           text,
  target_amount       numeric(12, 2),            -- skupinový dar / fond
  show_contributors   boolean not null default false,
  show_amounts        boolean not null default false,
  sort                int not null default 0,
  created_at          timestamptz not null default now(),
  check (kind <> 'group' or target_amount is not null)
);
create index on public.gifts (wedding_id, sort);

create table public.gift_reservations (
  id            uuid primary key default gen_random_uuid(),
  wedding_id    uuid not null references public.weddings (id) on delete cascade,
  gift_id       uuid not null references public.gifts (id) on delete cascade,
  household_id  uuid not null references public.households (id) on delete cascade,
  created_at    timestamptz not null default now(),
  cancelled_at  timestamptz
);
create unique index gift_one_active_reservation
  on public.gift_reservations (gift_id) where cancelled_at is null;

create table public.gift_contributions (
  id            uuid primary key default gen_random_uuid(),
  wedding_id    uuid not null references public.weddings (id) on delete cascade,
  gift_id       uuid not null references public.gifts (id) on delete cascade,
  household_id  uuid references public.households (id) on delete set null,
  display_name  text,
  amount        numeric(12, 2) not null check (amount > 0),
  confirmed_at  timestamptz,               -- pár potvrdil podle výpisu
  created_at    timestamptz not null default now()
);
create index on public.gift_contributions (gift_id);

-- Evidence obdržených darů (pro poděkování).
create table public.received_gifts (
  id            uuid primary key default gen_random_uuid(),
  wedding_id    uuid not null references public.weddings (id) on delete cascade,
  household_id  uuid not null references public.households (id) on delete cascade,
  description   text not null,
  amount        numeric(12, 2),
  source        text not null default 'manual' check (source in ('manual', 'reservation', 'contribution')),
  source_id     uuid,
  created_at    timestamptz not null default now()
);
create index on public.received_gifts (household_id);

create table public.thank_you_templates (
  wedding_id  uuid not null references public.weddings (id) on delete cascade,
  locale      text not null check (locale in ('cs', 'en')),
  subject     text not null,
  body        text not null,      -- proměnné {{household}}, {{gifts}}
  media_id    uuid,               -- fotka z galerie
  primary key (wedding_id, locale)
);

-- -----------------------------------------------------------------------------
-- Fotogalerie
-- -----------------------------------------------------------------------------
create table public.albums (
  id          uuid primary key default gen_random_uuid(),
  wedding_id  uuid not null references public.weddings (id) on delete cascade,
  kind        text not null check (kind in ('guests', 'photographer', 'custom')),
  name        jsonb not null,
  sort        int not null default 0
);
create unique index albums_one_system
  on public.albums (wedding_id, kind) where kind in ('guests', 'photographer');

create table public.media (
  id                    uuid primary key default gen_random_uuid(),
  wedding_id            uuid not null references public.weddings (id) on delete cascade,
  album_id              uuid not null references public.albums (id) on delete cascade,
  uploader_household_id uuid references public.households (id) on delete set null,
  uploader_name         text,
  kind                  text not null check (kind in ('photo', 'video')),
  storage_key           text not null unique,      -- originál v R2
  thumb_key             text,
  preview_key           text,
  content_type          text not null,
  bytes                 bigint not null check (bytes >= 0),
  width                 int,
  height                int,
  duration_s            numeric(6, 2) check (duration_s is null or duration_s <= 60),
  status                text not null default 'uploading'
                          check (status in ('uploading', 'processing', 'pending', 'approved', 'hidden', 'failed')),
  taken_at              timestamptz,
  created_at            timestamptz not null default now()
);
create index on public.media (wedding_id, status, created_at desc);
create index on public.media (album_id, created_at desc);

-- thank_you_templates.media_id odkazuje na fotku z galerie
alter table public.thank_you_templates
  add constraint thank_you_media_fk foreign key (media_id) references public.media (id) on delete set null;

create table public.media_reports (
  id           uuid primary key default gen_random_uuid(),
  wedding_id   uuid not null references public.weddings (id) on delete cascade,
  media_id     uuid not null references public.media (id) on delete cascade,
  reason       text,
  created_at   timestamptz not null default now(),
  resolved_at  timestamptz,
  resolution   text check (resolution in ('kept', 'removed'))
);
create index on public.media_reports (resolved_at) where resolved_at is null;

-- Obsazené místo v galerii se počítá triggerem.
create or replace function app.track_gallery_usage()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    update public.weddings set gallery_used_bytes = gallery_used_bytes + new.bytes where id = new.wedding_id;
  elsif tg_op = 'DELETE' then
    update public.weddings set gallery_used_bytes = greatest(0, gallery_used_bytes - old.bytes) where id = old.wedding_id;
  elsif tg_op = 'UPDATE' and new.bytes <> old.bytes then
    update public.weddings set gallery_used_bytes = greatest(0, gallery_used_bytes + new.bytes - old.bytes) where id = new.wedding_id;
  end if;
  return null;
end;
$$;

create trigger media_usage after insert or update of bytes or delete on public.media
  for each row execute function app.track_gallery_usage();

-- -----------------------------------------------------------------------------
-- Objednávky, slevové kódy, faktury
-- -----------------------------------------------------------------------------
create type app.product_kind as enum (
  'web', 'web_gallery', 'upgrade_gallery', 'gallery_extension', 'gallery_capacity');

create table public.discount_codes (
  id            uuid primary key default gen_random_uuid(),
  code          extensions.citext not null unique,
  percent_off   numeric(5, 2) check (percent_off is null or percent_off between 0 and 100),
  amount_off    numeric(12, 2) check (amount_off is null or amount_off >= 0),
  products      app.product_kind[] not null default array['web', 'web_gallery']::app.product_kind[],
  valid_from    timestamptz,
  valid_to      timestamptz,
  max_uses      int,
  used_count    int not null default 0,
  note          text,
  active        boolean not null default true,
  created_at    timestamptz not null default now(),
  check ((percent_off is null) <> (amount_off is null))
);

create table public.orders (
  id                        uuid primary key default gen_random_uuid(),
  wedding_id                uuid not null references public.weddings (id) on delete restrict,
  user_id                   uuid references auth.users (id) on delete set null,
  product                   app.product_kind not null,
  quantity                  int not null default 1 check (quantity > 0),
  price_gross               numeric(12, 2) not null,     -- s DPH, CZK
  discount_code_id          uuid references public.discount_codes (id) on delete set null,
  discount_gross            numeric(12, 2) not null default 0,
  total_gross               numeric(12, 2) not null,
  vat_rate                  numeric(5, 4) not null default 0.21,
  status                    text not null default 'pending'
                              check (status in ('pending', 'paid', 'cancelled', 'refunded')),
  provider                  text not null default 'comgate',
  provider_ref              text unique,
  billing                   jsonb not null default '{}'::jsonb,  -- jméno, IČO, DIČ, adresa
  consent_digital_content_at timestamptz not null,               -- souhlas s okamžitým dodáním
  invoice_number            text unique,
  invoice_key               text,
  paid_at                   timestamptz,
  refunded_at               timestamptz,
  refund_reason             text,
  created_at                timestamptz not null default now()
);
create index on public.orders (wedding_id, created_at desc);
create index on public.orders (status, created_at desc);

-- Číselná řada faktur: RRRR + pořadové číslo (např. 20270001).
create table public.invoice_sequences (
  year   int primary key,
  last   int not null default 0
);

create or replace function app.next_invoice_number()
returns text language plpgsql security definer set search_path = '' as $$
declare
  y int := extract(year from now() at time zone 'Europe/Prague')::int;
  n int;
begin
  insert into public.invoice_sequences (year, last) values (y, 1)
  on conflict (year) do update set last = public.invoice_sequences.last + 1
  returning last into n;
  return y::text || lpad(n::text, 4, '0');
end;
$$;

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
      ('gift_settings', 'gifts'), ('gifts', 'gifts'), ('gift_reservations', 'gifts'),
      ('gift_contributions', 'gifts'), ('received_gifts', 'gifts'), ('thank_you_templates', 'gifts'),
      ('albums', 'gallery'), ('media', 'gallery'), ('media_reports', 'gallery')
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

-- Překvapení: pokud pár nechce vidět rezervace, nevidí je ani v adminu.
drop policy gift_reservations_read on public.gift_reservations;
create policy gift_reservations_read on public.gift_reservations for select using (
  app.can_read(wedding_id, 'gifts')
  and coalesce((select reveal_reservations from public.gift_settings s where s.wedding_id = gift_reservations.wedding_id), true));

alter table public.discount_codes    enable row level security;
alter table public.orders            enable row level security;
alter table public.invoice_sequences enable row level security;

create policy orders_read on public.orders for select using (app.is_owner(wedding_id) or app.is_platform_admin());
create policy discount_codes_admin on public.discount_codes for all
  using (app.platform_role() = 'superadmin') with check (app.platform_role() = 'superadmin');
-- objednávky zapisuje výhradně server (service_role) po ověření ceny a platby
