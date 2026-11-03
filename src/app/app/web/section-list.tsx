"use client";

import Link from "next/link";
import { useOptimistic, useTransition } from "react";
import type { SectionType } from "@/lib/site-sections";
import { moveSection, toggleSection } from "./actions";

type Item = { type: SectionType; label: string; hint: string; enabled: boolean; filled: boolean };

export function SectionList({ items }: { items: Item[] }) {
  const [list, update] = useOptimistic(items, (state, action: { type: SectionType; enabled?: boolean; move?: -1 | 1 }) => {
    const next = state.map((s) => (s.type === action.type && action.enabled !== undefined ? { ...s, enabled: action.enabled } : s));
    if (action.move) {
      const i = next.findIndex((s) => s.type === action.type);
      const j = i + action.move;
      if (i > 0 && j > 0 && j < next.length) [next[i], next[j]] = [next[j], next[i]];
    }
    return next;
  });
  const [, start] = useTransition();

  return (
    <ol className="divide-y divide-line rounded-2xl bg-surface shadow-card ring-1 ring-line/70">
      {list.map((s, i) => (
        <li key={s.type} className={`flex items-center gap-3 px-4 py-3 sm:px-5 ${s.enabled ? "" : "bg-paper/60"}`}>
          <div className="flex shrink-0 flex-col">
            <button
              type="button"
              aria-label={`Posunout ${s.label} výš`}
              disabled={i <= 1}
              onClick={() => start(async () => { update({ type: s.type, move: -1 }); await moveSection(s.type, -1); })}
              className="h-5 w-7 rounded text-ink-soft hover:bg-paper hover:text-ink disabled:invisible"
            >
              ▲
            </button>
            <button
              type="button"
              aria-label={`Posunout ${s.label} níž`}
              disabled={i === 0 || i === list.length - 1}
              onClick={() => start(async () => { update({ type: s.type, move: 1 }); await moveSection(s.type, 1); })}
              className="h-5 w-7 rounded text-ink-soft hover:bg-paper hover:text-ink disabled:invisible"
            >
              ▼
            </button>
          </div>
          <Link href={`/app/web/${s.type}`} className="flex min-w-0 flex-1 flex-col py-1">
            <span className={`font-medium ${s.enabled ? "" : "text-ink-soft"}`}>{s.label}</span>
            <span className="truncate text-sm text-ink-soft">{s.filled ? s.hint : `Zatím prázdné. ${s.hint}`}</span>
          </Link>
          <Link href={`/app/web/${s.type}`} className="hidden rounded-full px-3 py-1.5 text-sm text-ink-soft hover:bg-paper hover:text-ink sm:block">
            Upravit
          </Link>
          {s.type === "hero" ? (
            <span className="w-[4.5rem] text-right text-sm text-ink-soft">Vždy</span>
          ) : (
            <label className="relative inline-flex w-[4.5rem] cursor-pointer justify-end">
              <input
                type="checkbox"
                checked={s.enabled}
                onChange={(e) => {
                  const enabled = e.target.checked;
                  start(async () => { update({ type: s.type, enabled }); await toggleSection(s.type, enabled); });
                }}
                className="peer sr-only"
                aria-label={`Zobrazit sekci ${s.label}`}
              />
              <span className="h-6 w-11 rounded-full bg-line transition-colors peer-checked:bg-eucalyptus peer-focus-visible:ring-2 peer-focus-visible:ring-eucalyptus/40" />
              <span className="absolute right-[1.375rem] top-0.5 size-5 rounded-full bg-white shadow transition-transform peer-checked:translate-x-5" />
            </label>
          )}
        </li>
      ))}
    </ol>
  );
}
