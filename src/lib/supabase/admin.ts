import "server-only";
import { createClient } from "@supabase/supabase-js";
import { serverEnv } from "@/lib/env";

/**
 * Klient se service_role – obchází RLS.
 *
 * Používá se jen tam, kde přístup ověřujeme sami:
 *  - veřejný svatební web a RSVP přes token domácnosti,
 *  - nahrávání do galerie přes token galerie,
 *  - webhooky platební brány a e-mailové služby,
 *  - cron úlohy (anonymizace, mazání, připomínky).
 *
 * Nikdy ho nepředávejte do klientského kódu.
 */
export function createAdminClient() {
  const env = serverEnv();
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
