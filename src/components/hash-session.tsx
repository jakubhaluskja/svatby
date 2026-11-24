"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * Odkazy poslané z administrace Supabase (magic link, obnova hesla s výchozí šablonou)
 * vracejí přihlášení v části adresy za #. Tady ho převezmeme a uložíme do cookies.
 */
export function HashSession() {
  useEffect(() => {
    const hash = window.location.hash;
    if (!hash.includes("access_token=") && !hash.includes("error_description=")) return;
    const p = new URLSearchParams(hash.slice(1));
    if (p.get("error_description")) {
      window.location.replace("/prihlaseni?chyba=odkaz");
      return;
    }
    const access_token = p.get("access_token");
    const refresh_token = p.get("refresh_token");
    if (!access_token || !refresh_token) return;
    createClient()
      .auth.setSession({ access_token, refresh_token })
      .then(({ error }) => {
        window.location.replace(error ? "/prihlaseni?chyba=odkaz" : p.get("type") === "recovery" ? "/nove-heslo" : "/app");
      });
  }, []);
  return null;
}
