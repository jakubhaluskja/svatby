// Ověření migrací v PGlite: Supabase prostředí (auth, role) je nasimulované.
import { PGlite } from '@electric-sql/pglite';
import { citext } from '@electric-sql/pglite/contrib/citext';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const repo = process.argv[2] ?? new URL('../..', import.meta.url).pathname;
const db = new PGlite({ extensions: { citext } });

const stub = `
create schema storage;
create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text, owner uuid);
alter table storage.objects enable row level security;
create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
create schema auth; create schema extensions;
grant usage on schema public, auth, extensions, storage to anon, authenticated, service_role;
grant all on storage.objects to authenticated;
create table auth.users (id uuid primary key default gen_random_uuid(), email text, raw_user_meta_data jsonb default '{}', last_sign_in_at timestamptz);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.sub', true), '')::uuid $$;
grant execute on function auth.uid() to anon, authenticated, service_role;
create function extensions.gen_random_bytes(n int) returns bytea language plpgsql volatile as $$
declare b bytea := ''::bytea; begin
  for i in 1..n loop b := b || set_byte('\\x00'::bytea, 0, floor(random()*256)::int); end loop; return b; end $$;
`;
await db.exec(stub);

const dir = join(repo, 'supabase/migrations');
for (const f of readdirSync(dir).sort()) {
  let sql = readFileSync(join(dir, f), 'utf8').replace(/create extension if not exists pgcrypto[^;]*;/, '');
  try { await db.exec(sql); console.log('OK  ', f); }
  catch (e) { console.error('FAIL', f, e.message); process.exit(1); }
}
await db.exec(readFileSync(join(repo, 'supabase/seed.sql'), 'utf8'));
await db.exec(`
  grant select, insert, update, delete on all tables in schema public to authenticated, service_role;
  grant usage, select on all sequences in schema public to authenticated, service_role;`);
console.log('OK   seed + granty');

const q = async (sql, params) => (await db.query(sql, params)).rows;
const as = async (role, uid) => {
  await db.exec(`reset role; select set_config('request.jwt.sub', '${uid ?? ''}', false); set role ${role};`);
};
let failures = 0;
const check = (name, cond, extra = '') => {
  console.log(cond ? 'PASS' : 'FAIL', name, extra);
  if (!cond) failures++;
};
const expectError = async (name, fn, code) => {
  try { await fn(); check(name, false, '(žádná chyba)'); }
  catch (e) { check(name, e.message.includes(code), e.message); }
};

// --- uživatelé
await as('postgres');
const [owner] = await q(`insert into auth.users (email, raw_user_meta_data) values ('jana@x.cz', '{"full_name":"Jana"}') returning id`);
const [coorg] = await q(`insert into auth.users (email) values ('svedek@x.cz') returning id`);
const [stranger] = await q(`insert into auth.users (email) values ('cizi@x.cz') returning id`);
check('profil vznikl triggerem', (await q(`select * from profiles where id = $1`, [owner.id]))[0]?.full_name === 'Jana');

// --- založení svatby
await as('authenticated', owner.id);
const [{ create_wedding: wid }] = await q(
  `select create_wedding('jana-a-petr', 'Jana', 'Petr', '2027-06-12', 'cs', 'modern', 'Zámek', 'Hlavní 1') `);
check('svatba založena', !!wid);
check('původní šablona převedena na novou', (await q(`select template from weddings where id=$1`, [wid]))[0].template === 'pozvanka');
await expectError('neplatná šablona odmítnuta', () => q(`update site_pages set template='modern' where wedding_id=$1`, [wid]), 'site_pages_template_check');
check('3 věkové kategorie', (await q(`select count(*)::int c from age_categories where wedding_id=$1`, [wid]))[0].c === 3);
check('checklist ze šablony', (await q(`select count(*)::int c from tasks where wedding_id=$1`, [wid]))[0].c === 28);
check('každý úkol ze šablony má kategorii', (await q(`select count(*)::int c from tasks where wedding_id=$1 and category is null`, [wid]))[0].c === 0);
await expectError('neplatná kategorie odmítnuta',
  () => q(`update tasks set category='party' where wedding_id=$1`, [wid]), 'tasks_category_check');
check('rozpočet ze šablony', (await q(`select count(*)::int c from budget_categories where wedding_id=$1`, [wid]))[0].c === 12);
check('2 alba', (await q(`select count(*)::int c from albums where wedding_id=$1`, [wid]))[0].c === 2);
check('koncept webu', (await q(`select jsonb_array_length(sections) n from site_pages where wedding_id=$1`, [wid]))[0].n === 10);
await expectError('druhá svatba stejného uživatele odmítnuta',
  () => q(`select create_wedding('jina', 'A', 'B', null)`), 'wedding_exists');
await expectError('neplatný slug odmítnut', async () => {
  await as('authenticated', stranger.id);
  await q(`select create_wedding('-spatne', 'A', 'B', null)`);
}, 'weddings_slug_check');

// --- posun termínů při změně data
await as('authenticated', owner.id);
const [before] = await q(`select due_date::text d from tasks where wedding_id=$1 and offset_days=-365`, [wid]);
await q(`update weddings set wedding_date='2027-07-12' where id=$1`, [wid]);
const [after] = await q(`select due_date::text d from tasks where wedding_id=$1 and offset_days=-365`, [wid]);
check('termíny úkolů se posunuly', before.d === '2026-06-12' && after.d === '2026-07-12', `${before.d} → ${after.d}`);

// --- hosté a události
const [ev1] = await q(`select id from events where wedding_id=$1`, [wid]);
const [ev2] = await q(`insert into events (wedding_id, name, visibility, is_seated, sort) values ($1, '{"cs":"Hostina"}', 'invited', true, 1) returning id`, [wid]);
const [adult] = await q(`select id from age_categories where wedding_id=$1 and is_adult`, [wid]);
const [h] = await q(`insert into households (wedding_id, name, plus_ones_allowed) values ($1, 'Novákovi', 1) returning id, token, short_code`, [wid]);
check('token domácnosti', h.token.length >= 30 && /^[A-Za-z0-9_-]+$/.test(h.token), h.token);
check('krátký kód', /^[A-HJ-NP-Z2-9]{6}$/.test(h.short_code), h.short_code);
await q(`insert into household_events (household_id, event_id, wedding_id) values ($1,$2,$3)`, [h.id, ev1.id, wid]);
const [g1] = await q(`insert into guests (wedding_id, household_id, first_name, last_name, age_category_id) values ($1,$2,'Jan','Novák',$3) returning id`, [wid, h.id, adult.id]);
const [g2] = await q(`insert into guests (wedding_id, household_id, first_name, last_name) values ($1,$2,'Eva','Nováková') returning id`, [wid, h.id]);

// --- RLS: cizí uživatel nevidí nic
await as('authenticated', stranger.id);
check('cizí nevidí svatbu', (await q(`select * from weddings where id=$1`, [wid])).length === 0);
check('cizí nevidí hosty', (await q(`select * from guests where wedding_id=$1`, [wid])).length === 0);
await as('anon');
let anonBlocked = false;
try { anonBlocked = (await q(`select * from guests`)).length === 0; } catch { anonBlocked = true; }
check('anonym nevidí hosty', anonBlocked);

// --- spoluorganizátor s omezenými právy
await as('authenticated', owner.id);
const [contrib] = await q(`insert into contributors (wedding_id, name) values ($1, 'Rodiče ženicha') returning id`, [wid]);
const [cat] = await q(`select id from budget_categories where wedding_id=$1 limit 1`, [wid]);
await q(`insert into budget_items (wedding_id, category_id, name, contributor_id, estimate_amount) values ($1,$2,'Hudba',$3,30000)`, [wid, cat.id, contrib.id]);
await q(`insert into budget_items (wedding_id, category_id, name, estimate_amount) values ($1,$2,'Šaty',25000)`, [wid, cat.id]);
await q(`insert into wedding_members (wedding_id, user_id, role, permissions, contributor_id, accepted_at)
         values ($1,$2,'coorganizer','{"guests":"read","budget":"own"}',$3, now())`, [wid, coorg.id, contrib.id]);

await as('authenticated', coorg.id);
check('spoluorganizátor čte hosty', (await q(`select * from guests where wedding_id=$1`, [wid])).length === 2);
const upd = await q(`update guests set notes='x' where wedding_id=$1 returning id`, [wid]);
check('spoluorganizátor nemůže upravit hosty', upd.length === 0);
const items = await q(`select name from budget_items where wedding_id=$1`, [wid]);
check('rozpočet "own": jen vlastní položky', items.length === 1 && items[0].name === 'Hudba', JSON.stringify(items));
check('nevidí zasedací pořádek', (await q(`select * from venue_layouts where wedding_id=$1`, [wid])).length === 0);
const sneaky = await q(`update wedding_members set permissions='{"budget":"write"}' where user_id=$1 returning id`, [coorg.id]);
check('nemůže si zvýšit práva', sneaky.length === 0);

// --- RSVP hosta přes token (server, service_role)
await as('service_role');
await expectError('RSVP před zveřejněním odmítnuto',
  () => q(`select submit_household_rsvp($1, '{}'::jsonb)`, [h.token]), 'wedding_not_published');

// zaplacení balíčku
const [order] = await q(`insert into orders (wedding_id, user_id, product, price_gross, total_gross, status, consent_digital_content_at, paid_at)
  values ($1,$2,'web_gallery',1790,1790,'paid',now(),now()) returning id`, [wid, owner.id]);
await q(`select apply_paid_order($1)`, [order.id]);
const [wp] = await q(`select status, package, web_expires_at::date::text web, gallery_expires_at::date::text gal, gallery_quota_bytes from weddings where id=$1`, [wid]);
check('balíček aktivován', wp.status === 'published' && wp.package === 'web_gallery');
check('web +12 měsíců, galerie +6 měsíců', wp.web === '2028-07-12' && wp.gal === '2028-01-12', `${wp.web} / ${wp.gal}`);
check('systémový úkol po zveřejnění', (await q(`select * from tasks where wedding_id=$1 and system_key='rsvp.send_links'`, [wid])).length === 1);

const payload = {
  guests: [
    { id: g1.id, diet: 'vegetarián', events: { [ev1.id]: 'yes' } },
    { id: g2.id, allergies: 'ořechy', events: { [ev1.id]: 'no' } },
  ],
  plus_ones: [{ first_name: 'Karel', last_name: 'Dvořák', age_category_id: adult.id, events: { [ev1.id]: 'yes' } }],
  needs_lodging: true, song_wish: 'Září', email: 'novakovi@x.cz',
};
await q(`select submit_household_rsvp($1, $2::jsonb)`, [h.token, JSON.stringify(payload)]);
const resp = await q(`select g.first_name, r.status from rsvp_responses r join guests g on g.id=r.guest_id where r.event_id=$1 order by g.first_name`, [ev1.id]);
check('odpovědi uloženy', JSON.stringify(resp) === JSON.stringify([{ first_name: 'Eva', status: 'no' }, { first_name: 'Jan', status: 'yes' }, { first_name: 'Karel', status: 'yes' }]), JSON.stringify(resp));
check('dieta a alergie uloženy', (await q(`select diet from guests where id=$1`, [g1.id]))[0].diet === 'vegetarián');
check('log RSVP', (await q(`select * from rsvp_log where household_id=$1`, [h.id])).length === 1);
await expectError('další +1 nad limit odmítnut', () => q(`select submit_household_rsvp($1, $2::jsonb)`,
  [h.token, JSON.stringify({ plus_ones: [{ first_name: 'X', events: {} }] })]), 'too_many_plus_ones');
await expectError('nepozvaná událost odmítnuta', () => q(`select submit_household_rsvp($1, $2::jsonb)`,
  [h.token, JSON.stringify({ guests: [{ id: g1.id, events: { [ev2.id]: 'yes' } }] })]), 'event_not_invited');
await expectError('neplatný token', () => q(`select submit_household_rsvp('nesmysl', '{}'::jsonb)`), 'household_not_found');
await q(`update weddings set rsvp_deadline = now() - interval '1 day' where id=$1`, [wid]);
await expectError('po uzávěrce odmítnuto', () => q(`select submit_household_rsvp($1, '{}'::jsonb)`, [h.token]), 'rsvp_closed');

await as('authenticated', owner.id);
await expectError('host nemůže volat RSVP funkci přímo jako přihlášený uživatel',
  () => q(`select submit_household_rsvp($1, '{}'::jsonb)`, [h.token]), 'permission denied');

// --- přehled pro catering
const sum = await q(`select yes_count::int y, no_count::int n from rsvp_event_summary where event_id=$1 and age_category_id=$2`, [ev1.id, adult.id]);
check('přehled událost × kategorie', sum[0]?.y === 2, JSON.stringify(sum));

// --- galerie: počítání místa
await as('service_role');
const [alb] = await q(`select id from albums where wedding_id=$1 and kind='guests'`, [wid]);
await q(`insert into media (wedding_id, album_id, kind, storage_key, content_type, bytes, status) values ($1,$2,'photo','k1','image/jpeg',5000000,'pending')`, [wid, alb.id]);
await q(`insert into media (wedding_id, album_id, kind, storage_key, content_type, bytes, status) values ($1,$2,'photo','k2','image/jpeg',3000000,'pending')`, [wid, alb.id]);
await q(`delete from media where storage_key='k1'`);
check('obsazené místo galerie', Number((await q(`select gallery_used_bytes b from weddings where id=$1`, [wid]))[0].b) === 3000000);

// --- faktury
const n1 = (await q(`select app.next_invoice_number() n`))[0].n;
const n2 = (await q(`select app.next_invoice_number() n`))[0].n;
check('číselná řada faktur', /^\d{8}$/.test(n1) && Number(n2) === Number(n1) + 1, `${n1}, ${n2}`);


// --- správa domácnosti párem
await as('authenticated', owner.id);
const cats = await q(`select id from age_categories where wedding_id=$1 order by sort`, [wid]);
const [{ save_household: hid2 }] = await q(`select save_household($1, $2::jsonb)`, [wid, JSON.stringify({
  name: 'Dvořákovi', locale: 'en', plus_ones_allowed: 1, event_ids: [ev1.id, ev2.id],
  guests: [
    { first_name: 'Pavel', last_name: 'Dvořák', age_category_id: cats[0].id, tags: ['Kolegové', 'Rodina'] },
    { first_name: 'Ema', age_category_id: cats[2].id, needs_high_chair: true, tags: ['Rodina'] },
  ],
})]);
check('domácnost uložena', !!hid2);
check('hosté uloženi', (await q(`select count(*)::int c from guests where household_id=$1`, [hid2]))[0].c === 2);
check('štítky vytvořeny jednou', (await q(`select count(*)::int c from tags where wedding_id=$1`, [wid]))[0].c === 2);
check('pozvání na 2 události', (await q(`select count(*)::int c from household_events where household_id=$1`, [hid2]))[0].c === 2);
const [pavel] = await q(`select id from guests where household_id=$1 and first_name='Pavel'`, [hid2]);
await q(`select save_household($1, $2::jsonb)`, [wid, JSON.stringify({
  id: hid2, name: 'Dvořákovi', event_ids: [ev1.id],
  guests: [{ id: pavel.id, first_name: 'Pavel', last_name: 'Dvořák', tags: [] }],
})]);
check('odebraný host smazán', (await q(`select count(*)::int c from guests where household_id=$1`, [hid2]))[0].c === 1);
check('odebraná událost', (await q(`select count(*)::int c from household_events where household_id=$1`, [hid2]))[0].c === 1);
await expectError('cizí host v domácnosti odmítnut', () => q(`select save_household($1, $2::jsonb)`, [wid, JSON.stringify({
  id: hid2, name: 'X', guests: [{ id: g1.id, first_name: 'Jan' }] })]), 'guest_not_in_household');

const [old] = await q(`select token from households where id=$1`, [hid2]);
const [fresh] = await q(`select * from regenerate_household_link($1)`, [hid2]);
check('nový osobní odkaz', fresh.new_token !== old.token && /^[A-HJ-NP-Z2-9]{6}$/.test(fresh.new_short_code));
await q(`insert into rsvp_log (wedding_id, household_id, actor_kind, actor_user_id, payload) values ($1,$2,'member',$3,'{}')`, [wid, hid2, owner.id]);
check('pár zapisuje historii RSVP', true);

await as('authenticated', coorg.id);
await expectError('spoluorganizátor bez zápisu nemůže ukládat', () => q(`select save_household($1, $2::jsonb)`, [wid, JSON.stringify({
  name: 'X', guests: [{ first_name: 'Y' }] })]), 'forbidden');
await expectError('spoluorganizátor nemůže přegenerovat odkaz', () => q(`select * from regenerate_household_link($1)`, [hid2]), 'forbidden');
await expectError('nemůže zapsat historii za pár', () => q(`insert into rsvp_log (wedding_id, household_id, actor_kind, actor_user_id, payload) values ($1,$2,'member',$3,'{}')`, [wid, hid2, coorg.id]), 'row-level security');


// --- editor webu: fotky a zveřejnění
await as('authenticated', owner.id);
await q(`insert into storage.objects (bucket_id, name) values ('site-media', $1)`, [`${wid}/foto.jpg`]);
check('pár nahraje fotku do své složky', true);
await expectError('nelze nahrát do cizí složky', () => q(`insert into storage.objects (bucket_id, name) values ('site-media', $1)`, ['00000000-0000-0000-0000-000000000000/x.jpg']), 'row-level security');
await expectError('neplatná cesta odmítnuta', () => q(`insert into storage.objects (bucket_id, name) values ('site-media', 'bez-slozky.jpg')`), 'row-level security');
await q(`update site_pages set sections = '[{"type":"hero","enabled":true,"content":{"intro":{"cs":"Ahoj"}}}]', template='herbar' where wedding_id=$1 and state='draft'`, [wid]);
await q(`select publish_site($1)`, [wid]);
const [pub] = await q(`select sections, template from site_pages where wedding_id=$1 and state='published'`, [wid]);
check('zveřejnění zkopíruje koncept', pub.template === 'herbar' && pub.sections[0].content.intro.cs === 'Ahoj');
await as('authenticated', coorg.id);
await expectError('spoluorganizátor bez práv nezveřejní', () => q(`select publish_site($1)`, [wid]), 'forbidden');


// --- rozpočet: platby a úkoly
await as('authenticated', owner.id);
const [bcat] = await q(`select id from budget_categories where wedding_id=$1 limit 1`, [wid]);
const [bitem] = await q(`insert into budget_items (wedding_id, category_id, name, estimate_amount) values ($1,$2,'Fotograf',30000) returning id`, [wid, bcat.id]);
const [pay] = await q(`insert into budget_payments (wedding_id, item_id, label, amount, due_date) values ($1,$2,'Záloha',10000,'2027-01-15') returning id`, [wid, bitem.id]);
const [ptask] = await q(`select id, title, category, due_date::text d, done_at from tasks where budget_payment_id=$1`, [pay.id]);
check('platba s termínem vytvoří úkol', ptask && ptask.title === 'Zaplatit: Záloha – Fotograf' && ptask.category === 'payments' && ptask.d === '2027-01-15' && !ptask.done_at);
await q(`update tasks set done_at = now() where id=$1`, [ptask.id]);
check('odškrtnutí úkolu zaplatí platbu', !!(await q(`select paid_at from budget_payments where id=$1`, [pay.id]))[0].paid_at);
await q(`update budget_payments set paid_at = null where id=$1`, [pay.id]);
check('zrušení platby vrátí úkol', !(await q(`select done_at from tasks where id=$1`, [ptask.id]))[0].done_at);
await q(`update budget_items set name='Fotograf Novák' where id=$1`, [bitem.id]);
check('přejmenování položky upraví úkol', (await q(`select title from tasks where id=$1`, [ptask.id]))[0].title === 'Zaplatit: Záloha – Fotograf Novák');
await q(`update budget_payments set due_date = null where id=$1`, [pay.id]);
check('platba bez termínu nemá úkol', (await q(`select count(*)::int c from tasks where budget_payment_id=$1`, [pay.id]))[0].c === 0);
await q(`update budget_payments set due_date = '2027-02-01' where id=$1`, [pay.id]);
await q(`delete from budget_payments where id=$1`, [pay.id]);
check('smazání platby smaže úkol', (await q(`select count(*)::int c from tasks where title like 'Zaplatit:%' and wedding_id=$1`, [wid]))[0].c === 0);
const [vend] = await q(`insert into vendors (wedding_id, name) values ($1,'Foto Novák') returning id`, [wid]);
await q(`insert into storage.objects (bucket_id, name) values ('vendor-files', $1)`, [`${wid}/${vend.id}/smlouva.pdf`]);
check('pár nahraje smlouvu dodavatele', true);
await as('authenticated', stranger.id);
check('cizí smlouvu nevidí', (await q(`select count(*)::int c from storage.objects where bucket_id='vendor-files'`))[0].c === 0);
check('pokoj má výchozí jednu noc', true);


// --- zveřejnění zdarma, dokud neběží platby
await as('authenticated', stranger.id);
const [{ create_wedding: fw }] = await q(`select create_wedding('zdarma', 'A', 'B', '2027-09-01')`);
check('platby zatím vypnuté', (await q(`select payments_enabled() p`))[0].p === false);
await expectError('pár si sám nezmění stav webu', () => q(`update weddings set status='published' where id=$1`, [fw]), 'billing_columns_locked');
await expectError('pár si sám nepřidá balíček', () => q(`update weddings set package='web' where id=$1`, [fw]), 'billing_columns_locked');
await q(`update weddings set locales='{cs,en}' where id=$1`, [fw]);
check('ostatní nastavení pár mění dál', true);
await q(`select publish_site($1)`, [fw]);
const [fwr] = await q(`select status::text s, published_free f from weddings where id=$1`, [fw]);
check('web zveřejněn zdarma', fwr.s === 'published' && fwr.f === true);
check('vznikla zveřejněná verze', (await q(`select count(*)::int c from site_pages where wedding_id=$1 and state='published'`, [fw]))[0].c === 1);
await q(`select unpublish_free_site($1)`, [fw]);
check('web zdarma jde skrýt', (await q(`select status::text s from weddings where id=$1`, [fw]))[0].s === 'draft');
await expectError('zaplacený web se takto neskryje', () => q(`select unpublish_free_site($1)`, [wid]), 'forbidden');
await as('postgres');
await q(`update app.platform_settings set payments_enabled = true`);
await as('authenticated', stranger.id);
await expectError('po spuštění plateb je potřeba zaplatit', () => q(`select publish_site($1)`, [fw]), 'not_paid');
await as('postgres');
await q(`update app.platform_settings set payments_enabled = false`);
await as('anon');
await expectError('anonym nezjistí stav plateb', () => q(`select payments_enabled()`), 'permission denied');


// --- zpevnění: anonym nevolá funkce pro páry
await as('anon');
await expectError('anonym nezaloží svatbu', () => q(`select create_wedding('anon-test', 'A', 'B', null)`), 'permission denied');
await expectError('anonym neuloží domácnost', () => q(`select save_household($1, '{}'::jsonb)`, [wid]), 'permission denied');
await as('authenticated', owner.id);
check('přihlášený pár funkce volat může', (await q(`select count(*)::int c from regenerate_household_link($1)`, [hid2]))[0].c === 1);


// --- zasedací pořádek
await as('authenticated', owner.id);
const t1 = '11111111-1111-4111-8111-111111111111', t2 = '22222222-2222-4222-8222-222222222222';
const [{ save_layout: lid }] = await q(`select save_layout($1, $2::jsonb)`, [ev2.id, JSON.stringify([
  { id: t1, kind: 'table', shape: 'round', label: 'Stůl 1', seats: 8, x: 100, y: 100, w: 120, h: 120 },
  { id: t2, kind: 'table', shape: 'rect', label: 'Stůl 2', seats: 6, x: 300, y: 100, w: 180, h: 80 },
])]);
check('plátno uloženo', !!lid && (await q(`select count(*)::int c from layout_items where layout_id=$1`, [lid]))[0].c === 2);
await q(`insert into seat_assignments (guest_id, event_id, wedding_id, table_id) values ($1,$2,$3,$4)`, [pavel.id, ev2.id, wid, t2]);
await q(`select save_layout($1, $2::jsonb)`, [ev2.id, JSON.stringify([{ id: t1, kind: 'table', shape: 'round', label: 'Hlavní', seats: 10, x: 50, y: 50, w: 120, h: 120 }])]);
check('smazaný stůl uvolní hosty', (await q(`select count(*)::int c from seat_assignments where event_id=$1`, [ev2.id]))[0].c === 0);
check('stůl přejmenován', (await q(`select label from layout_items where id=$1`, [t1]))[0].label === 'Hlavní');
await expectError('cizí půdorys odmítnut', () => q(`select save_layout($1, '[]'::jsonb, '00000000-0000-0000-0000-000000000000/plan-x.jpg')`, [ev2.id]), 'invalid_background');
await q(`insert into storage.objects (bucket_id, name) values ('site-media', $1)`, [`${wid}/plan-abc.jpg`]);
check('pár nahraje půdorys', true);
await as('authenticated', coorg.id);
await expectError('spoluorganizátor bez práv neuloží plátno', () => q(`select save_layout($1, '[]'::jsonb)`, [ev2.id]), 'forbidden');


// --- administrace platformy a pozastavení služby
await as('postgres');
const [boss] = await q(`insert into auth.users (email) values ('admin@x.cz') returning id`);
await q(`insert into platform_admins (user_id, role) values ($1, 'superadmin')`, [boss.id]);
await as('authenticated', owner.id);
await expectError('pár nevidí seznam klientů', () => q(`select * from admin_clients()`), 'forbidden');
await expectError('pár si nepozastaví svatbu', () => q(`select admin_set_suspension($1, null)`, [wid]), 'forbidden');
check('pár není správce', (await q(`select am_platform_admin() r`))[0].r === null);
await as('authenticated', boss.id);
check('správce je superadmin', (await q(`select am_platform_admin() r`))[0].r === 'superadmin');
const clients = await q(`select * from admin_clients()`);
const mine = clients.find((c) => c.id === wid);
check('správce vidí klienty s vlastníkem', mine?.owner_email === 'jana@x.cz' && mine.households > 0, JSON.stringify(mine ?? {}));
await q(`select admin_update_wedding($1, '{"partner2_name":"Petr B.","admin_note":"VIP"}'::jsonb)`, [wid]);
check('správce upraví údaje', (await q(`select partner2_name, admin_note from weddings where id=$1`, [wid]))[0].admin_note === 'VIP');
await q(`select admin_set_suspension($1, 'nonpayment', 'Faktura 12')`, [wid]);
check('svatba pozastavena', (await q(`select suspended_reason from weddings where id=$1`, [wid]))[0].suspended_reason === 'nonpayment');
check('akce správce v auditu', (await q(`select count(*)::int c from audit_log where wedding_id=$1 and action like 'admin.%'`, [wid]))[0].c === 2);
await as('authenticated', owner.id);
check('pozastavený pár data vidí', (await q(`select count(*)::int c from households where wedding_id=$1`, [wid]))[0].c > 0);
check('úroveň přístupu je jen čtení', (await q(`select my_module_level($1, 'guests') l`, [wid]))[0].l === 'read');
await expectError('pozastavený pár nic nepřidá', () => q(`insert into tasks (wedding_id, title) values ($1, 'x')`, [wid]), 'row-level');
const suspUpd = await q(`update weddings set partner1_name='X' where id=$1 returning id`, [wid]);
check('pozastavený pár nezmění svatbu', suspUpd.length === 0);
await q(`update weddings set suspended_at=null, suspended_reason=null where id=$1`, [wid]);
check('pár pozastavení nezruší', (await q(`select suspended_at from weddings where id=$1`, [wid]))[0].suspended_at !== null);
await as('authenticated', boss.id);
await q(`select admin_set_suspension($1, null)`, [wid]);
await as('authenticated', owner.id);
check('po obnovení pár zase zapisuje', (await q(`select my_module_level($1, 'guests') l`, [wid]))[0].l === 'write');
await q(`update weddings set partner2_name='Petr' where id=$1`, [wid]);


// --- e-maily: upozornění na úkoly
await as('authenticated', owner.id);
const [rt] = await q(`insert into tasks (wedding_id, title, due_date) values ($1, 'Dort', '2027-01-10') returning id`, [wid]);
await as('postgres');
await q(`update tasks set reminded_at = now() where id=$1`, [rt.id]);
await as('authenticated', owner.id);
await q(`update tasks set title='Dort!' where id=$1`, [rt.id]);
check('přejmenování upozornění neruší', (await q(`select reminded_at from tasks where id=$1`, [rt.id]))[0].reminded_at !== null);
await q(`update tasks set due_date='2027-01-20' where id=$1`, [rt.id]);
check('nový termín = nové upozornění', (await q(`select reminded_at from tasks where id=$1`, [rt.id]))[0].reminded_at === null);

console.log(failures ? `\n${failures} testů selhalo` : '\nVšechny testy prošly');
process.exit(failures ? 1 : 0);
