import { z } from "zod";

/** Lokalizovaný text sekce: {"cs": "...", "en": "..."} */
const L = z.object({ cs: z.string().max(5000).default(""), en: z.string().max(5000).default("") }).default({});
export type LText = z.infer<typeof L>;

const photo = z.string().max(300).nullable().default(null);
const photos = (max: number) => z.array(z.string().max(300)).max(max).default([]);
const url = z
  .string()
  .max(500)
  .default("")
  .transform((v) => {
    const t = v.trim();
    if (!t) return "";
    if (/^https?:\/\//i.test(t)) return t;
    // Jiné schéma (javascript:, data:…) nepustíme
    if (/^[a-z][a-z0-9+.-]*:/i.test(t)) return "";
    return `https://${t}`;
  });

/** Vlastní nadpis sekce (prázdný = výchozí nadpis šablony). Texty sekcí jsou bohatý text (viz rich-text.ts). */
export const SECTION_SCHEMAS = {
  hero: z
    .object({
      tagline: L,
      intro: L,
      photo,
      /** Hlavní informace pod úvodem: sraz, obřad, hostina… */
      info: z.array(z.object({ label: L, time: z.string().max(20).default(""), place: L, text: L, map: url })).max(6).default([]),
    })
    .default({}),
  schedule: z.object({ title: L, intro: L }).default({}),
  location: z.object({ title: L, text: L, photo }).default({}),
  story: z.object({ title: L, text: L, photos: z.array(z.string().max(300)).max(6).default([]) }).default({}),
  dresscode: z
    .object({ title: L, text: L, colors: z.array(z.string().regex(/^#[0-9a-fA-F]{6}$/)).max(5).default([]), photos: photos(8) })
    .default({}),
  accommodation: z.object({ title: L, text: L }).default({}),
  gifts: z.object({ title: L, text: L, show_account: z.boolean().default(true) }).default({}),
  faq: z.object({ title: L, items: z.array(z.object({ q: L, a: L })).max(30).default([]) }).default({}),
  contacts: z
    .object({
      title: L,
      items: z
        .array(z.object({ name: z.string().max(80).default(""), role: L, phone: z.string().max(40).default(""), email: z.string().max(120).default(""), photo }))
        .max(10)
        .default([]),
    })
    .default({}),
  rsvp: z.object({ title: L, intro: L }).default({}),
  gallery: z.object({ title: L, text: L, photos: photos(40) }).default({}),
  menu: z
    .object({ title: L, text: L, courses: z.array(z.object({ name: L, dishes: L })).max(12).default([]) })
    .default({}),
  /** Vlastní obsahová sekce – může jich být víc. */
  custom: z.object({ title: L, text: L, photos: photos(12) }).default({}),
} as const;

export type SectionType = keyof typeof SECTION_SCHEMAS;
export const SECTION_TYPES = Object.keys(SECTION_SCHEMAS) as SectionType[];

export type SectionContent<T extends SectionType> = z.infer<(typeof SECTION_SCHEMAS)[T]>;
export type Section = { [T in SectionType]: { id: string; type: T; enabled: boolean; content: SectionContent<T> } }[SectionType];

/** Sekce, kterých může být na webu víc (každá má vlastní id). */
export const REPEATABLE: SectionType[] = ["custom"];
export const isRepeatable = (t: SectionType) => REPEATABLE.includes(t);
export const MAX_CUSTOM = 12;
export const newSectionId = (t: SectionType) => `${t}-${Math.random().toString(36).slice(2, 10)}`;
const ID_RE = /^[a-z]+(-[a-z0-9]{4,12})?$/;

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
  gallery: { cs: "Galerie", en: "Gallery", hint: "Vaše společné fotky – až 40, hosté si je prohlédnou ve větším." },
  menu: { cs: "Svatební menu", en: "Menu", hint: "Co se bude podávat, chod po chodu." },
  custom: { cs: "Vlastní sekce", en: "Section", hint: "Nadpis, text a fotky – cokoli dalšího chcete hostům říct." },
};

const DEFAULT_ENABLED: SectionType[] = ["hero", "schedule", "location", "rsvp"];

/**
 * Převede uložená data na úplný, platný seznam sekcí:
 * doplní chybějící sekce, zahodí neznámé a doplní výchozí hodnoty obsahu.
 */
export function normalizeSections(raw: unknown): Section[] {
  const list = Array.isArray(raw) ? raw : [];
  const seen = new Set<string>();
  const out: Section[] = [];
  let customs = 0;

  for (const item of list) {
    const type = (item as { type?: string })?.type as SectionType;
    if (!SECTION_TYPES.includes(type)) continue;
    let id = type as string;
    if (isRepeatable(type)) {
      const raw = String((item as { id?: unknown }).id ?? "");
      id = ID_RE.test(raw) && raw.startsWith(`${type}-`) ? raw : newSectionId(type);
      if (++customs > MAX_CUSTOM) continue;
    }
    if (seen.has(id)) continue;
    seen.add(id);
    const parsed = SECTION_SCHEMAS[type].safeParse((item as { content?: unknown }).content ?? {});
    out.push({
      id,
      type,
      enabled: (item as { enabled?: unknown }).enabled !== false,
      content: parsed.success ? parsed.data : SECTION_SCHEMAS[type].parse({}),
    } as Section);
  }

  for (const type of SECTION_TYPES) {
    if (seen.has(type) || isRepeatable(type)) continue;
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
