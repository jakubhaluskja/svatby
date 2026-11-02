# Svatby – svatební web a plánovač

Webová aplikace pro snoubence: veřejný svatební web s RSVP pro hosty a kompletní plánovač pro pár
(hosté, zasedací pořádek, ubytování, checklist, harmonogram dne D, rozpočet, dary, fotogalerie).
Plánovač je zdarma, platí se jednorázově za zveřejnění webu.

Funkční specifikace: dokument „Funkční specifikace – svatební platforma“ v projektu Svatební web.

## Stack

| Vrstva | Technologie |
| --- | --- |
| Aplikace | Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS 4 |
| Databáze, přihlášení | Supabase (Postgres, RLS, Auth) |
| Soubory galerie | Cloudflare R2 (originály, náhledy) |
| Hosting, domény | Vercel (wildcard subdomény, vlastní domény přes Domains API) |
| Platby | Comgate (karta, Apple/Google Pay, QR, bankovní tlačítka) |
| E-maily | Resend |

## Architektura

### Adresy (multi-tenant)

`src/middleware.ts` rozhoduje podle hostname (`src/lib/hosts.ts`):

| Adresa | Kam vede |
| --- | --- |
| `app.cz`, `www.app.cz` | aplikace: úvod, přihlášení, administrace `/app/*` |
| `jana-a-petr.app.cz/...` | `/site/jana-a-petr/...` – svatební web |
| `novakovi.cz/...` | `/site/novakovi.cz/...` – svatební web přes ověřenou vlastní doménu |

Lokálně funguje `http://jana-a-petr.localhost:3000`.

### Přístup k datům

- **Administrace páru** používá `src/lib/supabase/server.ts` jménem přihlášeného uživatele. Přístup hlídá
  RLS v databázi (`app.module_level`): vlastník a partner/ka mají plná práva, spoluorganizátor má u každého
  modulu `none / read / write`, u rozpočtu i `own` (jen část svého přispěvatele).
- **Hosté nemají účet.** Veřejný web, RSVP a nahrávání fotek jdou přes server s `service_role`
  (`src/lib/supabase/admin.ts`) a ověření tokenu (domácnost, galerie, sdílený harmonogram).
  Anonymní klient nemá k tabulkám žádný přístup.
- Citlivé operace jsou databázové funkce volatelné jen serverem: `submit_household_rsvp`, `apply_paid_order`.

### Databáze (`supabase/migrations`)

| Migrace | Obsah |
| --- | --- |
| `…01_core` | svatby, členové a práva, vlastní domény, přispěvatelé, audit, šablony platformy |
| `…02_guests_web` | události, věkové kategorie, štítky, domácnosti, hosté, RSVP, obsah webu, zprávy hostům, log e-mailů |
| `…03_planning` | dodavatelé, zasedací pořádek a pravidla, ubytování po pokojích, rozpočet, platby, kurzy ČNB, checklist, harmonogram dne D |
| `…04_gifts_gallery_billing` | dary, skupinové dary, poděkování, galerie a moderace, objednávky, slevové kódy, faktury |
| `…05_functions` | založení svatby s výchozími daty, posun termínů, aktivace balíčku, RSVP hosta, přehled pro catering |

Klíčová pravidla v datech:

- jedna svatba na účet,
- web online 12 měsíců po svatbě, galerie a data hostů 6 měsíců,
- peníze za dary nikdy nejdou přes platformu (QR platba přímo páru),
- alergie jsou zdravotní údaj – volitelné pole, anonymizace po 6 měsících.

## Vývoj

```bash
cp .env.example .env.local   # doplnit klíče ze Supabase
npm install
npm run dev                  # http://localhost:3000, svatba na http://<slug>.localhost:3000
```

| Příkaz | Co dělá |
| --- | --- |
| `npm test` | unit testy (Vitest) |
| `npm run test:db` | migrace + RLS + doménové funkce v PGlite (bez Dockeru) |
| `npm run typecheck` | TypeScript |
| `npm run lint` | ESLint |
| `npm run build` | produkční build |

Nasazení migrací: `npx supabase link` a `npx supabase db push`, výchozí obsah `supabase/seed.sql`.
