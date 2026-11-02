import Link from "next/link";
import { FormMessage } from "@/components/ui";
import { guestName, guestStatus, loadGuestBook, summarize, type HouseholdRow } from "@/lib/guest-data";
import { createClient } from "@/lib/supabase/server";
import { requireWedding } from "@/lib/wedding";
import { StatusBadge } from "./status";

export const metadata = { title: "Hosté" };

type Filter = "vse" | "ceka" | "prijdou" | "neprijdou";
type Props = { searchParams: Promise<{ filtr?: Filter; q?: string; pridano?: string; smazano?: string }> };

function householdState(h: HouseholdRow): "ceka" | "prijdou" | "neprijdou" {
  const statuses = h.guests.flatMap((g) => h.event_ids.map((e) => guestStatus(h, g, e) ?? "pending"));
  if (statuses.length === 0 || statuses.includes("pending")) return "ceka";
  return statuses.includes("yes") ? "prijdou" : "neprijdou";
}

export default async function GuestsPage({ searchParams }: Props) {
  const { filtr = "vse", q = "", pridano } = await searchParams;
  const wedding = await requireWedding();
  const supabase = await createClient();
  const book = await loadGuestBook(supabase, wedding.id);
  const summary = summarize(book);

  const needle = q.trim().toLowerCase();
  const visible = book.households.filter((h) => {
    if (filtr !== "vse" && householdState(h) !== filtr) return false;
    if (!needle) return true;
    return h.name.toLowerCase().includes(needle) || h.guests.some((g) => guestName(g).toLowerCase().includes(needle));
  });

  const guestTotal = book.households.reduce((n, h) => n + h.guests.length, 0);
  const counts = { vse: book.households.length, ceka: 0, prijdou: 0, neprijdou: 0 };
  for (const h of book.households) counts[householdState(h)]++;
  const added = pridano ? book.households.find((h) => h.id === pridano) : null;

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-10 px-6 py-10 sm:px-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="font-display text-4xl font-semibold tracking-tight">Hosté</h1>
          <p className="text-ink-soft">
            {guestTotal} hostů v {book.households.length} domácnostech
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/app/hoste/import" className="inline-flex h-11 items-center rounded-full border border-line bg-surface px-5 font-medium hover:border-eucalyptus">
            Vložit z Excelu
          </Link>
          <Link href="/app/hoste/nova" className="inline-flex h-11 items-center rounded-full bg-eucalyptus px-6 font-medium text-white hover:bg-eucalyptus-deep">
            Přidat domácnost
          </Link>
        </div>
      </div>

      {added ? (
        <FormMessage tone="info">
          Domácnost {added.name} je přidaná. <Link href={`/app/hoste/${added.id}`} className="font-medium underline">Zobrazit osobní odkaz</Link>
        </FormMessage>
      ) : null}

      {summary.length > 0 ? (
        <section aria-labelledby="souhrn" className="flex flex-col gap-3">
          <h2 id="souhrn" className="sr-only">Souhrn odpovědí</h2>
          <div className="overflow-x-auto rounded-2xl border border-line bg-surface">
            <table className="w-full text-left text-[15px]">
              <thead className="text-sm text-ink-soft">
                <tr className="border-b border-line">
                  <th className="px-5 py-3 font-normal">Událost</th>
                  <th className="px-5 py-3 text-right font-normal">Přijde</th>
                  <th className="px-5 py-3 text-right font-normal">Nepřijde</th>
                  <th className="px-5 py-3 text-right font-normal">Čeká</th>
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {summary.map((s) => (
                  <tr key={s.event.id} className="border-b border-line last:border-0">
                    <td className="px-5 py-3">{s.event.name}</td>
                    <td className="px-5 py-3 text-right font-medium text-eucalyptus-deep">{s.yes}</td>
                    <td className="px-5 py-3 text-right">{s.no}</td>
                    <td className="px-5 py-3 text-right text-ink-soft">{s.pending}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
            <Link href="/app/hoste/catering" className="underline underline-offset-2 hover:text-eucalyptus-deep">Přehled pro catering</Link>
            {/* stažení souboru, ne navigace */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a href="/app/hoste/export" className="underline underline-offset-2 hover:text-eucalyptus-deep">Stáhnout seznam (Excel)</a>
            <Link href="/app/hoste/qr" className="underline underline-offset-2 hover:text-eucalyptus-deep">QR kódy k tisku</Link>
          </div>
        </section>
      ) : null}

      <section className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <nav aria-label="Filtr" className="flex flex-wrap gap-1">
            {(
              [
                ["vse", "Všichni"],
                ["ceka", "Čeká na odpověď"],
                ["prijdou", "Přijdou"],
                ["neprijdou", "Nepřijdou"],
              ] as const
            ).map(([key, label]) => (
              <Link
                key={key}
                href={{ query: { ...(key !== "vse" ? { filtr: key } : {}), ...(q ? { q } : {}) } }}
                aria-current={filtr === key ? "page" : undefined}
                className={`rounded-full px-3.5 py-1.5 text-sm ${filtr === key ? "bg-ink text-white" : "text-ink-soft hover:text-ink"}`}
              >
                {label} <span className="tabular-nums opacity-70">{counts[key]}</span>
              </Link>
            ))}
          </nav>
          <form className="flex">
            {filtr !== "vse" ? <input type="hidden" name="filtr" value={filtr} /> : null}
            <input
              type="search"
              name="q"
              defaultValue={q}
              placeholder="Hledat jméno"
              aria-label="Hledat jméno"
              className="h-10 w-full rounded-full border border-line bg-surface px-4 text-[15px] focus:border-eucalyptus focus:outline-none sm:w-64"
            />
          </form>
        </div>

        {book.households.length === 0 ? (
          <div className="flex flex-col items-start gap-3 rounded-2xl border border-dashed border-line px-6 py-10">
            <p className="font-medium">Zatím tu nikdo není.</p>
            <p className="max-w-lg text-ink-soft">
              Přidejte první domácnost ručně, nebo vložte celý seznam z Excelu. Každá domácnost dostane vlastní odkaz, přes který potvrdí účast.
            </p>
          </div>
        ) : visible.length === 0 ? (
          <p className="text-ink-soft">Tomuhle filtru nikdo neodpovídá.</p>
        ) : (
          <ul className="divide-y divide-line border-y border-line">
            {visible.map((h) => (
              <li key={h.id}>
                <Link href={`/app/hoste/${h.id}`} className="flex flex-col gap-2 py-4 hover:bg-surface sm:px-2">
                  <span className="flex items-center justify-between gap-4">
                    <span className="font-medium">{h.name}</span>
                    <span className="text-sm text-ink-soft">
                      {h.rsvp_submitted_at ? "Odpověděli" : "Bez odpovědi"}
                    </span>
                  </span>
                  <span className="flex flex-col gap-1.5">
                    {h.guests.map((g) => (
                      <span key={g.id} className="flex flex-wrap items-center gap-2 text-[15px]">
                        <span className="min-w-40 text-ink-soft">{guestName(g)}</span>
                        {book.events
                          .filter((e) => h.event_ids.includes(e.id))
                          .map((e) => (
                            <StatusBadge key={e.id} status={guestStatus(h, g, e.id) ?? "pending"} label={`${e.name}: ${
                              { yes: "ano", no: "ne", pending: "čeká" }[guestStatus(h, g, e.id) ?? "pending"]
                            }`} />
                          ))}
                      </span>
                    ))}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
