# Svatební platforma – přehled projektu a záloha rozhodnutí

Stav k 26. 11. 2026. Kód: github.com/jakubhaluskja/svatby (větev `main`, stav zálohy = commit „Přehled projektu a záloha rozhodnutí“).
Živá aplikace: https://svatby-liard.vercel.app · Databáze: Supabase projekt `idunrfgroymfeusefupz` (eu-west-1).

## 1. Produkt a obchodní rozhodnutí

- All-in-one česká svatební platforma: veřejný svatební web s RSVP pro hosty + plánovač pro pár. Kompletní rozsah, žádné MVP.
- Monetizace: plánovač zdarma napořád; platí se jednorázově za zveřejnění webu. Ceny o 10 % pod WeMarry:
  - Svatební web **1 340 Kč**, Web + galerie **1 790 Kč** (s DPH, jednorázově, žádné předplatné, žádné poplatky z darů).
  - Web běží 12 měsíců od svatby; galerie 50 GB na 6 měsíců po svatbě; údaje hostů (strava, alergie) se anonymizují 6 měsíců po svatbě.
- Platby se zapnou až při ostrém spuštění. Do té doby lze web zveřejnit zdarma (`app.platform_settings.payments_enabled = false`, `weddings.published_free`).
- Jedna svatba na účet (žádné B2B/koordinátorské účty). Žádné WhatsApp/SMS automatizace – připomínky jsou ruční.
- RSVP po domácnostech přes osobní odkaz (nebo kód z pozvánky); hosté nemají účet.
- Cíl tržeb: 200 tis. Kč v 1. roce, 1 mil. Kč ve 2. roce. Plánovaná mezinárodní expanze (název produktu zatím nevybrán, musí fungovat i mimo ČR).
- Marketing (Meta reklamy, kreativy) až po dokončení platformy.

## 2. Technologie

- Next.js 15 (App Router, server actions), React 19, TypeScript, Tailwind 4, zod, vitest, PGlite testy schématu.
- Supabase: Postgres + RLS, Auth, Storage (`site-media` veřejný, `vendor-files` a `gallery` soukromé).
- Vercel (region `dub1` kvůli latenci k databázi v Irsku), denní cron `/api/cron/ukoly`.
- E-maily: Resend (REST API). AI texty: Claude API.
- Pravidla vývoje (CLAUDE.md): čeština v UI/komentářích/commitech, identifikátory anglicky; každá změna schématu = migrace + test v `supabase/tests/schema.test.mjs`; každá tabulka svatby má `wedding_id` a RLS přes `app.can_read/can_write`; veřejné operace hostů jen přes server (`createAdminClient`, ověření tokenu); před commitem `npm run typecheck && npm run lint && npm test && npm run test:db && npm run build`.

### Proměnné prostředí (Vercel)
| Proměnná | Účel |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY` | Supabase |
| `NEXT_PUBLIC_APP_DOMAIN` | adresa aplikace (svatby-liard.vercel.app) |
| `RESEND_API_KEY`, `EMAIL_FROM`, `RESEND_WEBHOOK_SECRET` | e-maily a stav doručení (`/api/webhooks/resend`) |
| `CRON_SECRET` | denní upozornění na úkoly |
| `ANTHROPIC_API_KEY`, `AI_MODEL` (volitelně) | AI návrhy textů |

### Nastavení Supabase (dashboard)
- Auth → URL Configuration: Site URL `https://svatby-liard.vercel.app` (s https!), Redirect URLs `https://svatby-liard.vercel.app/**`, `http://localhost:3000/**`.
- Doporučené šablony e-mailů: Reset password → `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/nove-heslo`; Magic link → `…&type=magiclink&next=/app`.
- Před spuštěním: vlastní SMTP přes Resend (smtp.resend.com, 465, user `resend`), zvýšit rate limit e-mailů; placený plán kvůli úložišti galerie (free = 1 GB celkem).
- Superadmin platformy: info@jakubhaluska.cz (`public.platform_admins`).

## 3. Moduly aplikace (co je hotové)

**Pro pár (`/app`)**
- Přehled: odpočet, statistiky, úkoly týdne, nové odpovědi, průvodce 7 prvními kroky, upozornění na den D.
- Průvodce aplikací při prvním přihlášení (8 kroků se zvýrazněním), odkaz „Spustit průvodce“ v menu (`profiles.tour_done_at`).
- Checklist s kategoriemi a termíny podle data svatby, export do Excelu; platby z rozpočtu se propisují jako úkoly.
- Výběr místa (`/app/mista`): varianty s cenou, kapacitou, termíny, plusy/minusy, hodnocením; karty i porovnání.
- Harmonogram dne D + sdílený odkaz pro dodavatele; mobilní zobrazení Den D (teď/dál, volání, navigace).
- Rozpočet: kategorie, položky (i za osobu podle počtu hostů), platby se splatností, přispěvatelé, dodavatelé se soubory (smlouvy), EUR kurzem ČNB, export do Excelu.
- Hosté: domácnosti, kategorie, import, QR k tisku, catering (strava/alergie), export, vlastní otázky v RSVP, e-maily hostům (pozvánky, připomínky, zprávy, poděkování), ruční označení „pozváno osobně/poštou“.
- Události (obřad, hostina…), plán B.
- Zasedací pořádek: stoly se židlemi, pravidla (spolu/zvlášť/pevný stůl), automatické rozsazení, tisk; na mobilu seznam s přesazováním.
- Ubytování po pokojích (noci, kdo platí), tisk.
- Tiskoviny ve stylu šablony: jmenovky, čísla stolů, rozpis u vchodu, menu.
- Svatební web: 5 šablon (Pozvánka, Herbář, Magazín, Hvězdná noc, Folklor), WYSIWYG editor přímo na webu (sekce přesouvané tažením, vlastní sekce s fotkami, hlavní informace sraz/obřad/hostina s mapou, galerie páru, dress code s barvami, svatební menu, kontakty s fotkou, FAQ), zprávy hostům, heslo, čeština/angličtina, AI návrhy textů (uvítání, příběh).
- Dary: věci k rezervaci, příspěvky a skupinové dary s QR platbou na účet páru, režim překvapení, obdržené dary a poděkování.
- Fotogalerie: nahrávání hostů přes QR bez aplikace, alba, schvalování, kniha přání, živá prezentace na projektor; 10 GB zdarma do spuštění plateb.
- Tým svatby: partner a spoluorganizátoři s oprávněními po modulech (předvolby svědek/rodiče/koordinátor, rozpočet „jen svůj příspěvek“), pozvánky e-mailem/odkazem.
- Do telefonu: instalovatelná aplikace (PWA) a odběr kalendáře `.ics` (úkoly, platby, program).

**Pro hosty (web)**: osobní odkaz `/p/[token]`, RSVP po domácnostech s vlastními otázkami, potvrzení e-mailem, dary, fotky a kniha přání (`/fotky/[token]`), odhlášení z e-mailů.

**Administrace platformy (`/admin`)**: seznam klientů, úprava údajů, změna e-mailu vlastníka, přihlášení za klienta (s návratem), pozastavení služby (nezaplacení/porušení pravidel) – pozastavená svatba je jen ke čtení a web je nedostupný; historie zásahů.

## 4. Databázové migrace (`supabase/migrations`)
01 core · 02 guests_web · 03 planning · 04 gifts_gallery_billing · 05 functions · 06 guest_admin · 07 site_editor · 08 hardening · 09 seating · 10 task_categories · 11 free_publish · 12 site_templates · 13 budget · 14 platform_admin · 15 email · 16 team · 17 gifts · 18 gallery · 19 rsvp_questions · 20 calendar · 21 venues · 22 tour.
Na produkci nahrávat přes Supabase konektor (`apply_migration`), pak srovnat verzi v `supabase_migrations.schema_migrations` s názvem souboru a spustit `get_advisors`. Změny, které mažou pravidla (drop policy), Supabase nechá potvrdit – lépe používat `alter policy`.

## 5. Analýza konkurence (11/2026) – shrnutí
- Silné stránky oproti konkurenci: RSVP po domácnostech bez účtu, propojený rozpočet s checklistem a kurzem ČNB, zasedací pořádek s pravidly, tým s oprávněními, dary bez poplatků (Zola 2,5–2,9 %), česky bez spamu od dodavatelů.
- Doplněno podle konkurence: galerie s QR a živou prezentací, kniha přání, vlastní otázky v RSVP, PWA, kalendář, AI texty, srovnání míst, tiskoviny, průvodce.
- Vědomě odloženo: katalog dodavatelů (jiný byznys, riziko spamu) – případně později jako partnerství.
- Konkurenti: WeMarry (CZ, cenová reference), planning.wedding, Svatbovačka, Zola, The Knot, Joy, Bridebook, Appy Couple.

## 6. Co zbývá do spuštění
1. Platby (Comgate): nákup balíčků, faktury (`invoice_sequences`), prodloužení; pak `payments_enabled = true`.
2. Vlastní doména pro svatební web (schéma `custom_domains` existuje).
3. GDPR: export dat a automatická anonymizace hostů 6 měsíců po svatbě.
4. Infrastruktura: Resend + doména, SMTP v Supabase, placený Supabase (úložiště galerie), `ANTHROPIC_API_KEY`.
5. Drobnosti: souřadnice místa pro hvězdnou mapu (šablona Hvězdná noc), karta rozpočtu na přehledu, stažení galerie jako ZIP, push notifikace.
