import { isValidSlug } from "@/lib/hosts";

/** Převede text na tvar vhodný do adresy: bez diakritiky, malá písmena, pomlčky. */
export function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " a ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")
    .slice(0, 48)
    .replace(/-+$/g, "");
}

/** Návrh adresy webu z křestních jmen páru, např. „Jana“ + „Petr“ → „jana-a-petr“. */
export function suggestSlug(partner1: string, partner2: string): string {
  const first = (name: string) => slugify(name.trim().split(/\s+/)[0] ?? "");
  const a = first(partner1);
  const b = first(partner2);
  if (a && b) return `${a}-a-${b}`;
  return a || b;
}

/** Alternativy, když je navržená adresa obsazená. */
export function slugAlternatives(base: string, year?: number): string[] {
  const out = [year ? `${base}-${year}` : null, `${base}-svatba`, `svatba-${base}`]
    .filter((s): s is string => !!s)
    .map((s) => slugify(s))
    .filter(isValidSlug);
  return [...new Set(out)];
}
