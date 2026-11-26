"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/icons";

type Item = {
  id: string;
  startsAt: string;
  endsAt: string | null;
  date: string;
  start: string;
  end: string | null;
  title: string;
  location: string | null;
  responsible: string | null;
  contact: string | null;
  notes: string | null;
  vendor: string | null;
  vendorPhone: string | null;
};
type Vendor = { id: string; name: string; category: string | null; person: string | null; phone: string | null; email: string | null };
type Place = { name: string; place: string | null; address: string | null; planB: boolean };

/** Telefonní číslo v textu kontaktu → odkaz tel:. */
function phoneOf(s: string | null): string | null {
  const m = s?.match(/\+?\d[\d\s]{7,}\d/);
  return m ? m[0].replace(/\s/g, "") : null;
}

const dayFmt = new Intl.DateTimeFormat("cs-CZ", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });

export function DayView({ items, vendors, places, weddingDate }: { items: Item[]; vendors: Vendor[]; places: Place[]; weddingDate: string | null }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const current = now === null ? null : items.findLast((i) => Date.parse(i.startsAt) <= now && (i.endsAt ? Date.parse(i.endsAt) > now : true));
  const next = now === null ? null : items.find((i) => Date.parse(i.startsAt) > now);
  const days = [...new Set(items.map((i) => i.date))];

  if (!items.length) {
    return (
      <p className="rounded-2xl border border-dashed border-line px-6 py-10 text-center text-ink-soft">
        Harmonogram je zatím prázdný. Doplňte ho v sekci Harmonogram – tady pak uvidíte, co se právě děje a co následuje.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {current || next ? (
        <section className="grid gap-3 sm:grid-cols-2">
          {current ? (
            <div className="rounded-2xl bg-eucalyptus p-5 text-white shadow-card">
              <p className="text-sm text-white/75">Právě probíhá</p>
              <p className="mt-1 font-serif text-2xl leading-tight">{current.title}</p>
              <p className="mt-1 text-sm text-white/85">
                {current.start}
                {current.end ? `–${current.end}` : ""}
                {current.location ? ` · ${current.location}` : ""}
              </p>
            </div>
          ) : null}
          {next ? (
            <div className="rounded-2xl bg-surface p-5 shadow-card ring-1 ring-line/70">
              <p className="text-sm text-ink-soft">Následuje v {next.start}</p>
              <p className="mt-1 font-serif text-2xl leading-tight">{next.title}</p>
              {next.location ? <p className="mt-1 text-sm text-ink-soft">{next.location}</p> : null}
            </div>
          ) : null}
        </section>
      ) : null}

      {days.map((d) => (
        <section key={d} className="flex flex-col gap-2">
          {days.length > 1 || d !== weddingDate ? <h2 className="text-sm font-medium capitalize text-ink-soft">{dayFmt.format(new Date(`${d}T12:00:00Z`))}</h2> : null}
          <ol className="flex flex-col divide-y divide-line/70 overflow-hidden rounded-2xl bg-surface shadow-card ring-1 ring-line/70">
            {items
              .filter((i) => i.date === d)
              .map((i) => {
                const past = now !== null && Date.parse(i.endsAt ?? i.startsAt) < now && i.id !== current?.id;
                const tel = phoneOf(i.contact) ?? (i.vendorPhone ? i.vendorPhone.replace(/\s/g, "") : null);
                return (
                  <li key={i.id} className={`flex gap-4 px-4 py-3.5 ${i.id === current?.id ? "bg-eucalyptus-mist" : ""} ${past ? "opacity-50" : ""}`}>
                    <span className="w-12 shrink-0 pt-0.5 font-medium tabular-nums">{i.start}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium">{i.title}</span>
                      <span className="block text-sm text-ink-soft">
                        {[i.location, i.responsible, i.vendor].filter(Boolean).join(" · ")}
                      </span>
                      {i.notes ? <span className="mt-1 block text-sm">{i.notes}</span> : null}
                    </span>
                    {tel ? (
                      <a href={`tel:${tel}`} aria-label={`Zavolat: ${i.title}`} className="grid size-10 shrink-0 place-items-center self-center rounded-full bg-paper text-eucalyptus-deep hover:bg-eucalyptus-mist">
                        <Icon n="phone" className="size-4" />
                      </a>
                    ) : null}
                  </li>
                );
              })}
          </ol>
        </section>
      ))}

      {places.length ? (
        <section className="flex flex-col gap-2">
          <h2 className="font-serif text-2xl">Místa</h2>
          <ul className="flex flex-col divide-y divide-line/70 overflow-hidden rounded-2xl bg-surface shadow-card ring-1 ring-line/70">
            {places.map((p, i) => (
              <li key={i} className="flex items-center gap-3 px-4 py-3">
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">
                    {p.name}
                    {p.planB ? <span className="ml-2 rounded-full bg-plum px-2 py-0.5 text-xs text-white">plán B</span> : null}
                  </span>
                  <span className="block text-sm text-ink-soft">{[p.place, p.address].filter(Boolean).join(", ")}</span>
                </span>
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([p.place, p.address].filter(Boolean).join(", "))}`}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`Navigovat: ${p.name}`}
                  className="grid size-10 shrink-0 place-items-center rounded-full bg-paper text-eucalyptus-deep hover:bg-eucalyptus-mist"
                >
                  <Icon n="pin" className="size-4" />
                </a>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {vendors.length ? (
        <section className="flex flex-col gap-2">
          <h2 className="font-serif text-2xl">Dodavatelé</h2>
          <ul className="flex flex-col divide-y divide-line/70 overflow-hidden rounded-2xl bg-surface shadow-card ring-1 ring-line/70">
            {vendors.map((v) => (
              <li key={v.id} className="flex items-center gap-3 px-4 py-3">
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">{v.name}</span>
                  <span className="block text-sm text-ink-soft">{[v.category, v.person].filter(Boolean).join(" · ")}</span>
                </span>
                {v.email ? (
                  <a href={`mailto:${v.email}`} aria-label={`E-mail: ${v.name}`} className="grid size-10 place-items-center rounded-full bg-paper text-ink-soft hover:text-ink">
                    <Icon n="mail" className="size-4" />
                  </a>
                ) : null}
                {v.phone ? (
                  <a href={`tel:${v.phone.replace(/\s/g, "")}`} aria-label={`Zavolat: ${v.name}`} className="grid size-10 place-items-center rounded-full bg-eucalyptus text-white">
                    <Icon n="phone" className="size-4" />
                  </a>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
