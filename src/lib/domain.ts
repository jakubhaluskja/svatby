import "server-only";
import { headers } from "next/headers";
import { appDomain } from "@/lib/env";
import { usesPathSites } from "@/lib/hosts";

/**
 * Doména pro odkazy na svatební weby.
 * Na Vercel adrese a localhostu bereme skutečnou adresu, ze které přišel požadavek,
 * aby odkazy fungovaly i při jiném nastavení NEXT_PUBLIC_APP_DOMAIN.
 */
export async function linkDomain(): Promise<string> {
  const configured = appDomain();
  const host = (await headers()).get("x-forwarded-host") ?? (await headers()).get("host");
  if (host && usesPathSites(host.toLowerCase()) && (usesPathSites(configured) || !host.toLowerCase().endsWith(configured))) {
    return host.toLowerCase();
  }
  return configured;
}
