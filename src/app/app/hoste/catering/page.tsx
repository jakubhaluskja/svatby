import Link from "next/link";
import { dietNotes, highChairs, loadGuestBook, summarize } from "@/lib/guest-data";
import { createClient } from "@/lib/supabase/server";
import { formatEventTime } from "@/lib/time";
import { requireWedding } from "@/lib/wedding";
import { PrintButton } from "../print-button";

export const metadata = { title: "Přehled pro catering" };

export default async function CateringPage() {
  const wedding = await requireWedding();
  const supabase = await createClient();
  const book = await loadGuestBook(supabase, wedding.id);
  const summary = summarize(book);
  const hasUncategorized = summary.some((s) => (s.byCategory.get(null) ?? 0) > 0);

  return (
    <div className="flex max-w-4xl flex-col gap-10 px-6 py-8 sm:px-10 lg:py-10 print:max-w-none print:p-0">
      <div className="flex flex-wrap items-end justify-between gap-4 print:hidden">
        <div className="flex flex-col gap-2">
          <Link href="/app/hoste" className="text-sm text-ink-soft hover:text-ink">Zpět na hosty</Link>
          <h1 className="font-serif text-4xl tracking-tight">Přehled pro catering</h1>
          <p className="text-ink-soft">Počty potvrzených hostů a jejich strava. Čísla se mění s každou odpovědí.</p>
        </div>
        <PrintButton />
      </div>
      <h1 className="hidden text-2xl font-semibold print:block">
        {wedding.partner1_name} a {wedding.partner2_name}: podklady pro catering
      </h1>

      <div className="overflow-x-auto rounded-2xl bg-surface shadow-card ring-1 ring-line/70 print:rounded-none">
        <table className="w-full text-left text-[15px] tabular-nums">
          <thead className="text-sm text-ink-soft">
            <tr className="border-b border-line">
              <th className="px-5 py-3 font-normal">Událost</th>
              {book.categories.map((c) => (
                <th key={c.id} className="px-5 py-3 text-right font-normal">{c.label}</th>
              ))}
              {hasUncategorized ? <th className="px-5 py-3 text-right font-normal">Bez kategorie</th> : null}
              <th className="px-5 py-3 text-right font-normal">Celkem</th>
              <th className="px-5 py-3 text-right font-normal">Židličky</th>
            </tr>
          </thead>
          <tbody>
            {summary.map((s) => (
              <tr key={s.event.id} className="border-b border-line last:border-0">
                <td className="px-5 py-3">
                  {s.event.name}
                  {s.event.starts_at ? <span className="block text-sm text-ink-soft">{formatEventTime(s.event.starts_at)}</span> : null}
                </td>
                {book.categories.map((c) => (
                  <td key={c.id} className="px-5 py-3 text-right">{s.byCategory.get(c.id) ?? 0}</td>
                ))}
                {hasUncategorized ? <td className="px-5 py-3 text-right">{s.byCategory.get(null) ?? 0}</td> : null}
                <td className="px-5 py-3 text-right font-semibold">{s.yes}</td>
                <td className="px-5 py-3 text-right">{highChairs(book, s.event.id)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {summary.map((s) => {
        const diets = dietNotes(book, s.event.id);
        return (
          <section key={s.event.id} className="flex flex-col gap-3 break-inside-avoid">
            <h2 className="font-serif text-2xl">{s.event.name}: strava a alergie</h2>
            {diets.length === 0 ? (
              <p className="text-ink-soft">Nikdo z potvrzených hostů nehlásí zvláštní stravu.</p>
            ) : (
              <table className="w-full text-left text-[15px]">
                <thead className="text-sm text-ink-soft">
                  <tr className="border-b border-line">
                    <th className="py-2 pr-4 font-normal">Host</th>
                    <th className="py-2 pr-4 font-normal">Strava</th>
                    <th className="py-2 pr-4 font-normal">Alergie</th>
                  </tr>
                </thead>
                <tbody>
                  {diets.map((d) => (
                    <tr key={`${d.household}-${d.guest}`} className="border-b border-line">
                      <td className="py-2 pr-4">{d.guest}{d.category ? <span className="text-ink-soft">, {d.category}</span> : null}</td>
                      <td className="py-2 pr-4">{d.diet}</td>
                      <td className="py-2 pr-4 font-medium text-plum">{d.allergies}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        );
      })}
    </div>
  );
}
