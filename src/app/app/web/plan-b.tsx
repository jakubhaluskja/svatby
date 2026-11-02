"use client";

import Link from "next/link";
import { useOptimistic, useTransition } from "react";
import { setPlanB } from "../udalosti/actions";

type Item = { id: string; name: string; place: string; planB: string; active: boolean };

export function PlanBList({ items }: { items: Item[] }) {
  const [list, update] = useOptimistic(items, (state, a: { id: string; active: boolean }) => state.map((i) => (i.id === a.id ? { ...i, active: a.active } : i)));
  const [, start] = useTransition();

  if (items.length === 0) {
    return (
      <p className="text-sm text-ink-soft">
        Zatím žádná událost nemá náhradní místo. Doplníte ho v <Link href="/app/udalosti" className="underline">úpravě události</Link>.
      </p>
    );
  }
  return (
    <ul className="divide-y divide-line rounded-2xl border border-line bg-surface">
      {list.map((i) => (
        <li key={i.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col">
            <span className="font-medium">{i.name}</span>
            <span className="text-sm text-ink-soft">
              {i.active ? <>Platí plán B: <strong className="text-plum">{i.planB}</strong></> : <>Teď: {i.place || "původní místo"}. Plán B: {i.planB}</>}
            </span>
          </div>
          <button
            type="button"
            onClick={() => start(async () => { update({ id: i.id, active: !i.active }); await setPlanB(i.id, !i.active); })}
            className={`h-10 shrink-0 rounded-full px-5 text-sm font-medium ${i.active ? "border border-line bg-surface hover:border-eucalyptus" : "bg-plum text-white hover:bg-plum/90"}`}
          >
            {i.active ? "Vrátit původní místo" : "Přepnout na plán B"}
          </button>
        </li>
      ))}
    </ul>
  );
}
