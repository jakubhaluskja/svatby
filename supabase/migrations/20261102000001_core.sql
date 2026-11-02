-- =============================================================================
-- Svatby – jádro: rozšíření, pomocné funkce, svatby, členové, administrace
-- =============================================================================

create extension if not exists pgcrypto with schema extensions;
create extension if not exists citext with schema extensions;

create schema if not exists app;

-- -----------------------------------------------------------------------------
-- Výčtové typy
-- -----------------------------------------------------------------------------
create type app.member_role      as enum ('owner', 'partner', 'coorganizer');
create type app.access_level     as enum ('none', 'read', 'write', 'own');
create type app.wedding_status   as enum ('draft', 'published', 'expired', 'deleted');
create type app.package_kind     as enum ('none', 'web', 'web_gallery');
create type app.currency         as enum ('CZK', 'EUR');
create type app.platform_role    as enum ('superadmin', 'support');
create type app.password_scope   as enum ('none', 'site', 'sections');

-- -----------------------------------------------------------------------------
-- Pomocné funkce
-- -----------------------------------------------------------------------------

-- Náhodný URL-safe token (osobní odkazy, sdílené odkazy, galerie).
create or replace function app.random_token(bytes int default 24)
returns text language sql volatile as $$
  select translate(encode(extensions.gen_random_bytes(bytes), 'base64'), '+/=', '-_');
$$;

-- Krátký kód bez zaměnitelných znaků (0/O, 1/I/L) pro ruční zadání z pozvánky.
create or replace function app.random_code(len int default 6)
returns text language plpgsql volatile as $$
declare
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  result text := '';
  b bytea := extensions.gen_random_bytes(len);
begin
  for i in 0 .. len - 1 loop
    result := result || substr(alphabet, (get_byte(b, i) % length(alphabet)) + 1, 1);
  end loop;
  return result;
end;
$$;

create or replace function app.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- Profily a správci platformy
-- -----------------------------------------------------------------------------
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text,
  locale      text not null default 'cs' check (locale in ('cs', 'en')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.platform_admins (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  role        app.platform_role not null,
  created_at  timestamptz not null default now()
);

create or replace function app.platform_role()
returns app.platform_role language sql stable security definer set search_path = '' as $$
  select role from public.platform_admins where user_id = auth.uid();
$$;

create or replace function app.is_platform_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.platform_admins where user_id = auth.uid());
$$;

-- -----------------------------------------------------------------------------
-- Svatby
-- -----------------------------------------------------------------------------
create table public.weddings (
  id                      uuid primary key default gen_random_uuid(),
  slug                    extensions.citext not null unique
                            check (slug ~ '^[a-z0-9](?:[a-z0-9-]{1,46}[a-z0-9])$'),
  partner1_name           text not null,
  partner2_name           text not null,
  wedding_date            date,
  timezone                text not null default 'Europe/Prague',
  default_locale          text not null default 'cs' check (default_locale in ('cs', 'en')),
  locales                 text[] not null default array['cs'],
  currency                app.currency not null default 'CZK',

  -- vzhled a web
  template                text not null default 'modern',
  theme                   jsonb not null default '{}'::jsonb,
  status                  app.wedding_status not null default 'draft',
  package                 app.package_kind not null default 'none',
  published_at            timestamptz,
  web_expires_at          timestamptz,
  password_hash           text,
  password_scope          app.password_scope not null default 'none',
  protected_sections      text[] not null default '{}',

  -- RSVP
  rsvp_deadline           timestamptz,

  -- galerie
  gallery_moderation      text not null default 'approve'
                            check (gallery_moderation in ('approve', 'publish')),
  gallery_quota_bytes     bigint not null default 0,
  gallery_used_bytes      bigint not null default 0,
  gallery_expires_at      timestamptz,
  gallery_token           text not null unique default app.random_token(18),
  photographer_token      text not null unique default app.random_token(18),

  -- rozpočet
  budget_total            numeric(12, 2),

  -- životní cyklus dat
  guest_data_anonymize_at timestamptz,
  anonymized_at           timestamptz,

  created_by              uuid references auth.users (id) on delete set null,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

create trigger weddings_touch before update on public.weddings
  for each row execute function app.touch_updated_at();

create table public.custom_domains (
  id              uuid primary key default gen_random_uuid(),
  wedding_id      uuid not null references public.weddings (id) on delete cascade,
  hostname        extensions.citext not null unique,
  status          text not null default 'pending' check (status in ('pending', 'verified', 'error')),
  dns_records     jsonb not null default '[]'::jsonb,
  error           text,
  last_checked_at timestamptz,
  verified_at     timestamptz,
  created_at      timestamptz not null default now()
);
create index on public.custom_domains (wedding_id);

-- -----------------------------------------------------------------------------
-- Přispěvatelé rozpočtu (potřebují je členové, proto už zde)
-- -----------------------------------------------------------------------------
create table public.contributors (
  id              uuid primary key default gen_random_uuid(),
  wedding_id      uuid not null references public.weddings (id) on delete cascade,
  name            text not null,
  pledged_amount  numeric(12, 2),
  sort            int not null default 0,
  created_at      timestamptz not null default now()
);
create index on public.contributors (wedding_id);

-- -----------------------------------------------------------------------------
-- Členové týmu svatby
-- -----------------------------------------------------------------------------
-- permissions: {"guests":"write","web":"read","seating":"none","lodging":"none",
--               "checklist":"write","budget":"own","gifts":"read","gallery":"none"}
create table public.wedding_members (
  id              uuid primary key default gen_random_uuid(),
  wedding_id      uuid not null references public.weddings (id) on delete cascade,
  user_id         uuid references auth.users (id) on delete cascade,
  role            app.member_role not null,
  permissions     jsonb not null default '{}'::jsonb,
  contributor_id  uuid references public.contributors (id) on delete set null,
  display_name    text,
  invited_email   extensions.citext,
  invite_token    text unique default app.random_token(24),
  invited_at      timestamptz not null default now(),
  accepted_at     timestamptz,
  unique (wedding_id, user_id)
);
create index on public.wedding_members (user_id);
create unique index wedding_one_owner on public.wedding_members (wedding_id) where role = 'owner';

-- Úroveň přístupu přihlášeného uživatele k modulu svatby.
-- Vlastník a partner/ka mají vždy 'write'.
create or replace function app.module_level(w uuid, module text)
returns app.access_level language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select case
              when m.role in ('owner', 'partner') then 'write'::app.access_level
              else coalesce((m.permissions ->> module)::app.access_level, 'none')
            end
       from public.wedding_members m
      where m.wedding_id = w and m.user_id = auth.uid() and m.accepted_at is not null),
    'none');
$$;

create or replace function app.can_read(w uuid, module text)
returns boolean language sql stable as $$
  select app.module_level(w, module) in ('read', 'write') or app.is_platform_admin();
$$;

create or replace function app.can_write(w uuid, module text)
returns boolean language sql stable as $$
  select app.module_level(w, module) = 'write';
$$;

create or replace function app.is_member(w uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.wedding_members
     where wedding_id = w and user_id = auth.uid() and accepted_at is not null);
$$;

create or replace function app.is_couple(w uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.wedding_members
     where wedding_id = w and user_id = auth.uid() and accepted_at is not null
       and role in ('owner', 'partner'));
$$;

create or replace function app.is_owner(w uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.wedding_members
     where wedding_id = w and user_id = auth.uid() and accepted_at is not null and role = 'owner');
$$;

-- Přispěvatel, za kterého člen vidí rozpočet (úroveň 'own').
create or replace function app.member_contributor(w uuid)
returns uuid language sql stable security definer set search_path = '' as $$
  select contributor_id from public.wedding_members
   where wedding_id = w and user_id = auth.uid() and accepted_at is not null;
$$;

-- -----------------------------------------------------------------------------
-- Audit a obsah platformy
-- -----------------------------------------------------------------------------
create table public.audit_log (
  id            bigint generated always as identity primary key,
  actor_user_id uuid references auth.users (id) on delete set null,
  action        text not null,
  target_type   text not null,
  target_id     uuid,
  wedding_id    uuid references public.weddings (id) on delete set null,
  payload       jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now()
);
create index on public.audit_log (wedding_id, created_at desc);

create table public.checklist_template_items (
  id           uuid primary key default gen_random_uuid(),
  title        jsonb not null,          -- {"cs": "...", "en": "..."}
  description  jsonb not null default '{}'::jsonb,
  offset_days  int not null,            -- záporné = před svatbou
  sort         int not null default 0
);

create table public.budget_template_categories (
  id     uuid primary key default gen_random_uuid(),
  name   jsonb not null,
  share  numeric(5, 4) not null default 0, -- doporučený podíl z rozpočtu
  sort   int not null default 0
);

create table public.email_templates (
  key        text not null,
  locale     text not null check (locale in ('cs', 'en')),
  subject    text not null,
  body       text not null,               -- markdown s proměnnými {{name}}
  updated_at timestamptz not null default now(),
  primary key (key, locale)
);

-- -----------------------------------------------------------------------------
-- RLS – jádro
-- -----------------------------------------------------------------------------
alter table public.profiles                    enable row level security;
alter table public.platform_admins             enable row level security;
alter table public.weddings                    enable row level security;
alter table public.custom_domains              enable row level security;
alter table public.contributors                enable row level security;
alter table public.wedding_members             enable row level security;
alter table public.audit_log                   enable row level security;
alter table public.checklist_template_items    enable row level security;
alter table public.budget_template_categories  enable row level security;
alter table public.email_templates             enable row level security;

create policy profiles_self on public.profiles
  for all using (id = auth.uid()) with check (id = auth.uid());
create policy profiles_admin on public.profiles
  for select using (app.is_platform_admin());

create policy platform_admins_read on public.platform_admins
  for select using (user_id = auth.uid() or app.platform_role() = 'superadmin');

-- Svatbu vidí každý přijatý člen; měnit základní nastavení smí jen pár.
-- Zakládání probíhá přes funkci app.create_wedding().
create policy weddings_read on public.weddings
  for select using (app.is_member(id) or app.is_platform_admin());
create policy weddings_update on public.weddings
  for update using (app.is_couple(id)) with check (app.is_couple(id));

create policy custom_domains_read on public.custom_domains
  for select using (app.can_read(wedding_id, 'web'));
create policy custom_domains_write on public.custom_domains
  for all using (app.is_couple(wedding_id)) with check (app.is_couple(wedding_id));

create policy members_read on public.wedding_members
  for select using (app.is_member(wedding_id) or user_id = auth.uid() or app.is_platform_admin());
create policy members_manage on public.wedding_members
  for all using (app.is_couple(wedding_id) and role <> 'owner')
  with check (app.is_couple(wedding_id) and role <> 'owner');

create policy audit_admin on public.audit_log
  for select using (app.is_platform_admin());

create policy templates_read_checklist on public.checklist_template_items for select using (true);
create policy templates_read_budget    on public.budget_template_categories for select using (true);
create policy templates_admin_checklist on public.checklist_template_items
  for all using (app.platform_role() = 'superadmin') with check (app.platform_role() = 'superadmin');
create policy templates_admin_budget on public.budget_template_categories
  for all using (app.platform_role() = 'superadmin') with check (app.platform_role() = 'superadmin');
create policy email_templates_admin on public.email_templates
  for all using (app.platform_role() = 'superadmin') with check (app.platform_role() = 'superadmin');

-- Profil se založí automaticky s novým uživatelem.
create or replace function app.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data ->> 'full_name')
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function app.handle_new_user();

grant usage on schema app to authenticated, anon, service_role;
grant execute on all functions in schema app to authenticated, service_role;
