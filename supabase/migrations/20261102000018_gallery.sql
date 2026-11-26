-- Fotogalerie pro hosty (nahrávání přes QR), živá prezentace, kniha přání.

-- Pár galerii zapíná sám (odkaz na webu + QR pro hosty).
alter table public.weddings add column gallery_enabled boolean not null default false;

-- Soubory galerie: soukromé úložiště, přístup jen přes server (podepsané odkazy).
-- Cesta: <wedding_id>/<media_id>/{original|preview|thumb}.<ext>
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('gallery', 'gallery', false, 209715200,
        array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'video/mp4', 'video/quicktime', 'video/webm'])
on conflict (id) do nothing;

-- Kniha přání.
create table public.guestbook_entries (
  id            uuid primary key default gen_random_uuid(),
  wedding_id    uuid not null references public.weddings (id) on delete cascade,
  household_id  uuid references public.households (id) on delete set null,
  name          text not null check (char_length(name) between 1 and 80),
  message       text not null check (char_length(message) between 1 and 1000),
  hidden_at     timestamptz,
  created_at    timestamptz not null default now()
);
create index on public.guestbook_entries (wedding_id, created_at desc);

alter table public.guestbook_entries enable row level security;
create policy guestbook_entries_read on public.guestbook_entries for select using (app.can_read(wedding_id, 'gallery'));
-- Zápisy zakládá server (host bez účtu); pár je skrývá a maže.
create policy guestbook_entries_update on public.guestbook_entries for update
  using (app.can_write(wedding_id, 'gallery')) with check (app.can_write(wedding_id, 'gallery'));
create policy guestbook_entries_delete on public.guestbook_entries for delete using (app.can_write(wedding_id, 'gallery'));

-- Fotky zakládá taky jen server (kontrola místa a moderace); pár mění stav a maže.
-- Obecná politika zápisu už nic nevloží; úpravy povoluje samostatná politika.
alter policy media_write on public.media with check (false);
create policy media_update on public.media for update using (app.can_write(wedding_id, 'gallery')) with check (app.can_write(wedding_id, 'gallery'));

-- Hosté nemění velikost ani cestu souboru (počítání místa v galerii).
create or replace function app.guard_media()
returns trigger language plpgsql set search_path = '' as $$
begin
  if current_user in ('authenticated', 'anon') and (
       new.storage_key is distinct from old.storage_key
    or new.thumb_key is distinct from old.thumb_key
    or new.preview_key is distinct from old.preview_key
    or new.bytes is distinct from old.bytes
    or new.wedding_id is distinct from old.wedding_id
  ) then
    raise exception 'media_fields_locked' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger media_guard before update on public.media for each row execute function app.guard_media();

-- Starší svatby bez systémových alb.
insert into public.albums (wedding_id, kind, name, sort)
select w.id, 'guests', '{"cs":"Od hostů","en":"From guests"}', 0 from public.weddings w
 where not exists (select 1 from public.albums a where a.wedding_id = w.id and a.kind = 'guests');
insert into public.albums (wedding_id, kind, name, sort)
select w.id, 'photographer', '{"cs":"Od fotografa","en":"From the photographer"}', 1 from public.weddings w
 where not exists (select 1 from public.albums a where a.wedding_id = w.id and a.kind = 'photographer');
