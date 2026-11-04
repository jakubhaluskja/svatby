-- Administrace platformy: přehled klientů, úpravy, pozastavení služby.

-- Pozastavení služby (nezaplacení, porušení pravidel). Pozastavená svatba:
--  - web ani osobní odkazy hostů nejsou veřejně dostupné,
--  - pár i spoluorganizátoři data jen prohlížejí, nic nemění.
alter table public.weddings
  add column suspended_at     timestamptz,
  add column suspended_reason text check (suspended_reason in ('nonpayment', 'violation', 'other')),
  add column suspended_note   text,
  add column admin_note       text,
  add constraint weddings_suspension_consistent check ((suspended_at is null) = (suspended_reason is null));

-- Pár tyto sloupce nemění (rozšíření ochrany z migrace 11).
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
    or new.suspended_at is distinct from old.suspended_at
    or new.suspended_reason is distinct from old.suspended_reason
    or new.suspended_note is distinct from old.suspended_note
    or new.admin_note is distinct from old.admin_note
  ) then
    raise exception 'billing_columns_locked' using errcode = '42501';
  end if;
  return new;
end;
$$;

-- Pozastavená svatba: zápis se mění na čtení (platí pro všechny politiky přes can_write).
create or replace function app.is_suspended(w uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.weddings where id = w and suspended_at is not null);
$$;

create or replace function app.can_write(w uuid, module text)
returns boolean language sql stable set search_path = '' as $$
  select app.module_level(w, module) = 'write' and not app.is_suspended(w);
$$;

drop policy weddings_update on public.weddings;
create policy weddings_update on public.weddings
  for update using (app.is_couple(id) and suspended_at is null) with check (app.is_couple(id) and suspended_at is null);

drop policy members_manage on public.wedding_members;
create policy members_manage on public.wedding_members
  for all using (app.is_couple(wedding_id) and role <> 'owner' and not app.is_suspended(wedding_id))
  with check (app.is_couple(wedding_id) and role <> 'owner' and not app.is_suspended(wedding_id));

-- Úroveň přístupu pro UI (zohlední pozastavení).
create or replace function public.my_module_level(p_wedding_id uuid, p_module text)
returns text language sql stable security definer set search_path = '' as $$
  select case
           when app.is_suspended(p_wedding_id) and app.module_level(p_wedding_id, p_module) = 'write' then 'read'
           else app.module_level(p_wedding_id, p_module)::text
         end;
$$;

-- -----------------------------------------------------------------------------
-- Funkce administrace (jen správci platformy; vše se zapisuje do audit_log)
-- -----------------------------------------------------------------------------
create or replace function app.require_platform_admin(superadmin boolean default false)
returns void language plpgsql stable security definer set search_path = '' as $$
begin
  if superadmin and app.platform_role() is distinct from 'superadmin' then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if not app.is_platform_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
end;
$$;

create or replace function public.am_platform_admin()
returns text language sql stable security definer set search_path = '' as $$
  select app.platform_role()::text;
$$;
revoke execute on function public.am_platform_admin() from public, anon;
grant execute on function public.am_platform_admin() to authenticated;

-- Přehled všech klientů (svatba + vlastník + základní čísla).
create or replace function public.admin_clients()
returns table (
  id               uuid,
  slug             text,
  partner1_name    text,
  partner2_name    text,
  wedding_date     date,
  status           text,
  package          text,
  published_free   boolean,
  web_expires_at   timestamptz,
  suspended_at     timestamptz,
  suspended_reason text,
  created_at       timestamptz,
  owner_id         uuid,
  owner_email      text,
  owner_name       text,
  last_sign_in_at  timestamptz,
  households       int,
  guests           int,
  members          int
)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform app.require_platform_admin();
  return query
  select w.id, w.slug::text, w.partner1_name, w.partner2_name, w.wedding_date, w.status::text, w.package::text,
         w.published_free, w.web_expires_at, w.suspended_at, w.suspended_reason, w.created_at,
         o.user_id, u.email::text, p.full_name, u.last_sign_in_at,
         (select count(*)::int from public.households h where h.wedding_id = w.id),
         (select count(*)::int from public.guests g where g.wedding_id = w.id),
         (select count(*)::int from public.wedding_members m where m.wedding_id = w.id and m.accepted_at is not null)
    from public.weddings w
    left join lateral (
      select m.user_id from public.wedding_members m
       where m.wedding_id = w.id and m.role = 'owner'
       order by m.invited_at limit 1
    ) o on true
    left join auth.users u on u.id = o.user_id
    left join public.profiles p on p.id = o.user_id
   where w.status <> 'deleted'
   order by w.created_at desc;
end;
$$;
revoke execute on function public.admin_clients() from public, anon;
grant execute on function public.admin_clients() to authenticated;

-- Úprava údajů svatby správcem. Klíče v p_data: partner1_name, partner2_name, slug,
-- wedding_date, default_locale, package, status, web_expires_at, admin_note.
create or replace function public.admin_update_wedding(p_wedding_id uuid, p_data jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare
  before jsonb;
begin
  perform app.require_platform_admin();
  if (p_data ? 'package' or p_data ? 'status' or p_data ? 'web_expires_at') then
    perform app.require_platform_admin(true);
  end if;

  select jsonb_build_object('partner1_name', partner1_name, 'partner2_name', partner2_name, 'slug', slug,
           'wedding_date', wedding_date, 'default_locale', default_locale, 'package', package,
           'status', status, 'web_expires_at', web_expires_at, 'admin_note', admin_note)
    into before
    from public.weddings where id = p_wedding_id;
  if before is null then
    raise exception 'not_found' using errcode = 'P0002';
  end if;

  update public.weddings set
    partner1_name  = case when p_data ? 'partner1_name' then p_data ->> 'partner1_name' else partner1_name end,
    partner2_name  = case when p_data ? 'partner2_name' then p_data ->> 'partner2_name' else partner2_name end,
    slug           = case when p_data ? 'slug' then (p_data ->> 'slug')::extensions.citext else slug end,
    wedding_date   = case when p_data ? 'wedding_date' then (p_data ->> 'wedding_date')::date else wedding_date end,
    default_locale = case when p_data ? 'default_locale' then p_data ->> 'default_locale' else default_locale end,
    package        = case when p_data ? 'package' then (p_data ->> 'package')::app.package_kind else package end,
    status         = case when p_data ? 'status' then (p_data ->> 'status')::app.wedding_status else status end,
    published_at   = case when p_data ->> 'status' = 'published' then coalesce(published_at, now()) else published_at end,
    web_expires_at = case when p_data ? 'web_expires_at' then (p_data ->> 'web_expires_at')::timestamptz else web_expires_at end,
    admin_note     = case when p_data ? 'admin_note' then nullif(p_data ->> 'admin_note', '') else admin_note end,
    updated_at     = now()
  where id = p_wedding_id;

  insert into public.audit_log (actor_user_id, action, target_type, target_id, wedding_id, payload)
  values (auth.uid(), 'admin.update_wedding', 'wedding', p_wedding_id, p_wedding_id,
          jsonb_build_object('before', before, 'changes', p_data));
end;
$$;
revoke execute on function public.admin_update_wedding(uuid, jsonb) from public, anon;
grant execute on function public.admin_update_wedding(uuid, jsonb) to authenticated;

-- Pozastavení (p_reason = nonpayment / violation / other) nebo obnovení (p_reason = null).
create or replace function public.admin_set_suspension(p_wedding_id uuid, p_reason text, p_note text default null)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform app.require_platform_admin();
  update public.weddings
     set suspended_at     = case when p_reason is null then null else coalesce(suspended_at, now()) end,
         suspended_reason = p_reason,
         suspended_note   = case when p_reason is null then null else nullif(p_note, '') end,
         updated_at       = now()
   where id = p_wedding_id;
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  insert into public.audit_log (actor_user_id, action, target_type, target_id, wedding_id, payload)
  values (auth.uid(), case when p_reason is null then 'admin.unsuspend' else 'admin.suspend' end,
          'wedding', p_wedding_id, p_wedding_id, jsonb_build_object('reason', p_reason, 'note', p_note));
end;
$$;
revoke execute on function public.admin_set_suspension(uuid, text, text) from public, anon;
grant execute on function public.admin_set_suspension(uuid, text, text) to authenticated;

-- Záznam akce, kterou provádí server (přihlášení za klienta, změna e-mailu).
create or replace function public.admin_log(p_action text, p_wedding_id uuid, p_payload jsonb default '{}'::jsonb)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform app.require_platform_admin();
  insert into public.audit_log (actor_user_id, action, target_type, target_id, wedding_id, payload)
  values (auth.uid(), p_action, 'wedding', p_wedding_id, p_wedding_id, coalesce(p_payload, '{}'::jsonb));
end;
$$;
revoke execute on function public.admin_log(text, uuid, jsonb) from public, anon;
grant execute on function public.admin_log(text, uuid, jsonb) to authenticated;

-- Majitel služby.
insert into public.platform_admins (user_id, role)
select id, 'superadmin' from auth.users where email = 'info@jakubhaluska.cz'
on conflict (user_id) do nothing;
