-- =============================================================================
-- Editor svatebního webu: úložiště fotek a zveřejnění změn
-- =============================================================================

-- Veřejné úložiště fotek webu. Cesta: <wedding_id>/<soubor>.
-- Názvy souborů jsou náhodné, výpis obsahu bucketu není veřejný.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('site-media', 'site-media', true, 10485760, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create or replace function app.storage_wedding(object_name text)
returns uuid language plpgsql immutable as $$
begin
  return (string_to_array(object_name, '/'))[1]::uuid;
exception when others then
  return null;
end;
$$;

create policy site_media_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'site-media' and app.can_write(app.storage_wedding(name), 'web'));
create policy site_media_update on storage.objects for update to authenticated
  using (bucket_id = 'site-media' and app.can_write(app.storage_wedding(name), 'web'));
create policy site_media_delete on storage.objects for delete to authenticated
  using (bucket_id = 'site-media' and app.can_write(app.storage_wedding(name), 'web'));

-- Koncept existuje u každé svatby; zveřejněná verze vzniká zkopírováním konceptu.
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
    raise exception 'not_paid' using errcode = 'P0001';
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

grant execute on function public.publish_site(uuid) to authenticated;

-- Po zaplacení se koncept zveřejní automaticky.
create or replace function app.publish_on_paid()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status = 'published' and old.status is distinct from 'published' then
    insert into public.site_pages (wedding_id, state, sections, theme, template, updated_at)
    select wedding_id, 'published', sections, theme, template, now()
      from public.site_pages where wedding_id = new.id and state = 'draft'
    on conflict (wedding_id, state) do nothing;
  end if;
  return new;
end;
$$;

create trigger weddings_publish_on_paid after update of status on public.weddings
  for each row execute function app.publish_on_paid();
