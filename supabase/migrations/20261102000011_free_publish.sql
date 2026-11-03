-- Zveřejnění webu zdarma, dokud platforma nespustí platby.
-- Přepínač je v app.platform_settings (mimo veřejné API, mění ho jen administrátor v databázi):
--   update app.platform_settings set payments_enabled = true;

create table app.platform_settings (
  id                boolean primary key default true check (id),
  payments_enabled  boolean not null default false
);
insert into app.platform_settings (id) values (true);

-- Weby zveřejněné bez platby, ať je při spuštění plateb najdeme.
alter table public.weddings add column published_free boolean not null default false;

create or replace function public.payments_enabled()
returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select payments_enabled from app.platform_settings), true);
$$;
revoke execute on function public.payments_enabled() from public, anon;
grant execute on function public.payments_enabled() to authenticated, service_role;

-- Zveřejnění: zaplacený web, nebo zdarma, když platby ještě neběží.
create or replace function public.publish_site(p_wedding_id uuid)
returns timestamptz
language plpgsql security definer set search_path = '' as $$
declare
  ts timestamptz := now();
begin
  if not app.can_write(p_wedding_id, 'web') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if not exists (select 1 from public.weddings where id = p_wedding_id and status = 'published') then
    if public.payments_enabled() then
      raise exception 'not_paid' using errcode = 'P0001';
    end if;
    update public.weddings
       set status = 'published', published_at = coalesce(published_at, ts), published_free = true
     where id = p_wedding_id and status = 'draft';
    if not found then
      raise exception 'not_publishable' using errcode = 'P0001';
    end if;
  end if;

  insert into public.site_pages (wedding_id, state, sections, theme, template, updated_at, updated_by)
  select wedding_id, 'published', sections, theme, template, ts, auth.uid()
    from public.site_pages where wedding_id = p_wedding_id and state = 'draft'
  on conflict (wedding_id, state) do update
    set sections = excluded.sections, theme = excluded.theme, template = excluded.template,
        updated_at = ts, updated_by = excluded.updated_by;

  update public.weddings w
     set template = d.template
    from public.site_pages d
   where w.id = p_wedding_id and d.wedding_id = w.id and d.state = 'draft';

  return ts;
end;
$$;

-- Skrytí webu zveřejněného zdarma (zaplacený web se takto neskrývá).
create or replace function public.unpublish_free_site(p_wedding_id uuid)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not app.can_write(p_wedding_id, 'web') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update public.weddings
     set status = 'draft'
   where id = p_wedding_id and status = 'published' and published_free and package = 'none';
  if not found then
    raise exception 'not_free' using errcode = 'P0001';
  end if;
end;
$$;
revoke execute on function public.unpublish_free_site(uuid) from public, anon;
grant execute on function public.unpublish_free_site(uuid) to authenticated;

-- Zaplacením přestává být web „zdarma“.
create or replace function app.clear_free_flag()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.package <> 'none' then
    new.published_free := false;
  end if;
  return new;
end;
$$;
create trigger weddings_clear_free_flag before update of package on public.weddings
  for each row execute function app.clear_free_flag();

-- Platební a provozní sloupce svatby mění jen funkce platformy, ne pár přes API.
create or replace function app.guard_wedding_billing()
returns trigger language plpgsql set search_path = '' as $$
begin
  if current_user in ('authenticated', 'anon') and (
       new.status is distinct from old.status
    or new.package is distinct from old.package
    or new.published_at is distinct from old.published_at
    or new.published_free is distinct from old.published_free
    or new.web_expires_at is distinct from old.web_expires_at
    or new.gallery_quota_bytes is distinct from old.gallery_quota_bytes
    or new.gallery_used_bytes is distinct from old.gallery_used_bytes
    or new.gallery_expires_at is distinct from old.gallery_expires_at
    or new.guest_data_anonymize_at is distinct from old.guest_data_anonymize_at
    or new.anonymized_at is distinct from old.anonymized_at
  ) then
    raise exception 'billing_columns_locked' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger weddings_guard_billing before update on public.weddings
  for each row execute function app.guard_wedding_billing();
