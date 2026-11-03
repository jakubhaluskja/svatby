import { z } from "zod";

/** Lokalizovaný text sekce: {"cs": "...", "en": "..."} */
const L = z.object({ cs: z.string().max(5000).default(""), en: z.string().max(5000).default("") }).default({});
export type LText = z.infer<typeof L>;

const photo = z.string().max(300).nullable().default(null);

/** Vlastní nadpis sekce (prázdný = výchozí nadpis šablony). Texty sekcí jsou bohatý text (viz rich-text.ts). */
export const SECTION_SCHEMAS = {
  hero: z.object({ tagline: L, intro: L, photo }).default({}),
  schedule: z.object({ title: L, intro: L }).default({}),
  location: z.object({ title: L, text: L, photo }).default({}),
  story: z.object({ title: L, text: L, photos: z.array(z.string().max(300)).max(6).default([]) }).default({}),
  dresscode: z.object({ title: L, text: L }).default({}),
  accommodation: z.object({ title: L, text: L }).default({}),
  gifts: z.object({ title: L, text: L, show_account: z.boolean().default(true) }).default({}),
  faq: z.object({ title: L, items: z.array(z.object({ q: L, a: L })).max(30).default([]) }).default({}),
  contacts: z
    .object({
      title: L,
      items: z
        .array(z.object({ name: z.string().max(80).default(""), role: L, phone: z.string().max(40).default(""), email: z.string().max(120).default("") }))
        .max(10)
        .default([]),
    })
    .default({}),
  rsvp: z.object({ title: L, intro: L }).default({}),
} as const;

export type SectionType = keyof typeof SECTION_SCHEMAS;
export const SECTION_TYPES = Object.keys(SECTION_SCHEMAS) as SectionType[];

export type SectionContent<T extends SectionType> = z.infer<(typeof SECTION_SCHEMAS)[T]>;
export type Section = { [T in SectionType]: { id: T; type: T; enabled: boolean; content: SectionContent<T> } }[SectionType];

export const SECTION_LABELS: Record<SectionType, { cs: string; en: string; hint: string }> = {
  hero: { cs: "Úvod", en: "Welcome", hint: "Jména, datum, úvodní fotka a krátký pozdrav." },
  schedule: { cs: "Program", en: "Schedule", hint: "Skládá se z událostí. Tady jen doplníte úvodní text." },
  location: { cs: "Jak se k nám dostanete", en: "Getting there", hint: "Parkování, doprava, kyvadlový autobus." },
  story: { cs: "Náš příběh", en: "Our story", hint: "Jak jste se poznali. Text a až 6 fotek." },
  dresscode: { cs: "Dress code", en: "Dress code", hint: "Co si obléct, čemu se vyhnout." },
  accommodation: { cs: "Ubytování", en: "Accommodation", hint: "Tipy na hotely a do kdy rezervovat." },
  gifts: { cs: "Dary", en: "Gifts", hint: "Co by vám udělalo radost. Číslo účtu se zobrazí i s QR platbou." },
  faq: { cs: "Časté dotazy", en: "FAQ", hint: "Otázky, na které se hosté ptají nejčastěji." },
  contacts: { cs: "Kontakty", en: "Contacts", hint: "Svědci nebo koordinátorka pro den svatby." },
  rsvp: { cs: "Potvrzení účasti", en: "RSVP", hint: "Úvodní text nad formulářem pro hosty." },
};

const DEFAULT_ENABLED: SectionType[] = ["hero", "schedule", "location", "rsvp"];

/**
 * Převede uložená data na úplný, platný seznam sekcí:
 * doplní chybějící sekce, zahodí neznámé a doplní výchozí hodnoty obsahu.
 */
export function normalizeSections(raw: unknown): Section[] {
  const list = Array.isArray(raw) ? raw : [];
  const seen = new Set<SectionType>();
  const out: Section[] = [];

  for (const item of list) {
    const type = (item as { type?: string })?.type as SectionType;
    if (!SECTION_TYPES.includes(type) || seen.has(type)) continue;
    seen.add(type);
    const parsed = SECTION_SCHEMAS[type].safeParse((item as { content?: unknown }).content ?? {});
    out.push({
      id: type,
      type,
      enabled: (item as { enabled?: unknown }).enabled !== false,
      content: parsed.success ? parsed.data : SECTION_SCHEMAS[type].parse({}),
    } as Section);
  }

  for (const type of SECTION_TYPES) {
    if (seen.has(type)) continue;
    out.push({ id: type, type, enabled: DEFAULT_ENABLED.includes(type), content: SECTION_SCHEMAS[type].parse({}) } as Section);
  }

  // Úvod je vždy první a vždy zapnutý.
  const hero = out.findIndex((s) => s.type === "hero");
  const [h] = out.splice(hero, 1);
  return [{ ...h, enabled: true }, ...out];
}

/** Ověří obsah jedné sekce z editoru. */
export function parseSectionContent<T extends SectionType>(type: T, content: unknown): SectionContent<T> {
  return SECTION_SCHEMAS[type].parse(content) as SectionContent<T>;
}

/** Text v jazyce webu s náhradou za druhý jazyk. */
export function lt(text: LText | undefined, locale: "cs" | "en"): string {
  if (!text) return "";
  return (locale === "en" ? text.en || text.cs : text.cs || text.en) ?? "";
}
