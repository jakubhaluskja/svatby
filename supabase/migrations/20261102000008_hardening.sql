-- =============================================================================
-- Zpevnění podle bezpečnostní kontroly Supabase
-- =============================================================================

-- Funkce pro přihlášené páry nesmí volat anonymní návštěvník.
revoke execute on function public.create_wedding(text, text, text, date, text, text, text, text) from public, anon;
revoke execute on function public.publish_site(uuid) from public, anon;
revoke execute on function public.regenerate_household_link(uuid) from public, anon;
revoke execute on function public.save_household(uuid, jsonb) from public, anon;
grant execute on function public.create_wedding(text, text, text, date, text, text, text, text) to authenticated;
grant execute on function public.publish_site(uuid) to authenticated;
grant execute on function public.regenerate_household_link(uuid) to authenticated;
grant execute on function public.save_household(uuid, jsonb) to authenticated;

-- Pevná cesta hledání u pomocných funkcí (všechny odkazy jsou plně kvalifikované).
alter function app.random_token(int) set search_path = '';
alter function app.random_code(int) set search_path = '';
alter function app.touch_updated_at() set search_path = '';
alter function app.can_read(uuid, text) set search_path = '';
alter function app.can_write(uuid, text) set search_path = '';
alter function app.default_sections() set search_path = '';
alter function app.storage_wedding(text) set search_path = '';
