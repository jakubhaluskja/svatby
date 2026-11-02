"use client";

import { useEffect, useState } from "react";
import { Wordmark } from "@/components/ui";
import { scheduleState, type ScheduleItem } from "@/lib/schedule";

export type PublicItem = ScheduleItem & { vendor: { name: string; phone: string | null } | null };
type VendorContact = { name: string; category: string | null; contact_name: string | null; phone: string | null; email: string | null };

const TZ = "Europe/Prague";
const timeFmt = new Intl.DateTimeFormat("cs-CZ", { timeZone: TZ, hour: "2-digit", minute: "2-digit" });
const dayKeyFmt = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" });
const dayFmt = new Intl.DateTimeFormat("cs-CZ", { timeZone: TZ, weekday: "long", day: "numeric", month: "long" });

const tel = (phone: string) => `tel:${phone.replace(/[^\d+]/g, "")}`;

export function LiveSchedule({
  couple,
  audience,
  items,
  vendors,
  print,
}: {
  couple: string;
  audience: string | null;
  items: PublicItem[];
  vendors: VendorContact[];
  print: boolean;
}) {
  // Čas až v prohlížeči, ať se serverové a klientské vykreslení neliší.
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (print) window.print();
  }, [print]);

  const state = now && !print ? scheduleState(items, now) : null;
  const days = [...new Set(items.map((i) => dayKeyFmt.format(new Date(i.starts_at))))];
  const multiDay = days.length > 1;
  const live = state && (state.current.size > 0 || (state.past.size > 0 && state.next.length > 0));
  const currentItems = items.filter((i) => state?.current.has(i.id));
  const nextItem = items.find((i) => i.id === state?.next[0]);

  return (
    <main className="mx-auto flex min-h-svh max-w-2xl flex-col gap-8 px-5 py-8 print:max-w-none print:px-0 print:py-0">
      <header className="flex flex-col gap-1">
        <span className="text-sm text-ink-soft print:hidden">
          <Wordmark />
        </span>
        <h1 className="font-display text-3xl font-semibold tracking-tight">Harmonogram svatby</h1>
        <p className="text-ink-soft">
          {couple}
          {audience ? `, pro ${audience}` : ""}
        </p>
      </header>

      {live ? (
        <section aria-live="polite" className="flex flex-col gap-3 rounded-2xl bg-eucalyptus p-5 text-white print:hidden">
          <p className="text-sm uppercase tracking-wider text-white/75">Teď</p>
          {currentItems.length ? (
            currentItems.map((i) => (
              <p key={i.id} className="font-display text-2xl font-semibold leading-tight">
                {i.title}
                {i.location ? <span className="block text-base font-normal text-white/85">{i.location}</span> : null}
              </p>
            ))
          ) : (
            <p className="font-display text-2xl font-semibold">Pauza</p>
          )}
          {nextItem ? (
            <p className="border-t border-white/25 pt-3">
              <span className="text-sm uppercase tracking-wider text-white/75">Za chvíli </span>
              <span className="font-medium tabular-nums">{timeFmt.format(new Date(nextItem.starts_at))}</span> {nextItem.title}
            </p>
          ) : null}
        </section>
      ) : null}

      {items.length === 0 ? <p className="text-ink-soft">Harmonogram je zatím prázdný.</p> : null}

      {days.map((d) => (
        <section key={d} className="flex flex-col gap-2 break-inside-avoid">
          {multiDay ? (
            <h2 className="font-display text-xl font-semibold first-letter:uppercase">
              {dayFmt.format(new Date(items.find((i) => dayKeyFmt.format(new Date(i.starts_at)) === d)!.starts_at))}
            </h2>
          ) : null}
          <ol className="flex flex-col">
            {items
              .filter((i) => dayKeyFmt.format(new Date(i.starts_at)) === d)
              .map((i) => {
                const past = state?.past.has(i.id);
                const current = state?.current.has(i.id);
                return (
                  <li
                    key={i.id}
                    aria-current={current ? "step" : undefined}
                    className={`grid grid-cols-[4.5rem_minmax(0,1fr)] gap-3 border-l-2 py-3 pl-4 break-inside-avoid ${
                      current ? "border-eucalyptus bg-eucalyptus-mist" : "border-line"
                    } ${past ? "opacity-50" : ""}`}
                  >
                    <span className="tabular-nums">
                      <span className="text-lg font-medium">{timeFmt.format(new Date(i.starts_at))}</span>
                      {i.ends_at ? <span className="block text-sm text-ink-soft">do {timeFmt.format(new Date(i.ends_at))}</span> : null}
                    </span>
                    <div className="flex flex-col gap-0.5">
                      <span className="font-medium">{i.title}</span>
                      {i.location ? <span className="text-sm text-ink-soft">{i.location}</span> : null}
                      {i.responsible_name || i.vendor ? (
                        <span className="text-sm text-ink-soft">{[i.responsible_name, i.vendor?.name].filter(Boolean).join(", ")}</span>
                      ) : null}
                      {i.contact ? (
                        <a href={tel(i.contact)} className="self-start text-sm font-medium text-eucalyptus-deep underline underline-offset-2">
                          {i.contact}
                        </a>
                      ) : null}
                      {i.notes ? <span className="whitespace-pre-line text-sm">{i.notes}</span> : null}
                    </div>
                  </li>
                );
              })}
          </ol>
        </section>
      ))}

      {vendors.length ? (
        <section className="flex flex-col gap-2 break-inside-avoid">
          <h2 className="font-display text-xl font-semibold">Kontakty na dodavatele</h2>
          <ul className="flex flex-col divide-y divide-line border-y border-line">
            {vendors.map((v) => (
              <li key={v.name} className="flex flex-col gap-0.5 py-2.5 text-sm">
                <span>
                  <span className="font-medium">{v.name}</span>
                  {v.category ? <span className="text-ink-soft">, {v.category}</span> : null}
                  {v.contact_name ? <span className="text-ink-soft">, {v.contact_name}</span> : null}
                </span>
                <span className="flex flex-wrap gap-x-4">
                  {v.phone ? <a href={tel(v.phone)} className="font-medium text-eucalyptus-deep underline underline-offset-2">{v.phone}</a> : null}
                  {v.email ? <a href={`mailto:${v.email}`} className="text-ink-soft underline underline-offset-2">{v.email}</a> : null}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <button type="button" onClick={() => window.print()} className="self-start text-sm text-ink-soft underline underline-offset-2 hover:text-ink print:hidden">
        Vytisknout
      </button>
    </main>
  );
}
