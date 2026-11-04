import "server-only";
import { parseCnbEur } from "@/lib/budget";
import { createAdminClient } from "@/lib/supabase/admin";
import { utcToZonedParts } from "@/lib/time";

const URL_CNB = "https://www.cnb.cz/cs/financni-trhy/devizovy-trh/kurzy-devizoveho-trhu/kurzy-devizoveho-trhu/denni_kurz.txt";
const FALLBACK = 25;

export type EurRate = { rate: number; date: string | null; fallback: boolean };

/**
 * Aktuální kurz eura podle ČNB. Uložený kurz se použije, pokud je z dneška
 * (nebo ČNB ještě nevyhlásila nový); jinak se stáhne a uloží.
 */
export async function eurRate(): Promise<EurRate> {
  const db = createAdminClient();
  const { data: last } = await db.from("exchange_rates").select("rate_date, czk_per_unit").eq("currency", "EUR").order("rate_date", { ascending: false }).limit(1).maybeSingle();
  const now = utcToZonedParts(new Date().toISOString());
  const fresh = last && (last.rate_date === now.date || now.time < "14:40" && daysBetween(last.rate_date, now.date) <= 3);
  if (last && fresh) return { rate: Number(last.czk_per_unit), date: last.rate_date, fallback: false };

  try {
    const res = await fetch(URL_CNB, { next: { revalidate: 3600 }, signal: AbortSignal.timeout(3000) });
    if (res.ok) {
      const parsed = parseCnbEur(await res.text());
      if (parsed) {
        await db.from("exchange_rates").upsert({ rate_date: parsed.date, currency: "EUR", czk_per_unit: parsed.rate }, { onConflict: "rate_date,currency" });
        return { rate: parsed.rate, date: parsed.date, fallback: false };
      }
    }
  } catch {
    // ČNB nedostupná – použije se poslední známý kurz
  }
  if (last) return { rate: Number(last.czk_per_unit), date: last.rate_date, fallback: false };
  return { rate: FALLBACK, date: null, fallback: true };
}

function daysBetween(a: string, b: string) {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}
