# Pokyny pro vývoj

- Jazyk UI, komentářů a commitů: čeština. Identifikátory v kódu anglicky.
- Specifikace produktu je v dokumentu „Funkční specifikace – svatební platforma“. Rozsah je kompletní, bez MVP.
- Každá změna schématu = nová migrace v `supabase/migrations` + test v `supabase/tests/schema.test.mjs`.
- Každá nová tabulka s daty svatby má sloupec `wedding_id` a RLS přes `app.can_read` / `app.can_write`.
- Hosté nemají účet: veřejné operace jdou přes server (`createAdminClient`) s ověřením tokenu, nikdy přímo z prohlížeče.
- `createAdminClient` nikdy v klientských komponentách (`server-only`).
- Lokalizované texty v DB jako `{"cs": "...", "en": "..."}`.
- Před commitem: `npm run typecheck && npm run lint && npm test && npm run test:db && npm run build`.
- Databáze Supabase (projekt `idunrfgroymfeusefupz`) je připojená přes konektor: migrace nahrávat nástrojem `apply_migration`, pak sjednotit verzi v `supabase_migrations.schema_migrations` s názvem souboru a spustit bezpečnostní kontrolu (`get_advisors`).
