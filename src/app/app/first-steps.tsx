"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Icon } from "@/components/icons";

export type Step = { key: string; title: string; text: string; href: string; done: boolean };

/** Průvodce prvními kroky na přehledu (dá se skrýt, zmizí po dokončení). */
export function FirstSteps({ steps, weddingId }: { steps: Step[]; weddingId: string }) {
  const storageKey = `svatby-first-steps-${weddingId}`;
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    try {
      setHidden(localStorage.getItem(storageKey) === "1");
    } catch {
      /* úložiště nedostupné */
    }
  }, [storageKey]);
  const done = steps.filter((s) => s.done).length;
  if (hidden || done === steps.length) return null;
  const next = steps.find((s) => !s.done);

  return (
    <section className="rounded-2xl bg-surface p-6 shadow-card ring-1 ring-line/70" data-tour="first-steps">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="font-serif text-2xl">První kroky</h2>
          <p className="text-sm text-ink-soft">
            Hotovo {done} z {steps.length}. Pořadí je jen doporučení.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setHidden(true);
            try {
              localStorage.setItem(storageKey, "1");
            } catch {
              /* úložiště nedostupné */
            }
          }}
          className="text-sm text-ink-soft hover:text-ink"
        >
          Skrýt
        </button>
      </div>
      <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-paper">
        <div className="h-full rounded-full bg-eucalyptus transition-all" style={{ width: `${(done / steps.length) * 100}%` }} />
      </div>
      <ol className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {steps.map((s, i) => (
          <li key={s.key}>
            <Link
              href={s.href}
              className={`flex h-full gap-3 rounded-xl p-3.5 ring-1 transition-colors ${
                s.done ? "ring-transparent bg-paper/70 text-ink-soft" : s.key === next?.key ? "bg-eucalyptus-mist ring-eucalyptus/40 hover:ring-eucalyptus" : "ring-line hover:ring-eucalyptus/60"
              }`}
            >
              <span className={`grid size-7 shrink-0 place-items-center rounded-full text-sm font-medium ${s.done ? "bg-eucalyptus text-white" : "bg-surface text-ink ring-1 ring-line"}`}>
                {s.done ? <Icon n="check" className="size-4" /> : i + 1}
              </span>
              <span className="min-w-0">
                <span className={`block font-medium ${s.done ? "line-through decoration-ink-soft/50" : ""}`}>{s.title}</span>
                {!s.done ? <span className="block text-sm text-ink-soft">{s.text}</span> : null}
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}
