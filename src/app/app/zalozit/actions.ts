"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { isValidSlug } from "@/lib/hosts";
import { slugAlternatives } from "@/lib/slug";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { isTemplateId } from "@/lib/templates";

export type SlugCheck = { slug: string; available: boolean; reason?: string; suggestions: string[] };

async function isTaken(slugs: string[]): Promise<Set<string>> {
  const db = createAdminClient();
  const { data } = await db.from("weddings").select("slug").in("slug", slugs);
  return new Set((data ?? []).map((r) => String(r.slug).toLowerCase()));
}

/** Ověří, zda je adresa webu volná, a případně nabídne volné alternativy. */
export async function checkSlug(raw: string, year?: number): Promise<SlugCheck> {
  const slug = raw.trim().toLowerCase();
  if (!isValidSlug(slug)) {
    return {
      slug,
      available: false,
      reason: "Adresa musí mít 3–48 znaků: malá písmena bez diakritiky, číslice a pomlčky uvnitř.",
      suggestions: [],
    };
  }
  const alternatives = slugAlternatives(slug, year);
  const taken = await isTaken([slug, ...alternatives]);
  if (!taken.has(slug)) return { slug, available: true, suggestions: [] };
  return {
    slug,
    available: false,
    reason: "Tahle adresa je už obsazená.",
    suggestions: alternatives.filter((s) => !taken.has(s)).slice(0, 3),
  };
}

const schema = z.object({
  partner1: z.string().trim().min(1, "Doplňte obě jména.").max(60),
  partner2: z.string().trim().min(1, "Doplňte obě jména.").max(60),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable(),
  place: z.string().trim().max(120).nullable(),
  slug: z.string().trim().toLowerCase().refine(isValidSlug, "Adresa webu není platná."),
  template: z.string().refine(isTemplateId, "Vyberte šablonu."),
  locale: z.enum(["cs", "en"]),
});

export type CreateWeddingInput = z.input<typeof schema>;
export type CreateWeddingResult = { error?: string; field?: string };

export async function createWedding(input: CreateWeddingInput): Promise<CreateWeddingResult> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { error: issue.message, field: String(issue.path[0]) };
  }
  const v = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase.rpc("create_wedding", {
    p_slug: v.slug,
    p_partner1: v.partner1,
    p_partner2: v.partner2,
    p_wedding_date: v.date,
    p_locale: v.locale,
    p_template: v.template,
    p_location_name: v.place || null,
    p_address: null,
  });

  if (error) {
    if (error.message.includes("wedding_exists")) redirect("/app");
    if (error.code === "23505") return { error: "Tahle adresa je už obsazená. Zvolte jinou.", field: "slug" };
    if (error.code === "28000") redirect("/prihlaseni?next=/app/zalozit");
    console.error("create_wedding", error);
    return { error: "Svatbu se nepodařilo založit. Zkuste to prosím znovu." };
  }

  redirect("/app?vitejte=1");
}
