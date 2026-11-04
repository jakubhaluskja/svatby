import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/wedding";

/** Cookie s přihlášením správce, ke kterému se vrací po „přihlášení za klienta“. */
export const IMPERSONATION_COOKIE = "svatby_admin_return";

export type PlatformRole = "superadmin" | "support";

/** Správce platformy, jinak 404 (administraci neprozrazujeme). */
export const requireAdmin = cache(async (): Promise<{ id: string; email: string | null; role: PlatformRole }> => {
  const user = await requireUser();
  const supabase = await createClient();
  const { data } = await supabase.rpc("am_platform_admin");
  if (!data) notFound();
  return { ...user, role: data as PlatformRole };
});

/** Správce je právě přihlášený za klienta – e-mail správce, ke kterému se vrátí. */
export async function impersonatedBy(): Promise<string | null> {
  const raw = (await cookies()).get(IMPERSONATION_COOKIE)?.value;
  if (!raw) return null;
  try {
    return (JSON.parse(raw) as { email?: string }).email ?? "správce";
  } catch {
    return null;
  }
}

export const STATUS_LABEL: Record<string, string> = { draft: "Koncept", published: "Zveřejněno", expired: "Vypršelo", deleted: "Smazáno" };
export const PACKAGE_LABEL: Record<string, string> = { none: "Bez balíčku", web: "Web", web_gallery: "Web + galerie" };
export const REASON_LABEL: Record<string, string> = { nonpayment: "Nezaplacení", violation: "Porušení pravidel", other: "Jiný důvod" };
