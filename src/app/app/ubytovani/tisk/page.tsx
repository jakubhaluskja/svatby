import Link from "next/link";
import { loadLodging } from "@/lib/lodging-data";
import { createClient } from "@/lib/supabase/server";
import { requireWedding } from "@/lib/wedding";
import { PrintButton } from "../../hoste/print-button";

export const metadata = { title: "Seznam pro ubytovatele" };

const money = (v: number, c: string) => new Intl.NumberFormat("cs-CZ", { style: "currency", currency: c, maximumFractionDigits: 0 }).format(v);

export default async function LodgingPrintPage() {
  const wedding = await requireWedding();
  const supabase = await createClient();
  const data = await loadLodging(supabase, wedding.id);
  const guest = new Map(data.guests.map((g) => [g.id, g]));

  return (
    <div className="flex max-w-4xl flex-col gap-10 px-6 py-8 sm:px-10 lg:py-10 print:max-w-none print:p-0">
      <div className="flex flex-wrap items-end justify-between gap-4 print:hidden">
        <div className="flex flex-col gap-2">
          <Link href="/app/ubytovani" className="text-sm text-ink-soft hover:text-ink">Zpět na ubytování</Link>
          <h1 className="font-serif text-4xl tracking-tight">Seznam pro ubytovatele</h1>
          <p className="text-ink-soft">Každé ubytování začíná na nové stránce, můžete ho poslat přímo provozovateli.</p>
        </div>
        <PrintButton />
      </div>

      {data.lodgings.map((l) => {
        const total = l.rooms.reduce((n, r) => n + data.assignments.filter((a) => a.room_id === r.id).length, 0);
        return (
          <section key={l.id} className="flex flex-col gap-4 print:break-after-page">
            <div>
              <h2 className="font-display text-2xl font-semibold">{l.name}</h2>
              <p className="text-ink-soft">
                Svatba {wedding.partner1_name} a {wedding.partner2_name}
                {wedding.wedding_date ? `, ${new Intl.DateTimeFormat("cs-CZ", { dateStyle: "long", timeZone: "UTC" }).format(new Date(wedding.wedding_date))}` : ""}. Celkem {total} hostů.
              </p>
            </div>
            <table className="w-full text-left text-[15px]">
              <thead className="text-sm text-ink-soft">
                <tr className="border-b border-ink">
                  <th className="py-2 pr-4 font-normal">Pokoj</th>
                  <th className="py-2 pr-4 font-normal">Hosté</th>
                  <th className="py-2 pr-4 text-right font-normal">Cena za noc</th>
                  <th className="py-2 font-normal">Platí</th>
                </tr>
              </thead>
              <tbody>
                {l.rooms.map((r) => {
                  const names = data.assignments.filter((a) => a.room_id === r.id).map((a) => guest.get(a.guest_id)?.name).filter(Boolean);
                  return (
                    <tr key={r.id} className="border-b border-line align-top">
                      <td className="py-2 pr-4 font-medium">
                        {r.name}
                        <span className="block text-xs font-normal text-ink-soft">{names.length}/{r.capacity} lůžek</span>
                      </td>
                      <td className="py-2 pr-4">{names.join(", ") || <span className="text-ink-soft">volný</span>}</td>
                      <td className="py-2 pr-4 text-right tabular-nums">{r.price !== null ? money(r.price, r.currency) : ""}</td>
                      <td className="py-2">{r.paid_by === "couple" ? "novomanželé" : "hosté"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>
        );
      })}
    </div>
  );
}
