-- Kategorie úkolů checklistu (štítky v seznamu a filtr).
-- planning = plánování, guests = hosté, vendors = dodavatelé, attire = oblečení a prsteny,
-- ceremony = obřad a úřady, web = svatební web, day = den svatby.

alter table public.checklist_template_items
  add column category text check (category in ('planning', 'guests', 'vendors', 'attire', 'ceremony', 'web', 'day'));

alter table public.tasks
  add column category text check (category in ('planning', 'guests', 'vendors', 'attire', 'ceremony', 'web', 'day'));

update public.checklist_template_items set category = case title ->> 'cs'
    when 'Stanovit celkový rozpočet a kdo co platí' then 'planning'
    when 'Sestavit první seznam hostů' then 'guests'
    when 'Vybrat a rezervovat místo obřadu a hostiny' then 'vendors'
    when 'Rezervovat fotografa' then 'vendors'
    when 'Vybrat oddávajícího a zajistit termín na úřadě' then 'ceremony'
    when 'Rezervovat catering' then 'vendors'
    when 'Rezervovat hudbu (DJ nebo kapela)' then 'vendors'
    when 'Založit svatební web' then 'web'
    when 'Vybrat svatební šaty' then 'attire'
    when 'Zajistit ubytování pro hosty' then 'guests'
    when 'Objednat svatební oznámení' then 'guests'
    when 'Rezervovat květinovou výzdobu' then 'vendors'
    when 'Vybrat oblek pro ženicha' then 'attire'
    when 'Rozeslat oznámení s odkazem na web' then 'guests'
    when 'Objednat svatební dort' then 'vendors'
    when 'Vybrat snubní prsteny' then 'attire'
    when 'Domluvit kadeřnici a vizážistku' then 'vendors'
    when 'Odevzdat doklady na matriku' then 'ceremony'
    when 'Připomenout se hostům, kteří neodpověděli' then 'guests'
    when 'Uzavřít RSVP a poslat počty cateringu' then 'guests'
    when 'Dokončit zasedací pořádek' then 'guests'
    when 'Sestavit harmonogram dne D a sdílet ho s dodavateli' then 'day'
    when 'Doplatit zálohy dodavatelům' then 'vendors'
    when 'Vytisknout QR kartičky galerie na stoly' then 'day'
    when 'Připravit obálky s platbami pro dodavatele' then 'day'
    when 'Užít si svatbu' then 'day'
    when 'Poslat hostům poděkování' then 'guests'
    when 'Stáhnout všechny fotky z galerie' then 'day'
  end;

-- Úkoly už založených svateb převezmou kategorii ze šablony podle názvu.
update public.tasks t
   set category = c.category
  from public.checklist_template_items c
 where t.source = 'template'
   and t.category is null
   and t.title in (c.title ->> 'cs', c.title ->> 'en');

update public.tasks set category = 'guests' where system_key = 'rsvp.send_links' and category is null;

-- Nová svatba dostane úkoly i s kategorií.
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
  insert into public.tasks (wedding_id, title, description, offset_days, due_date, source, sort, category)
  select w,
         t.title ->> p_locale,
         nullif(t.description ->> p_locale, ''),
         t.offset_days,
         case when p_wedding_date is null then null else p_wedding_date + t.offset_days end,
         'template',
         t.sort,
         t.category
    from public.checklist_template_items t;

  -- Obsah webu (koncept) – sekce dle výchozí šablony
  insert into public.site_pages (wedding_id, state, template, sections, updated_by)
  values (w, 'draft', p_template, app.default_sections(), uid);

  insert into public.gift_settings (wedding_id) values (w);

  return w;
end;
$$;
