/** Šablony svatebního webu. Šablona mění vzhled a rozložení, obsah zůstává. */

export type TemplateId = "pozvanka" | "herbar" | "magazin" | "noc" | "folklor";

export type Template = {
  id: TemplateId;
  name: string;
  description: string;
  /** Barvy pro náhledy, výběr šablony a obecné prvky (heslo, chyby) */
  colors: { background: string; text: string; muted: string; accent: string; line: string };
  displayFont: string;
  displayStyle: "normal" | "italic";
  displayWeight: number;
  bodyFont: string;
};

export const FONTS = {
  script: "'Pinyon Script', cursive",
  bodoni: "'Bodoni Moda', serif",
  instrument: "'Instrument Serif', serif",
  gloock: "'Gloock', serif",
  hand: "'Caveat', cursive",
  sans: "var(--font-geist-sans), system-ui, sans-serif",
} as const;

export const TEMPLATES: Template[] = [
  {
    id: "pozvanka",
    name: "Pozvánka",
    description: "Papírová pozvánka v obálce s voskovou pečetí, kaligrafie.",
    colors: { background: "#d6d0c4", text: "#1f2a44", muted: "#59627a", accent: "#7d1d2c", line: "#c4bcae" },
    displayFont: FONTS.script,
    displayStyle: "normal",
    displayWeight: 400,
    bodyFont: FONTS.instrument,
  },
  {
    id: "herbar",
    name: "Herbář",
    description: "Lisované květiny na herbářových listech, ručně psané poznámky.",
    colors: { background: "#e4e7dc", text: "#2b3a2a", muted: "#5f6d55", accent: "#8a4b2f", line: "#c9cfbd" },
    displayFont: FONTS.gloock,
    displayStyle: "normal",
    displayWeight: 400,
    bodyFont: FONTS.instrument,
  },
  {
    id: "magazin",
    name: "Magazín",
    description: "Obálka módního časopisu, velký didot a červená.",
    colors: { background: "#ffffff", text: "#141414", muted: "#5c5c5c", accent: "#c3122f", line: "#d9d9d9" },
    displayFont: FONTS.bodoni,
    displayStyle: "normal",
    displayWeight: 400,
    bodyFont: FONTS.instrument,
  },
  {
    id: "noc",
    name: "Hvězdná noc",
    description: "Skutečná hvězdná obloha nad místem svatby, půlnoční modrá a zlatá.",
    colors: { background: "#0f1733", text: "#ece6d8", muted: "#a9adbf", accent: "#d4b47c", line: "#2c3658" },
    displayFont: FONTS.instrument,
    displayStyle: "normal",
    displayWeight: 400,
    bodyFont: FONTS.instrument,
  },
  {
    id: "folklor",
    name: "Folklor",
    description: "Vyšívané křížkové stehy jako na krojích, červená a modrá.",
    colors: { background: "#f8f3ea", text: "#2a2320", muted: "#6b5f57", accent: "#b01e2d", line: "#e2d8c8" },
    displayFont: FONTS.gloock,
    displayStyle: "normal",
    displayWeight: 400,
    bodyFont: FONTS.instrument,
  },
];

/** Původní šablony se mapují na nejbližší novou. */
const LEGACY: Record<string, TemplateId> = { modern: "magazin", minimal: "magazin", romantic: "pozvanka", classic: "pozvanka", boho: "herbar" };

export function templateId(id: string | null | undefined): TemplateId {
  if (id && TEMPLATES.some((t) => t.id === id)) return id as TemplateId;
  return (id && LEGACY[id]) || "pozvanka";
}

export function getTemplate(id: string | null | undefined): Template {
  const tid = templateId(id);
  return TEMPLATES.find((t) => t.id === tid)!;
}

export function isTemplateId(id: string): id is TemplateId {
  return TEMPLATES.some((t) => t.id === id);
}
