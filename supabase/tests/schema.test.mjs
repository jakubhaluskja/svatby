// Ověření migrací v PGlite: Supabase prostředí (auth, role) je nasimulované.
import { PGlite } from '@electric-sql/pglite';
import { citext } from '@electric-sql/pglite/contrib/citext';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const repo = process.argv[2] ?? new URL('../..', import.meta.url).pathname;
const db = new PGlite({ extensions: { citext } });

const stub = `
create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
create schema auth; create schema extensions;
grant usage on schema public, auth, extensions to anon, authenticated, service_role;
create table auth.users (id uuid primary key default gen_random_uuid(), email text, raw_user_meta_data jsonb default '{}');
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
check('3 věkové kategorie', (await q(`select count(*)::int c from age_categories where wedding_id=$1`, [wid]))[0].c === 3);
check('checklist ze šablony', (await q(`select count(*)::int c from tasks where wedding_id=$1`, [wid]))[0].c === 28);
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

console.log(failures ? `\n${failures} testů selhalo` : '\nVšechny testy prošly');
process.exit(failures ? 1 : 0);
