import Link from "next/link";
import { notFound } from "next/navigation";
import { photoUrl } from "@/lib/media";
import { loadSeating } from "@/lib/seating-data";
import { createClient } from "@/lib/supabase/server";
import { requireWedding } from "@/lib/wedding";
import { PrintButton } from "../../hoste/print-button";
import { seatPositions, ShapeOutline, type ShapeId } from "../shapes";

export const metadata = { title: "Zasedací pořádek k tisku" };

type Props = { searchParams: Promise<{ udalost?: string }> };

const collator = new Intl.Collator("cs");

export default async function SeatingPrintPage({ searchParams }: Props) {
  const { udalost } = await searchParams;
  const wedding = await requireWedding();
  if (!udalost) notFound();
  const supabase = await createClient();
  const data = await loadSeating(supabase, wedding.id, udalost);
  if (!data) notFound();

  const guest = new Map(data.guests.map((g) => [g.id, g]));
  const tables = data.items.filter((i) => i.kind === "table").sort((a, b) => collator.compare(a.label ?? "", b.label ?? ""));
  const byTable = new Map<string, string[]>();
  for (const a of data.assignments) byTable.set(a.table_id, [...(byTable.get(a.table_id) ?? []), a.guest_id]);
  const tableLabel = new Map(data.items.map((i) => [i.id, i.label ?? ""]));
  const alphabetical = data.assignments
    .map((a) => ({ name: guest.get(a.guest_id)?.name ?? "", table: tableLabel.get(a.table_id) ?? "" }))
    .sort((a, b) => collator.compare(a.name.split(" ").slice(-1)[0] + a.name, b.name.split(" ").slice(-1)[0] + b.name));
  const bg = photoUrl(data.layout.background_key);

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-12 px-6 py-10 sm:px-10 print:max-w-none print:gap-0 print:p-0">
      <div className="flex flex-wrap items-end justify-between gap-4 print:hidden">
        <div className="flex flex-col gap-2">
          <Link href={`/app/zasedaci-poradek?udalost=${udalost}`} className="text-sm text-ink-soft hover:text-ink">Zpět na zasedací pořádek</Link>
          <h1 className="font-display text-4xl font-semibold tracking-tight">Tisk: {data.event.name}</h1>
          <p className="text-ink-soft">Plán sálu, seznam po stolech pro catering a abecední seznam ke vchodu. Každý začíná na nové stránce.</p>
        </div>
        <PrintButton />
      </div>

      {/* Plán sálu */}
      <section className="flex flex-col gap-4 print:break-after-page">
        <h2 className="font-display text-2xl font-semibold">Plán sálu: {data.event.name}</h2>
        <svg viewBox={`0 0 ${data.layout.width} ${data.layout.height}`} className="h-auto w-full rounded-xl border border-line bg-white print:border-0">
          {bg ? <image href={bg} width={data.layout.width} height={data.layout.height} preserveAspectRatio="xMidYMid meet" opacity={0.35} /> : null}
          {data.items.map((item) => {
            const count = byTable.get(item.id)?.length ?? 0;
            return (
              <g key={item.id} transform={`translate(${item.x} ${item.y}) rotate(${item.rotation})`}>
                {item.kind === "table"
                  ? seatPositions(item.shape as ShapeId, item.w, item.h, item.seats).map((p, i) => (
                      <circle key={i} cx={p.x} cy={p.y} r={16} fill={i < count ? "#1e2b26" : "#fff"} stroke="#1e2b26" strokeWidth={1.5} />
                    ))
                  : null}
                <ShapeOutline shape={item.shape as ShapeId} w={item.w} h={item.h} style={{ fill: "#fff", stroke: "#1e2b26", strokeWidth: 2, strokeDasharray: item.kind === "decor" ? "8 6" : undefined }} />
                <g transform={`rotate(${-item.rotation})`}>
                  <text textAnchor="middle" dy={7} fontSize={22} fontWeight={600}>{item.label}</text>
                </g>
              </g>
            );
          })}
        </svg>
      </section>

      {/* Po stolech */}
      <section className="flex flex-col gap-6 print:break-after-page print:pt-8">
        <h2 className="font-display text-2xl font-semibold">Hosté po stolech</h2>
        <div className="grid gap-6 sm:grid-cols-2 print:grid-cols-2">
          {tables.map((t) => {
            const ids = byTable.get(t.id) ?? [];
            return (
              <div key={t.id} className="break-inside-avoid">
                <h3 className="border-b border-ink pb-1 font-semibold">
                  {t.label} <span className="font-normal text-ink-soft">({ids.length} z {t.seats})</span>
                </h3>
                <ul className="divide-y divide-line">
                  {ids.map((id) => {
                    const g = guest.get(id);
                    const note = [g?.category && g.category !== "Dospělý" ? g.category : null, g?.diet, g?.allergies ? `alergie: ${g.allergies}` : null, g?.high_chair ? "dětská židlička" : null].filter(Boolean).join(", ");
                    return (
                      <li key={id} className="flex justify-between gap-4 py-1.5 text-sm">
                        <span>{g?.name}</span>
                        {note ? <span className="text-right font-medium">{note}</span> : null}
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </div>
      </section>

      {/* Abecedně */}
      <section className="flex flex-col gap-4 print:pt-8">
        <h2 className="font-display text-2xl font-semibold">Kde sedím</h2>
        <ul className="columns-1 gap-8 text-[15px] sm:columns-2 print:columns-3 print:text-sm">
          {alphabetical.map((r, i) => (
            <li key={i} className="flex break-inside-avoid justify-between gap-3 border-b border-dotted border-line py-1">
              <span>{r.name}</span>
              <span className="font-medium">{r.table}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
