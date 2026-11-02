export type Locale = "cs" | "en";
export type LocalizedText = Partial<Record<Locale, string>>;

/** Text v požadovaném jazyce s náhradou za druhý jazyk. */
export function tr(value: unknown, locale: Locale = "cs"): string {
  if (!value || typeof value !== "object") return typeof value === "string" ? value : "";
  const v = value as LocalizedText;
  return v[locale] || v.cs || v.en || "";
}
