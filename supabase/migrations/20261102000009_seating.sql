-- =============================================================================
-- Zasedací pořádek: půdorys sálu v úložišti a hromadné uložení plátna
-- =============================================================================

-- Půdorys sálu nahrává ten, kdo smí upravovat zasedací pořádek.
-- Cesta: <wedding_id>/plan-<náhodný název>.jpg
create policy seating_plan_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'site-media'
    and (string_to_array(name, '/'))[2] like 'plan-%'
    and app.can_write(app.storage_wedding(name), 'seating'));

-- Uložení plátna jedním voláním: prvky, které chybí, se smažou (i s rozsazením).
-- p_items: [{"id","kind","shape","label","seats","x","y","w","h","rotation"}]
create or replace function public.save_layout(p_event_id uuid, p_items jsonb, p_background text default null, p_clear_background boolean default false)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  w   uuid;
  lid uuid;
  it  jsonb;
  keep uuid[] := '{}';
begin
  select wedding_id into w from public.events where id = p_event_id;
  if w is null or not app.can_write(w, 'seating') then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  insert into public.venue_layouts (wedding_id, event_id) values (w, p_event_id)
  on conflict (event_id) do update set updated_at = now()
  returning id into lid;

  if p_clear_background then
    update public.venue_layouts set background_key = null where id = lid;
  elsif p_background is not null then
    if split_part(p_background, '/', 1) <> w::text then
      raise exception 'invalid_background' using errcode = 'P0001';
    end if;
    update public.venue_layouts set background_key = p_background where id = lid;
  end if;

  for it in select * from jsonb_array_elements(coalesce(p_items, '[]')) loop
    insert into public.layout_items (id, wedding_id, layout_id, kind, shape, label, seats, x, y, w, h, rotation, sort)
    values (
      (it ->> 'id')::uuid, w, lid, it ->> 'kind', it ->> 'shape', nullif(it ->> 'label', ''),
      coalesce((it ->> 'seats')::int, 0), (it ->> 'x')::float8, (it ->> 'y')::float8,
      (it ->> 'w')::float8, (it ->> 'h')::float8, coalesce((it ->> 'rotation')::float8, 0),
      coalesce((it ->> 'sort')::int, 0))
    on conflict (id) do update set
      kind = excluded.kind, shape = excluded.shape, label = excluded.label, seats = excluded.seats,
      x = excluded.x, y = excluded.y, w = excluded.w, h = excluded.h, rotation = excluded.rotation, sort = excluded.sort
    where public.layout_items.layout_id = lid;
    keep := keep || (it ->> 'id')::uuid;
  end loop;

  delete from public.layout_items where layout_id = lid and not (id = any (keep));
  return lid;
end;
$$;

revoke execute on function public.save_layout(uuid, jsonb, text, boolean) from public, anon;
grant execute on function public.save_layout(uuid, jsonb, text, boolean) to authenticated;

-- Úroveň oprávnění přihlášeného uživatele k modulu (pro skrytí ovládacích prvků v UI).
create or replace function public.my_module_level(p_wedding_id uuid, p_module text)
returns text language sql stable security definer set search_path = '' as $$
  select app.module_level(p_wedding_id, p_module)::text;
$$;
revoke execute on function public.my_module_level(uuid, text) from public, anon;
grant execute on function public.my_module_level(uuid, text) to authenticated;
