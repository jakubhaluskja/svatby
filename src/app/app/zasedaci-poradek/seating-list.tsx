"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { SeatingData } from "@/lib/seating-data";
import { assignGuests, unassignGuests } from "./actions";

/** Zasedací pořádek na telefonu: stoly jako seznam, hosté se přesazují výběrem stolu. */
export function SeatingList({ data, canEdit }: { data: SeatingData; canEdit: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const tables = data.items.filter((i) => i.kind === "table").sort((a, b) => (a.label ?? "").localeCompare(b.label ?? "", "cs", { numeric: true }));
  const tableOf = new Map(data.assignments.map((a) => [a.guest_id, a.table_id]));
  const guests = data.guests.filter((g) => g.status !== "no" || tableOf.has(g.id));
  const unseated = guests.filter((g) => !tableOf.has(g.id));
  const label = (id: string) => tables.find((t) => t.id === id)?.label || "Stůl";

  function move(guestId: string, tableId: string) {
    setError(null);
    start(async () => {
      if (!tableId) await unassignGuests(data.event.id, [guestId]);
      else {
        const r = await assignGuests(data.event.id, tableId, [guestId]);
        if (r.error) setError(r.error);
      }
      router.refresh();
    });
  }

  const Row = ({ g }: { g: (typeof guests)[number] }) => (
    <li className="flex items-center gap-3 py-2">
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px]">{g.name}</span>
        <span className="block truncate text-xs text-ink-soft">
          {g.household}
          {g.status === "pending" ? " · bez odpovědi" : g.status === "no" ? " · nepřijde" : ""}
          {g.diet || g.allergies ? " · strava" : ""}
        </span>
      </span>
      {canEdit ? (
        <select
          aria-label={`Stůl pro ${g.name}`}
          disabled={pending}
          value={tableOf.get(g.id) ?? ""}
          onChange={(e) => move(g.id, e.target.value)}
          className="h-9 max-w-36 rounded-lg border border-line bg-surface px-2 text-sm"
        >
          <option value="">Bez místa</option>
          {tables.map((t) => {
            const count = data.assignments.filter((a) => a.table_id === t.id).length;
            return (
              <option key={t.id} value={t.id}>
                {t.label || "Stůl"} ({count}/{t.seats})
              </option>
            );
          })}
        </select>
      ) : null}
    </li>
  );

  return (
    <div className="flex flex-col gap-4">
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      {unseated.length ? (
        <section className="rounded-2xl bg-plum/8 p-4">
          <p className="font-medium text-plum">Bez místa ({unseated.length})</p>
          <ul className="divide-y divide-line/70">
            {unseated.map((g) => (
              <Row key={g.id} g={g} />
            ))}
          </ul>
        </section>
      ) : null}
      {tables.map((t) => {
        const seated = guests.filter((g) => tableOf.get(g.id) === t.id);
        const full = seated.length >= t.seats;
        return (
          <section key={t.id} className="rounded-2xl bg-surface shadow-card ring-1 ring-line/70">
            <button type="button" onClick={() => setOpen(open === t.id ? null : t.id)} className="flex w-full items-center gap-3 px-4 py-3 text-left" aria-expanded={open === t.id}>
              <span className="flex-1 font-medium">{label(t.id)}</span>
              <span className={`rounded-full px-2.5 py-0.5 text-xs tabular-nums ${full ? "bg-eucalyptus-mist text-eucalyptus-deep" : "bg-paper text-ink-soft"}`}>
                {seated.length}/{t.seats}
              </span>
            </button>
            {open === t.id ? (
              <ul className="divide-y divide-line/70 border-t border-line px-4">
                {seated.length ? seated.map((g) => <Row key={g.id} g={g} />) : <li className="py-3 text-sm text-ink-soft">Zatím nikdo.</li>}
              </ul>
            ) : null}
          </section>
        );
      })}
      {!tables.length ? <p className="text-sm text-ink-soft">Stoly rozmístíte na počítači nebo tabletu.</p> : null}
      <p className="text-xs text-ink-soft">Rozložení stolů a židle upravíte na větší obrazovce.</p>
    </div>
  );
}
