import { tr } from "@/lib/i18n";
import { loadSeating } from "@/lib/seating-data";
import { createClient } from "@/lib/supabase/server";
import { getTemplate } from "@/lib/templates";
import { requireWedding } from "@/lib/wedding";
import { PrintStudio, type PrintTable } from "./print-studio";

export const metadata = { title: "Tiskoviny" };

type Props = { searchParams: Promise<{ udalost?: string }> };

export default async function PrintablesPage({ searchParams }: Props) {
  const { udalost } = await searchParams;
  const wedding = await requireWedding();
  const supabase = await createClient();
  const { data: events } = await supabase.from("events").select("id, name, is_seated").eq("wedding_id", wedding.id).order("starts_at", { nullsFirst: false });
  const seated = (events ?? []).filter((e) => e.is_seated);
  const current = seated.find((e) => e.id === udalost) ?? seated[0] ?? null;
  const data = current ? await loadSeating(supabase, wedding.id, current.id) : null;
  const { data: page } = await supabase.from("site_pages").select("template").eq("wedding_id", wedding.id).eq("state", "draft").maybeSingle();
  const t = getTemplate(page?.template ?? wedding.template);

  const tables: PrintTable[] = data
    ? data.items
        .filter((i) => i.kind === "table")
        .sort((a, b) => (a.label ?? "").localeCompare(b.label ?? "", "cs", { numeric: true }))
        .map((tb) => ({
          id: tb.id,
          label: tb.label || "Stůl",
          guests: data.assignments
            .filter((a) => a.table_id === tb.id)
            .sort((a, b) => (a.seat_index ?? 99) - (b.seat_index ?? 99))
            .map((a) => data.guests.find((g) => g.id === a.guest_id)?.name ?? "")
            .filter(Boolean),
        }))
    : [];

  return (
    <PrintStudio
      couple={`${wedding.partner1_name} & ${wedding.partner2_name}`}
      date={wedding.wedding_date}
      events={seated.map((e) => ({ id: e.id, name: tr(e.name) }))}
      eventId={current?.id ?? null}
      tables={tables}
      theme={{ bg: t.colors.background, text: t.colors.text, muted: t.colors.muted, accent: t.colors.accent, line: t.colors.line, display: t.displayFont, body: t.bodyFont }}
    />
  );
}
