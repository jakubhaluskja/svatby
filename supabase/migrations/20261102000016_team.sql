-- Tým svatby: pozvání partnera a spoluorganizátorů, přijetí pozvánky.

-- Kdo pozvánku poslal (pozvánka platí 30 dní od posledního odeslání – viz accept_invite).
alter table public.wedding_members add column invited_by uuid references auth.users (id) on delete set null;

-- Pár nemůže člena „přijmout“ za někoho jiného ani mu podstrčit cizí účet:
-- user_id a accepted_at mění jen přijetí pozvánky (accept_invite).
create or replace function app.guard_member()
returns trigger language plpgsql set search_path = '' as $$
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;
  if tg_op = 'INSERT' then
    if new.user_id is not null or new.accepted_at is not null or new.role = 'owner' then
      raise exception 'member_fields_locked' using errcode = '42501';
    end if;
    new.invited_by := auth.uid();
  elsif new.user_id is distinct from old.user_id
     or new.accepted_at is distinct from old.accepted_at
     or new.role = 'owner' then
    raise exception 'member_fields_locked' using errcode = '42501';
  end if;
  -- Oprávnění jen známých modulů a úrovní.
  if exists (
    select 1 from jsonb_each_text(new.permissions) p
     where p.key not in ('guests', 'web', 'seating', 'lodging', 'checklist', 'budget', 'gifts', 'gallery')
        or p.value not in ('none', 'read', 'write', 'own')
        or (p.value = 'own' and p.key <> 'budget')
  ) then
    raise exception 'invalid_permissions' using errcode = '22023';
  end if;
  return new;
end;
$$;

create trigger wedding_members_guard before insert or update on public.wedding_members
  for each row execute function app.guard_member();

-- Jeden e-mail = jedna pozvánka do svatby.
create unique index wedding_members_invited_email on public.wedding_members (wedding_id, invited_email)
  where invited_email is not null;

-- Přijetí pozvánky přihlášeným uživatelem.
create or replace function public.accept_invite(p_token text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  m public.wedding_members;
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  select * into m from public.wedding_members where invite_token = p_token;
  if m.id is null then
    raise exception 'invite_not_found' using errcode = 'P0002';
  end if;
  if m.accepted_at is not null then
    if m.user_id = uid then
      return m.wedding_id;
    end if;
    raise exception 'invite_used' using errcode = 'P0001';
  end if;
  if m.invited_at < now() - interval '30 days' then
    raise exception 'invite_expired' using errcode = 'P0001';
  end if;
  -- Jedna svatba na účet.
  if exists (
    select 1 from public.wedding_members x join public.weddings w on w.id = x.wedding_id
     where x.user_id = uid and x.accepted_at is not null and w.status <> 'deleted'
  ) then
    raise exception 'already_member' using errcode = 'P0001';
  end if;

  update public.wedding_members
     set user_id = uid,
         accepted_at = now(),
         invite_token = app.random_token(24),
         display_name = coalesce(display_name, (select full_name from public.profiles where id = uid))
   where id = m.id;
  return m.wedding_id;
end;
$$;
revoke execute on function public.accept_invite(text) from public, anon;
grant execute on function public.accept_invite(text) to authenticated;
