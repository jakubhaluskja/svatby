/**
 * Hromadné vložení hostů zkopírovaných z Excelu nebo Tabulek Google.
 *
 * Očekávané sloupce (záhlaví je nepovinné):
 *   Domácnost | Jméno | Příjmení | Kategorie | E-mail
 * Prázdná buňka Domácnost = stejná domácnost jako na předchozím řádku.
 */

export type ImportedGuest = { first_name: string; last_name: string | null; category: string | null; email: string | null };
export type ImportedHousehold = { name: string; guests: ImportedGuest[] };
export type ImportResult = { households: ImportedHousehold[]; skipped: number[] };

const HEADER_WORDS = ["domácnost", "domacnost", "household", "jméno", "jmeno", "first name"];

function splitRow(line: string): string[] {
  const delimiter = line.includes("\t") ? "\t" : line.includes(";") ? ";" : ",";
  const cells: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cur += ch;
    } else if (ch === '"' && cur === "") quoted = true;
    else if (ch === delimiter) {
      cells.push(cur.trim());
      cur = "";
    } else cur += ch;
  }
  cells.push(cur.trim());
  return cells;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function parseGuestImport(text: string): ImportResult {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  const households: ImportedHousehold[] = [];
  const skipped: number[] = [];
  let current: ImportedHousehold | null = null;

  lines.forEach((line, index) => {
    if (!line.trim()) return;
    const cells = splitRow(line);
    if (cells.every((c) => !c)) return;
    const [household = "", first = "", last = "", category = "", email = ""] = cells;

    if (index === 0 && HEADER_WORDS.some((w) => household.toLowerCase().startsWith(w) || first.toLowerCase().startsWith(w))) {
      return;
    }
    if (!first) {
      skipped.push(index + 1);
      return;
    }

    if (household) {
      const existing = households.find((h) => h.name.toLowerCase() === household.toLowerCase());
      current = existing ?? { name: household, guests: [] };
      if (!existing) households.push(current);
    } else if (!current) {
      current = { name: [first, last].filter(Boolean).join(" "), guests: [] };
      households.push(current);
    }

    current.guests.push({
      first_name: first,
      last_name: last || null,
      category: category || null,
      email: EMAIL_RE.test(email) ? email.toLowerCase() : null,
    });
  });

  return { households, skipped };
}

/** Přiřazení textu kategorie („dítě“, „0–3“, „Child 4–12“) k věkové kategorii svatby. */
export function matchCategory(
  text: string | null,
  categories: { id: string; label: string; is_adult: boolean; min_age: number | null; max_age: number | null }[],
): string | null {
  if (!text) return categories.find((c) => c.is_adult)?.id ?? null;
  const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, "");
  const t = norm(text);
  const exact = categories.find((c) => norm(c.label) === t);
  if (exact) return exact.id;
  const age = Number(t.match(/\d+/)?.[0]);
  if (!Number.isNaN(age) && /\d/.test(t)) {
    const byAge = categories.find((c) => (c.min_age ?? 0) <= age && age <= (c.max_age ?? 200));
    if (byAge) return byAge.id;
  }
  if (/dosp|adult/.test(t)) return categories.find((c) => c.is_adult)?.id ?? null;
  if (/dit|child|kid/.test(t)) return categories.find((c) => !c.is_adult)?.id ?? null;
  return categories.find((c) => c.is_adult)?.id ?? null;
}
