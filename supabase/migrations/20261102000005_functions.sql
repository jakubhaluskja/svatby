-- =============================================================================
-- Doménové funkce: založení svatby, posun termínů, aktivace balíčku, RSVP hosta
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Založení svatby s výchozími daty (volá onboarding)
-- -----------------------------------------------------------------------------
create or replace function public.create_wedding(
  p_slug           text,
  p_partner1       text,
  p_partner2       text,
  p_wedding_date   date,
  p_locale         text default 'cs',
  p_template       text default 'modern',
  p_location_name  text default null,
  p_address        text default null
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  w   uuid;
  ev  uuid;
begin
  if uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  -- Jedna svatba na účet.
  if exists (select 1 from public.wedding_members m
               join public.weddings x on x.id = m.wedding_id
              where m.user_id = uid and m.role = 'owner' and x.status <> 'deleted') then
    raise exception 'wedding_exists' using errcode = 'P0001';
  end if;

  insert into public.weddings (slug, partner1_name, partner2_name, wedding_date,
                               default_locale, locales, template, created_by)
  values (lower(p_slug), p_partner1, p_partner2, p_wedding_date,
          p_locale, array[p_locale], p_template, uid)
  returning id into w;

  insert into public.wedding_members (wedding_id, user_id, role, accepted_at, invite_token)
  values (w, uid, 'owner', now(), null);

  -- Výchozí věkové kategorie
  insert into public.age_categories (wedding_id, name, min_age, max_age, is_adult, sort) values
    (w, '{"cs":"Dospělý","en":"Adult"}',          13, null, true,  0),
    (w, '{"cs":"Dítě 4–12 let","en":"Child 4–12"}', 4,  12,  false, 1),
    (w, '{"cs":"Dítě 0–3 roky","en":"Child 0–3"}',  0,  3,   false, 2);

  -- Výchozí událost (obřad) – pár ji upraví nebo přidá další
  insert into public.events (wedding_id, name, location_name, address, starts_at, sort, visibility)
  values (w, '{"cs":"Obřad","en":"Ceremony"}', p_location_name, p_address,
          case when p_wedding_date is null then null
               else (p_wedding_date + time '14:00') at time zone 'Europe/Prague' end,
          0, 'public')
  returning id into ev;

  -- Alba galerie
  insert into public.albums (wedding_id, kind, name, sort) values
    (w, 'guests',       '{"cs":"Od hostů","en":"From guests"}',            0),
    (w, 'photographer', '{"cs":"Od fotografa","en":"From the photographer"}', 1);

  -- Rozpočet ze šablony
  insert into public.budget_categories (wedding_id, name, sort)
  select w, t.name ->> p_locale, t.sort from public.budget_template_categories t;

  -- Checklist ze šablony
  insert into public.tasks (wedding_id, title, description, offset_days, due_date, source, sort)
  select w,
         t.title ->> p_locale,
         nullif(t.description ->> p_locale, ''),
         t.offset_days,
         case when p_wedding_date is null then null else p_wedding_date + t.offset_days end,
         'template',
         t.sort
    from public.checklist_template_items t;

  -- Obsah webu (koncept) – sekce dle výchozí šablony
  insert into public.site_pages (wedding_id, state, template, sections, updated_by)
  values (w, 'draft', p_template, app.default_sections(), uid);

  insert into public.gift_settings (wedding_id) values (w);

  return w;
end;
$$;

-- Výchozí sada sekcí webu (obsah doplní editor).
create or replace function app.default_sections()
returns jsonb language sql immutable as $$
  select jsonb_build_array(
    jsonb_build_object('id', 'hero',          'type', 'hero',          'enabled', true,  'content', '{}'::jsonb),
    jsonb_build_object('id', 'schedule',      'type', 'schedule',      'enabled', true,  'content', '{}'::jsonb),
    jsonb_build_object('id', 'location',      'type', 'location',      'enabled', true,  'content', '{}'::jsonb),
    jsonb_build_object('id', 'story',         'type', 'story',         'enabled', false, 'content', '{}'::jsonb),
    jsonb_build_object('id', 'dresscode',     'type', 'dresscode',     'enabled', false, 'content', '{}'::jsonb),
    jsonb_build_object('id', 'accommodation', 'type', 'accommodation', 'enabled', false, 'content', '{}'::jsonb),
    jsonb_build_object('id', 'gifts',         'type', 'gifts',         'enabled', false, 'content', '{}'::jsonb),
    jsonb_build_object('id', 'faq',           'type', 'faq',           'enabled', false, 'content', '{}'::jsonb),
    jsonb_build_object('id', 'contacts',      'type', 'contacts',      'enabled', false, 'content', '{}'::jsonb),
    jsonb_build_object('id', 'rsvp',          'type', 'rsvp',          'enabled', true,  'content', '{}'::jsonb)
  );
$$;

-- -----------------------------------------------------------------------------
-- Změna data svatby posune úkoly s relativním termínem
-- -----------------------------------------------------------------------------
create or replace function app.shift_task_dates()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.wedding_date is distinct from old.wedding_date then
    update public.tasks
       set due_date = case when new.wedding_date is null then null
                           else new.wedding_date + offset_days end
     where wedding_id = new.id and offset_days is not null and done_at is null;
  end if;
  return new;
end;
$$;

create trigger weddings_shift_tasks after update of wedding_date on public.weddings
  for each row execute function app.shift_task_dates();

-- -----------------------------------------------------------------------------
-- Aktivace balíčku po zaplacení (volá server se service_role z webhooku brány)
-- Web 12 měsíců po svatbě, galerie a data hostů 6 měsíců po svatbě.
-- -----------------------------------------------------------------------------
create or replace function public.apply_paid_order(p_order_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  o       public.orders;
  w       public.weddings;
  base_ts timestamptz;
  gb      constant bigint := 1024 * 1024 * 1024;
begin
  select * into o from public.orders where id = p_order_id for update;
  if o.status <> 'paid' then
    raise exception 'order_not_paid';
  end if;
  select * into w from public.weddings where id = o.wedding_id for update;

  base_ts := coalesce(w.wedding_date::timestamptz, now());

  case o.product
    when 'web' then
      update public.weddings set
        package = case when package = 'web_gallery' then package else 'web' end,
        status = 'published',
        published_at = coalesce(published_at, now()),
        web_expires_at = greatest(coalesce(web_expires_at, base_ts), base_ts + interval '12 months'),
        guest_data_anonymize_at = base_ts + interval '6 months'
      where id = w.id;
    when 'web_gallery' then
      update public.weddings set
        package = 'web_gallery',
        status = 'published',
        published_at = coalesce(published_at, now()),
        web_expires_at = greatest(coalesce(web_expires_at, base_ts), base_ts + interval '12 months'),
        gallery_expires_at = base_ts + interval '6 months',
        gallery_quota_bytes = greatest(gallery_quota_bytes, 50 * gb),
        guest_data_anonymize_at = base_ts + interval '6 months'
      where id = w.id;
    when 'upgrade_gallery' then
      update public.weddings set
        package = 'web_gallery',
        gallery_expires_at = base_ts + interval '6 months',
        gallery_quota_bytes = greatest(gallery_quota_bytes, 50 * gb)
      where id = w.id;
    when 'gallery_extension' then
      update public.weddings set
        gallery_expires_at = coalesce(gallery_expires_at, base_ts) + (o.quantity * interval '6 months')
      where id = w.id;
    when 'gallery_capacity' then
      update public.weddings set
        gallery_quota_bytes = gallery_quota_bytes + o.quantity * 25 * gb
      where id = w.id;
  end case;

  -- systémový úkol po zveřejnění
  if o.product in ('web', 'web_gallery') then
    insert into public.tasks (wedding_id, title, due_date, source, system_key)
    values (w.id, 'Rozeslat hostům osobní odkazy na RSVP', current_date + 7, 'system', 'rsvp.send_links')
    on conflict (wedding_id, system_key) do nothing;
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- Odeslání RSVP hostem přes osobní odkaz (volá server se service_role)
-- p_payload:
-- {
--   "guests": [{"id": "...", "first_name"?, "last_name"?, "diet": "...", "allergies": "...",
--               "age_category_id"?: "...",
--               "events": {"<event_id>": "yes" | "no"}}],
--   "plus_ones": [{"first_name": "...", "last_name": "...", "age_category_id": "...",
--                  "diet": "...", "allergies": "...", "events": {...}}],
--   "needs_lodging": true, "lodging_note": "...", "song_wish": "...", "message": "...",
--   "email": "..."
-- }
-- -----------------------------------------------------------------------------
create or replace function public.submit_household_rsvp(p_token text, p_payload jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  h          public.households;
  w          public.weddings;
  g          jsonb;
  ev         record;
  v_guest    uuid;
  plus_count int;
  existing_plus int;
begin
  select * into h from public.households where token = p_token;
  if h.id is null then
    raise exception 'household_not_found' using errcode = 'P0002';
  end if;
  select * into w from public.weddings where id = h.wedding_id;

  if w.status <> 'published' then
    raise exception 'wedding_not_published' using errcode = 'P0001';
  end if;
  if w.rsvp_deadline is not null and now() > w.rsvp_deadline then
    raise exception 'rsvp_closed' using errcode = 'P0001';
  end if;

  -- Členové domácnosti
  for g in select * from jsonb_array_elements(coalesce(p_payload -> 'guests', '[]'::jsonb)) loop
    v_guest := (g ->> 'id')::uuid;
    if not exists (select 1 from public.guests where id = v_guest and household_id = h.id) then
      raise exception 'guest_not_in_household' using errcode = 'P0001';
    end if;

    update public.guests set
      diet      = coalesce(nullif(g ->> 'diet', ''), case when g ? 'diet' then null else diet end),
      allergies = coalesce(nullif(g ->> 'allergies', ''), case when g ? 'allergies' then null else allergies end),
      first_name = case when is_plus_one and g ? 'first_name' then g ->> 'first_name' else first_name end,
      last_name  = case when is_plus_one and g ? 'last_name'  then g ->> 'last_name'  else last_name end
    where id = v_guest;

    for ev in select key::uuid as event_id, value #>> '{}' as status
                from jsonb_each(coalesce(g -> 'events', '{}'::jsonb)) loop
      if not exists (select 1 from public.household_events
                      where household_id = h.id and event_id = ev.event_id) then
        raise exception 'event_not_invited' using errcode = 'P0001';
      end if;
      insert into public.rsvp_responses (guest_id, event_id, wedding_id, status, updated_by, updated_at)
      values (v_guest, ev.event_id, h.wedding_id, ev.status::app.rsvp_status, 'guest', now())
      on conflict (guest_id, event_id) do update
        set status = excluded.status, updated_by = 'guest', updated_at = now();
    end loop;
  end loop;

  -- Doprovod (+1)
  select count(*) into existing_plus from public.guests where household_id = h.id and is_plus_one;
  plus_count := jsonb_array_length(coalesce(p_payload -> 'plus_ones', '[]'::jsonb));
  if existing_plus + plus_count > h.plus_ones_allowed then
    raise exception 'too_many_plus_ones' using errcode = 'P0001';
  end if;

  for g in select * from jsonb_array_elements(coalesce(p_payload -> 'plus_ones', '[]'::jsonb)) loop
    insert into public.guests (wedding_id, household_id, first_name, last_name, age_category_id,
                               is_plus_one, diet, allergies, sort)
    values (h.wedding_id, h.id, g ->> 'first_name', nullif(g ->> 'last_name', ''),
            (select id from public.age_categories
              where id = nullif(g ->> 'age_category_id', '')::uuid and wedding_id = h.wedding_id),
            true, nullif(g ->> 'diet', ''), nullif(g ->> 'allergies', ''), 1000)
    returning id into v_guest;

    for ev in select key::uuid as event_id, value #>> '{}' as status
                from jsonb_each(coalesce(g -> 'events', '{}'::jsonb)) loop
      if exists (select 1 from public.household_events
                  where household_id = h.id and event_id = ev.event_id) then
        insert into public.rsvp_responses (guest_id, event_id, wedding_id, status, updated_by)
        values (v_guest, ev.event_id, h.wedding_id, ev.status::app.rsvp_status, 'guest');
      end if;
    end loop;
  end loop;

  update public.households set
    needs_lodging     = coalesce((p_payload ->> 'needs_lodging')::boolean, needs_lodging),
    lodging_note      = coalesce(p_payload ->> 'lodging_note', lodging_note),
    song_wish         = coalesce(p_payload ->> 'song_wish', song_wish),
    message           = coalesce(p_payload ->> 'message', message),
    email             = coalesce(nullif(p_payload ->> 'email', '')::extensions.citext, email),
    rsvp_submitted_at = now()
  where id = h.id;

  insert into public.rsvp_log (wedding_id, household_id, actor_kind, payload)
  values (h.wedding_id, h.id, 'guest', p_payload);

  return jsonb_build_object('ok', true, 'household_id', h.id);
end;
$$;

revoke execute on function public.submit_household_rsvp(text, jsonb) from public, anon, authenticated;
revoke execute on function public.apply_paid_order(uuid) from public, anon, authenticated;
grant execute on function public.submit_household_rsvp(text, jsonb) to service_role;
grant execute on function public.apply_paid_order(uuid) to service_role;
grant execute on function public.create_wedding(text, text, text, date, text, text, text, text) to authenticated;

-- -----------------------------------------------------------------------------
-- Přehled RSVP: matice událost × věková kategorie (dashboard, export pro catering)
-- -----------------------------------------------------------------------------
create or replace view public.rsvp_event_summary
with (security_invoker = true) as
select
  e.wedding_id,
  e.id   as event_id,
  ac.id  as age_category_id,
  count(*) filter (where r.status = 'yes')                        as yes_count,
  count(*) filter (where r.status = 'no')                         as no_count,
  count(*) filter (where r.status = 'pending' or r.status is null) as pending_count
from public.events e
join public.household_events he on he.event_id = e.id
join public.guests g on g.household_id = he.household_id
left join public.age_categories ac on ac.id = g.age_category_id
left join public.rsvp_responses r on r.guest_id = g.id and r.event_id = e.id
group by e.wedding_id, e.id, ac.id;
