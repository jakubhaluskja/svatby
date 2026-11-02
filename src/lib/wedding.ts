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
  role: MemberRole;
};

/** Přihlášený uživatel, nebo přesměrování na přihlášení. */
export const requireUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/prihlaseni");
  return user;
});

/** Svatba, ke které má uživatel přístup (jedna na účet). */
export const getCurrentWedding = cache(async (): Promise<CurrentWedding | null> => {
  const user = await requireUser();
  const supabase = await createClient();
  const { data } = await supabase
    .from("wedding_members")
    .select(
      "role, weddings!inner(id, slug, partner1_name, partner2_name, wedding_date, default_locale, template, status, package)",
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
