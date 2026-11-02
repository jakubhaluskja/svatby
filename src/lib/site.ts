import "server-only";
import { cache } from "react";
import { createAdminClient } from "@/lib/supabase/admin";

export type PublicWedding = {
  id: string;
  slug: string;
  partner1_name: string;
  partner2_name: string;
  wedding_date: string | null;
  timezone: string;
  default_locale: string;
  locales: string[];
  template: string;
  status: "draft" | "published" | "expired" | "deleted";
  web_expires_at: string | null;
  password_scope: "none" | "site" | "sections";
};

/** Parametr route /site/[site]: slug, nebo hostname vlastní domény (obsahuje tečku). */
export function isCustomDomainParam(site: string): boolean {
  return site.includes(".");
}

/**
 * Najde zveřejněnou svatbu podle slugu nebo ověřené vlastní domény.
 * Čte s tajným klíčem, proto vrací jen veřejně bezpečná pole.
 */
export const resolveWedding = cache(async (siteParam: string): Promise<PublicWedding | null> => {
  const site = decodeURIComponent(siteParam).toLowerCase();
  const db = createAdminClient();
  const fields =
    "id, slug, partner1_name, partner2_name, wedding_date, timezone, default_locale, locales, template, status, web_expires_at, password_scope";

  if (isCustomDomainParam(site)) {
    const { data: domain } = await db
      .from("custom_domains")
      .select("wedding_id")
      .eq("hostname", site)
      .eq("status", "verified")
      .maybeSingle();
    if (!domain) return null;
    const { data } = await db.from("weddings").select(fields).eq("id", domain.wedding_id).maybeSingle();
    return isLive(data) ? data : null;
  }

  const { data } = await db.from("weddings").select(fields).eq("slug", site).maybeSingle();
  return isLive(data) ? data : null;
});

function isLive(w: PublicWedding | null): w is PublicWedding {
  if (!w || w.status !== "published") return false;
  return !w.web_expires_at || new Date(w.web_expires_at) > new Date();
}
