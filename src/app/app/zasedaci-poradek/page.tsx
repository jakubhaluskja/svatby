import Link from "next/link";
import { tr } from "@/lib/i18n";
import { loadSeating } from "@/lib/seating-data";
import { createClient } from "@/lib/supabase/server";
import { moduleLevel, requireWedding } from "@/lib/wedding";
import { SeatingEditor } from "./seating-editor";

export const metadata = { title: "Zasedací pořádek" };

type Props = { searchParams: Promise<{ udalost?: string }> };

export default async function SeatingPage({ searchParams }: Props) {
  const { udalost } = await searchParams;
  const wedding = await requireWedding();
  const supabase = await createClient();
  const { data: events } = await supabase
    .from("events")
    .select("id, name, is_seated")
    .eq("wedding_id", wedding.id)
    .order("starts_at", { ascending: true, nullsFirst: false });
  const seated = (events ?? []).filter((e) => e.is_seated);
  const current = seated.find((e) => e.id === udalost) ?? seated[0];

  const editable = (await moduleLevel(wedding.id, "seating")) === "write";
  const data = current ? await loadSeating(supabase, wedding.id, current.id) : null;

  return (
    <div className="mx-auto flex max-w-[90rem] flex-col gap-6 px-6 py-10 sm:px-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="font-display text-4xl font-semibold tracking-tight">Zasedací pořádek</h1>
          <p className="max-w-2xl text-ink-soft">
            Rozmístěte stoly a posaďte potvrzené hosty. Návrh rozsazení drží domácnosti pohromadě, respektuje vaše pravidla a seskupuje hosty podle štítků.
          </p>
        </div>
        {seated.length > 1 ? (
          <nav aria-label="Událost" className="flex flex-wrap gap-1">
            {seated.map((e) => (
              <Link key={e.id} href={`?udalost=${e.id}`} aria-current={e.id === current?.id ? "page" : undefined} className={`rounded-full px-3.5 py-1.5 text-sm ${e.id === current?.id ? "bg-ink text-white" : "text-ink-soft hover:text-ink"}`}>
                {tr(e.name)}
              </Link>
            ))}
          </nav>
        ) : null}
      </div>

      {!current || !data ? (
        <div className="flex flex-col items-start gap-3 rounded-2xl border border-dashed border-line px-6 py-10">
          <p className="font-medium">Žádná událost zatím nemá stoly.</p>
          <p className="max-w-lg text-ink-soft">
            Otevřete událost, kde hosté sedí, typicky hostinu, a zaškrtněte „Hosté sedí u stolů“.
          </p>
          <Link href="/app/udalosti" className="font-medium underline underline-offset-2">Přejít na události</Link>
        </div>
      ) : (
        <SeatingEditor key={current.id} data={data} weddingId={wedding.id} canEdit={editable} />
      )}
    </div>
  );
}
