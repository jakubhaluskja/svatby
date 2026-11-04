import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type MemberRole = "owner" | "partner" | "coorganizer";

export type CurrentWedding = {
  id: string;
  slug: string;
  partner1_name: string;
  partner2_name: string;
  wedding_date: string | null;
  default_locale: "cs" | "en";
  template: string;
  status: "draft" | "published" | "expired" | "deleted";
  package: "none" | "web" | "web_gallery";
  /** Služba pozastavená správcem platformy – vše jen ke čtení. */
  suspended_at: string | null;
  suspended_reason: "nonpayment" | "violation" | "other" | null;
  role: MemberRole;
};

/** Přihlášený uživatel, nebo přesměrování na přihlášení. */
export const requireUser = cache(async (): Promise<{ id: string; email: string | null }> => {
  const supabase = await createClient();
  // Ověření podpisu tokenu bez dalšího dotazu na server (při symetrickém klíči se zeptá serveru).
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) redirect("/prihlaseni");
  return { id: claims.sub, email: (claims.email as string | undefined) ?? null };
});

/** Svatba, ke které má uživatel přístup (jedna na účet). */
export const getCurrentWedding = cache(async (): Promise<CurrentWedding | null> => {
  const user = await requireUser();
  const supabase = await createClient();
  const { data } = await supabase
    .from("wedding_members")
    .select(
      "role, weddings!inner(id, slug, partner1_name, partner2_name, wedding_date, default_locale, template, status, package, suspended_at, suspended_reason)",
    )
    .eq("user_id", user.id)
    .not("accepted_at", "is", null)
    .neq("weddings.status", "deleted")
    .order("invited_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!data) return null;
  const w = data.weddings as unknown as Omit<CurrentWedding, "role">;
  return { ...w, role: data.role as MemberRole };
});

/** Svatba je povinná – bez ní pošleme uživatele do průvodce založením. */
export async function requireWedding(): Promise<CurrentWedding> {
  const wedding = await getCurrentWedding();
  if (!wedding) redirect("/app/zalozit");
  return wedding;
}

export type ModuleName = "guests" | "web" | "seating" | "lodging" | "checklist" | "budget" | "gifts" | "gallery";

/** Úroveň přístupu přihlášeného uživatele k modulu: none / read / write / own. */
export async function moduleLevel(weddingId: string, module: ModuleName): Promise<"none" | "read" | "write" | "own"> {
  // Novomanželé mohou vždy vše (stejně jako app.module_level v databázi) – bez dalšího dotazu.
  const current = await getCurrentWedding();
  if (current?.id === weddingId && current.role !== "coorganizer") return current.suspended_at ? "read" : "write";
  const supabase = await createClient();
  const { data } = await supabase.rpc("my_module_level", { p_wedding_id: weddingId, p_module: module });
  return (data as "none" | "read" | "write" | "own" | null) ?? "none";
}
