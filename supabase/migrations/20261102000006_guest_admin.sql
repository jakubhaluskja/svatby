-- =============================================================================
-- Správa hostů párem: zápis do historie RSVP, nový osobní odkaz, uložení domácnosti
-- =============================================================================

-- Pár zapisuje změny odpovědí do historie pod svým jménem.
create policy rsvp_log_member_insert on public.rsvp_log
  for insert with check (
    app.can_write(wedding_id, 'guests') and actor_kind = 'member' and actor_user_id = auth.uid());

-- Nový osobní odkaz a kód domácnosti (starý přestane fungovat).
create or replace function public.regenerate_household_link(p_household_id uuid)
returns table (new_token text, new_short_code text)
language plpgsql security definer set search_path = '' as $$
declare
  w uuid;
begin
  select wedding_id into w from public.households where id = p_household_id;
  if w is null or not app.can_write(w, 'guests') then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  for i in 1 .. 5 loop
    begin
      return query
        update public.households h
           set token = app.random_token(24), short_code = app.random_code(6)
         where h.id = p_household_id
        returning h.token, h.short_code;
      return;
    exception when unique_violation then
      -- vzácná kolize kódu v rámci svatby – zkusíme znovu
    end;
  end loop;
  raise exception 'code_collision';
end;
$$;

grant execute on function public.regenerate_household_link(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- Uložení domácnosti jedním voláním (formulář v administraci)
-- p_data:
-- {
--   "id": null | "<uuid>",
--   "name": "Novákovi", "locale": "cs", "email": "...", "plus_ones_allowed": 1, "notes": "...",
--   "event_ids": ["<uuid>", ...],
--   "guests": [{"id": null | "<uuid>", "first_name": "...", "last_name": "...",
--               "age_category_id": "<uuid>" | null, "needs_high_chair": false,
--               "email": "...", "notes": "...", "tags": ["Rodina nevěsty", ...]}]
-- }
-- Hosté, kteří ve výčtu chybí, se smažou.
-- -----------------------------------------------------------------------------
create or replace function public.save_household(p_wedding_id uuid, p_data jsonb)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  hid    uuid := nullif(p_data ->> 'id', '')::uuid;
  g      jsonb;
  gid    uuid;
  keep   uuid[] := '{}';
  tag    text;
  tid    uuid;
  pos    int := 0;
begin
  if not app.can_write(p_wedding_id, 'guests') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if coalesce(trim(p_data ->> 'name'), '') = '' then
    raise exception 'name_required' using errcode = 'P0001';
  end if;
  if jsonb_array_length(coalesce(p_data -> 'guests', '[]')) = 0 then
    raise exception 'guests_required' using errcode = 'P0001';
  end if;

  if hid is null then
    insert into public.households (wedding_id, name, locale, email, plus_ones_allowed, notes, sort)
    values (p_wedding_id, trim(p_data ->> 'name'), coalesce(p_data ->> 'locale', 'cs'),
            nullif(trim(p_data ->> 'email'), '')::extensions.citext,
            coalesce((p_data ->> 'plus_ones_allowed')::int, 0), nullif(p_data ->> 'notes', ''),
            (select coalesce(max(sort), 0) + 1 from public.households where wedding_id = p_wedding_id))
    returning id into hid;
  else
    update public.households set
      name = trim(p_data ->> 'name'),
      locale = coalesce(p_data ->> 'locale', locale),
      email = nullif(trim(p_data ->> 'email'), '')::extensions.citext,
      plus_ones_allowed = coalesce((p_data ->> 'plus_ones_allowed')::int, plus_ones_allowed),
      notes = nullif(p_data ->> 'notes', '')
    where id = hid and wedding_id = p_wedding_id;
    if not found then
      raise exception 'household_not_found' using errcode = 'P0002';
    end if;
  end if;

  -- Hosté
  for g in select * from jsonb_array_elements(p_data -> 'guests') loop
    gid := nullif(g ->> 'id', '')::uuid;
    if coalesce(trim(g ->> 'first_name'), '') = '' then
      continue;
    end if;
    if gid is null then
      insert into public.guests (wedding_id, household_id, first_name, last_name, age_category_id,
                                 needs_high_chair, email, notes, sort)
      values (p_wedding_id, hid, trim(g ->> 'first_name'), nullif(trim(g ->> 'last_name'), ''),
              (select id from public.age_categories
                where id = nullif(g ->> 'age_category_id', '')::uuid and wedding_id = p_wedding_id),
              coalesce((g ->> 'needs_high_chair')::boolean, false),
              nullif(trim(g ->> 'email'), '')::extensions.citext, nullif(g ->> 'notes', ''), pos)
      returning id into gid;
    else
      update public.guests set
        first_name = trim(g ->> 'first_name'),
        last_name = nullif(trim(g ->> 'last_name'), ''),
        age_category_id = (select id from public.age_categories
                            where id = nullif(g ->> 'age_category_id', '')::uuid and wedding_id = p_wedding_id),
        needs_high_chair = coalesce((g ->> 'needs_high_chair')::boolean, false),
        email = nullif(trim(g ->> 'email'), '')::extensions.citext,
        notes = nullif(g ->> 'notes', ''),
        sort = pos
      where id = gid and household_id = hid;
      if not found then
        raise exception 'guest_not_in_household' using errcode = 'P0001';
      end if;
    end if;
    keep := keep || gid;
    pos := pos + 1;

    -- Štítky (vytvoří se, pokud neexistují)
    delete from public.guest_tags where guest_id = gid;
    for tag in select distinct trim(value) from jsonb_array_elements_text(coalesce(g -> 'tags', '[]')) as value
                where trim(value) <> '' loop
      insert into public.tags (wedding_id, name) values (p_wedding_id, tag)
      on conflict (wedding_id, name) do update set name = excluded.name
      returning id into tid;
      insert into public.guest_tags (guest_id, tag_id, wedding_id) values (gid, tid, p_wedding_id);
    end loop;
  end loop;

  delete from public.guests where household_id = hid and not (id = any (keep));

  -- Pozvání na události
  delete from public.household_events
   where household_id = hid
     and not (event_id::text in (select jsonb_array_elements_text(coalesce(p_data -> 'event_ids', '[]'))));
  insert into public.household_events (household_id, event_id, wedding_id)
  select hid, e.id, p_wedding_id
    from public.events e
   where e.wedding_id = p_wedding_id
     and e.id::text in (select jsonb_array_elements_text(coalesce(p_data -> 'event_ids', '[]')))
  on conflict do nothing;

  return hid;
end;
$$;

grant execute on function public.save_household(uuid, jsonb) to authenticated;
