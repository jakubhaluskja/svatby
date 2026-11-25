-- Dary: rezervace a příspěvky hostů, evidence obdržených darů.

-- Překvapení: politika „for all“ dovolovala páru s právem zápisu rezervace číst.
-- Rezervace zakládá jen server (ověřený odkaz hosta); pár je může jen zrušit.
drop policy gift_reservations_write on public.gift_reservations;
create policy gift_reservations_delete on public.gift_reservations for delete using (app.can_write(wedding_id, 'gifts'));
create policy gift_reservations_update on public.gift_reservations for update
  using (app.can_write(wedding_id, 'gifts')
         and coalesce((select reveal_reservations from public.gift_settings s where s.wedding_id = gift_reservations.wedding_id), true))
  with check (app.can_write(wedding_id, 'gifts'));

-- Potvrzený příspěvek = obdržený dar (podklad pro poděkování); zrušení potvrzení ho odebere.
create or replace function app.sync_contribution_received()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  gift_title text;
begin
  if tg_op = 'DELETE' then
    delete from public.received_gifts where source = 'contribution' and source_id = old.id;
    return old;
  end if;
  if new.confirmed_at is not null and new.household_id is not null
     and (tg_op = 'INSERT' or old.confirmed_at is null) then
    select coalesce(title ->> 'cs', title ->> 'en') into gift_title from public.gifts where id = new.gift_id;
    insert into public.received_gifts (wedding_id, household_id, description, amount, source, source_id)
    values (new.wedding_id, new.household_id, coalesce(gift_title, 'Příspěvek'), new.amount, 'contribution', new.id);
  elsif new.confirmed_at is null and tg_op = 'UPDATE' and old.confirmed_at is not null then
    delete from public.received_gifts where source = 'contribution' and source_id = new.id;
  end if;
  return new;
end;
$$;

create trigger gift_contributions_received after insert or update of confirmed_at or delete on public.gift_contributions
  for each row execute function app.sync_contribution_received();

create unique index received_gifts_source on public.received_gifts (source, source_id) where source_id is not null;
create index on public.gift_reservations (household_id);
create index on public.gift_contributions (household_id);
