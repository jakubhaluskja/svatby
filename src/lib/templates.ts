/** Šablony svatebního webu. Šablona mění jen vzhled, obsah zůstává. */

export type TemplateId = "modern" | "romantic" | "minimal" | "boho" | "classic";

export type Template = {
  id: TemplateId;
  name: string;
  description: string;
  colors: { background: string; text: string; muted: string; accent: string; line: string };
  displayFont: string;
  displayStyle: "normal" | "italic";
  displayWeight: number;
  bodyFont: string;
};

export const TEMPLATES: Template[] = [
  {
    id: "modern",
    name: "Moderní",
    description: "Výrazné bezpatkové písmo, zelené tóny, hodně vzduchu.",
    colors: { background: "#eef2ef", text: "#17211d", muted: "#55665e", accent: "#4f7263", line: "#cfd9d3" },
    displayFont: "var(--font-display)",
    displayStyle: "normal",
    displayWeight: 600,
    bodyFont: "var(--font-sans)",
  },
  {
    id: "romantic",
    name: "Romantická",
    description: "Kurzíva, pudrové a vínové odstíny.",
    colors: { background: "#f6ecee", text: "#3b2430", muted: "#7a5d69", accent: "#9c5b74", line: "#e6d3d8" },
    displayFont: "var(--font-cormorant)",
    displayStyle: "italic",
    displayWeight: 500,
    bodyFont: "var(--font-cormorant)",
  },
  {
    id: "minimal",
    name: "Minimalistická",
    description: "Černá na bílé, tenké písmo, nic navíc.",
    colors: { background: "#ffffff", text: "#151515", muted: "#6b6b6b", accent: "#151515", line: "#e5e5e5" },
    displayFont: "var(--font-sans)",
    displayStyle: "normal",
    displayWeight: 300,
    bodyFont: "var(--font-sans)",
  },
  {
    id: "boho",
    name: "Boho",
    description: "Teplé zemité barvy a měkké patkové písmo.",
    colors: { background: "#efe6da", text: "#3d3226", muted: "#76664f", accent: "#9a6b3f", line: "#dccdb9" },
    displayFont: "var(--font-fraunces)",
    displayStyle: "normal",
    displayWeight: 400,
    bodyFont: "var(--font-sans)",
  },
  {
    id: "classic",
    name: "Klasická",
    description: "Elegantní patkové písmo, tmavě modrá.",
    colors: { background: "#fbfaf7", text: "#1f2433", muted: "#5a6074", accent: "#2e3d5c", line: "#e2e0d8" },
    displayFont: "var(--font-cormorant)",
    displayStyle: "normal",
    displayWeight: 500,
    bodyFont: "var(--font-cormorant)",
  },
];

export function getTemplate(id: string | null | undefined): Template {
  return TEMPLATES.find((t) => t.id === id) ?? TEMPLATES[0];
}

export function isTemplateId(id: string): id is TemplateId {
  return TEMPLATES.some((t) => t.id === id);
}
