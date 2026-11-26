"use client";

import { useState, useTransition } from "react";
import { Icon } from "@/components/icons";
import { FormMessage } from "@/components/ui";
import { deleteVenue, rateVenue, saveVenue, setVenueStatus, type Result } from "./actions";

type Status = "considering" | "visited" | "booked" | "rejected";
export type Venue = {
  id: string;
  name: string;
  location: string | null;
  url: string | null;
  contact: string | null;
  price: number | null;
  price_note: string | null;
  capacity: number | null;
  dates: string | null;
  pros: string | null;
  cons: string | null;
  notes: string | null;
  rating: number | null;
  status: Status;
  visit_at: string | null;
};

const STATUS: Record<Status, { label: string; cls: string }> = {
  considering: { label: "Zvažujeme", cls: "bg-paper text-ink-soft" },
  visited: { label: "Navštíveno", cls: "bg-eucalyptus-mist text-eucalyptus-deep" },
  booked: { label: "Zarezervováno", cls: "bg-eucalyptus text-white" },
  rejected: { label: "Vyřazeno", cls: "bg-danger/10 text-danger" },
};
const czk = (n: number) => new Intl.NumberFormat("cs-CZ", { style: "currency", currency: "CZK", maximumFractionDigits: 0 }).format(n);
const dt = new Intl.DateTimeFormat("cs-CZ", { day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Prague" });
const field = "h-10 w-full rounded-lg border border-line bg-surface px-3 text-[15px] focus:border-eucalyptus focus:outline-none";

function toLocalInput(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const p = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Prague", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(d);
  return p.replace(" ", "T");
}

function Stars({ value, onChange }: { value: number | null; onChange?: (v: number | null) => void }) {
  return (
    <span className="flex gap-0.5" aria-label={value ? `Hodnocení ${value} z 5` : "Bez hodnocení"}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={!onChange}
          onClick={() => onChange?.(value === n ? null : n)}
          className={`text-lg leading-none ${value && n <= value ? "text-plum" : "text-line"} ${onChange ? "hover:scale-110" : ""}`}
          aria-label={`${n} z 5`}
        >
          ★
        </button>
      ))}
    </span>
  );
}

function Editor({ v, onClose }: { v: Venue | null; onClose: () => void }) {
  const [f, setF] = useState({
    name: v?.name ?? "",
    location: v?.location ?? "",
    url: v?.url ?? "",
    contact: v?.contact ?? "",
    price: v?.price ? String(v.price) : "",
    price_note: v?.price_note ?? "",
    capacity: v?.capacity ? String(v.capacity) : "",
    dates: v?.dates ?? "",
    pros: v?.pros ?? "",
    cons: v?.cons ?? "",
    notes: v?.notes ?? "",
    visit_at: toLocalInput(v?.visit_at ?? null),
  });
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true">
      <button type="button" aria-label="Zavřít" onClick={onClose} className="absolute inset-0 bg-ink/30" />
      <form
        className="relative flex h-full w-full max-w-lg flex-col overflow-y-auto bg-surface shadow-pop"
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            const r = await saveVenue(v?.id ?? null, { ...f, rating: v?.rating ?? null, status: v?.status ?? "considering" });
            if (r.ok) onClose();
            else setError(r.error ?? null);
          });
        }}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-surface px-6 py-4">
          <h2 className="font-serif text-2xl">{v ? "Upravit místo" : "Nové místo"}</h2>
          <button type="button" onClick={onClose} aria-label="Zavřít" className="grid size-9 place-items-center rounded-full hover:bg-paper">
            <Icon n="close" />
          </button>
        </div>
        <div className="grid gap-4 px-6 py-5 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm font-medium sm:col-span-2">
            Název
            <input required autoFocus value={f.name} onChange={set("name")} maxLength={120} className={field} placeholder="Např. Statek Bujnošov" />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium">
            Kde
            <input value={f.location} onChange={set("location")} maxLength={200} className={field} placeholder="Obec, kraj" />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium">
            Web
            <input value={f.url} onChange={set("url")} maxLength={300} className={field} placeholder="https://" />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium">
            Cena (Kč)
            <input inputMode="decimal" value={f.price} onChange={set("price")} className={field} />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium">
            Kapacita (hostů)
            <input inputMode="numeric" value={f.capacity} onChange={set("capacity")} className={field} />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium sm:col-span-2">
            Co cena zahrnuje
            <input value={f.price_note} onChange={set("price_note")} maxLength={200} className={field} placeholder="Např. pronájem na 2 dny, bez cateringu" />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium sm:col-span-2">
            Volné termíny
            <input value={f.dates} onChange={set("dates")} maxLength={300} className={field} placeholder="Např. 12. 6., 19. 6., září" />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium">
            Kontakt
            <input value={f.contact} onChange={set("contact")} maxLength={200} className={field} placeholder="Jméno, telefon" />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium">
            Prohlídka
            <input type="datetime-local" value={f.visit_at} onChange={set("visit_at")} className={field} />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium">
            Plusy
            <textarea value={f.pros} onChange={set("pros")} rows={3} maxLength={1000} className={`${field} h-auto py-2`} />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium">
            Minusy
            <textarea value={f.cons} onChange={set("cons")} rows={3} maxLength={1000} className={`${field} h-auto py-2`} />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium sm:col-span-2">
            Poznámky
            <textarea value={f.notes} onChange={set("notes")} rows={3} maxLength={2000} className={`${field} h-auto py-2`} />
          </label>
          {error ? (
            <div className="sm:col-span-2">
              <FormMessage>{error}</FormMessage>
            </div>
          ) : null}
        </div>
        <div className="sticky bottom-0 mt-auto flex gap-3 border-t border-line bg-surface px-6 py-4">
          <button type="submit" disabled={pending} className="h-10 rounded-full bg-eucalyptus px-5 text-sm font-medium text-white hover:bg-eucalyptus-deep disabled:opacity-50">
            {pending ? "Ukládám…" : "Uložit"}
          </button>
          <button type="button" onClick={onClose} className="h-10 px-3 text-sm text-ink-soft hover:text-ink">
            Zrušit
          </button>
        </div>
      </form>
    </div>
  );
}

export function VenuesView({ venues, canEdit, guestCount }: { venues: Venue[]; canEdit: boolean; guestCount: number }) {
  const [editing, setEditing] = useState<Venue | "new" | null>(null);
  const [mode, setMode] = useState<"cards" | "table">("cards");
  const [hideRejected, setHideRejected] = useState(true);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const run = (fn: () => Promise<Result>) =>
    start(async () => {
      const r = await fn();
      setError(r.error ?? null);
    });
  const shown = venues.filter((v) => !hideRejected || v.status !== "rejected");
  const prices = shown.map((v) => v.price).filter((p): p is number => p !== null);
  const cheapest = prices.length ? Math.min(...prices) : null;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-3">
        {canEdit ? (
          <button type="button" onClick={() => setEditing("new")} className="inline-flex h-10 items-center gap-2 rounded-full bg-eucalyptus px-5 text-sm font-medium text-white hover:bg-eucalyptus-deep">
            <Icon n="plus" className="size-4" />
            Přidat místo
          </button>
        ) : null}
        {venues.length > 1 ? (
          <div className="flex gap-1 rounded-full bg-surface p-1 text-sm ring-1 ring-line/70">
            {(
              [
                ["cards", "Karty"],
                ["table", "Porovnání"],
              ] as const
            ).map(([k, l]) => (
              <button key={k} type="button" onClick={() => setMode(k)} className={`rounded-full px-3.5 py-1 ${mode === k ? "bg-ink text-white" : "text-ink-soft"}`}>
                {l}
              </button>
            ))}
          </div>
        ) : null}
        {venues.some((v) => v.status === "rejected") ? (
          <label className="ml-auto flex items-center gap-2 text-sm text-ink-soft">
            <input type="checkbox" checked={hideRejected} onChange={(e) => setHideRejected(e.target.checked)} className="size-4 accent-eucalyptus" />
            Skrýt vyřazená
          </label>
        ) : null}
      </div>
      {error ? <FormMessage>{error}</FormMessage> : null}

      {!venues.length ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-line px-6 py-14 text-center text-ink-soft">
          <Icon n="pin" className="size-8" />
          <p className="max-w-md">Zatím tu nic není. Přidejte první místo, které zvažujete – stačí název, zbytek doplníte po prohlídce.</p>
        </div>
      ) : mode === "cards" ? (
        <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {shown.map((v) => (
            <li key={v.id} className={`flex flex-col gap-3 rounded-2xl bg-surface p-5 shadow-card ring-1 ${v.status === "booked" ? "ring-2 ring-eucalyptus" : "ring-line/70"}`}>
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-serif text-xl leading-tight">{v.name}</p>
                  <p className="text-sm text-ink-soft">{v.location ?? " "}</p>
                </div>
                <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS[v.status].cls}`}>{STATUS[v.status].label}</span>
              </div>
              <Stars value={v.rating} onChange={canEdit ? (r) => run(() => rateVenue(v.id, r)) : undefined} />
              <dl className="grid grid-cols-2 gap-y-1 text-sm">
                <dt className="text-ink-soft">Cena</dt>
                <dd className={`text-right tabular-nums ${v.price !== null && v.price === cheapest && prices.length > 1 ? "font-medium text-eucalyptus-deep" : ""}`}>{v.price !== null ? czk(v.price) : "–"}</dd>
                <dt className="text-ink-soft">Kapacita</dt>
                <dd className={`text-right tabular-nums ${v.capacity !== null && guestCount > v.capacity ? "text-danger" : ""}`}>
                  {v.capacity ?? "–"}
                  {v.capacity !== null && guestCount > v.capacity ? ` (máte ${guestCount})` : ""}
                </dd>
                {v.visit_at ? (
                  <>
                    <dt className="text-ink-soft">Prohlídka</dt>
                    <dd className="text-right">{dt.format(new Date(v.visit_at))}</dd>
                  </>
                ) : null}
              </dl>
              {v.price_note ? <p className="text-sm text-ink-soft">{v.price_note}</p> : null}
              {v.dates ? <p className="text-sm"><span className="text-ink-soft">Termíny:</span> {v.dates}</p> : null}
              {v.pros ? <p className="whitespace-pre-line text-sm"><span className="font-medium text-eucalyptus-deep">+ </span>{v.pros}</p> : null}
              {v.cons ? <p className="whitespace-pre-line text-sm"><span className="font-medium text-danger">− </span>{v.cons}</p> : null}
              <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-line pt-3 text-sm">
                {v.url ? (
                  <a href={v.url} target="_blank" rel="noreferrer" className="text-eucalyptus-deep hover:underline">
                    Web
                  </a>
                ) : null}
                {canEdit ? (
                  <>
                    <select
                      value={v.status}
                      disabled={pending}
                      onChange={(e) => run(() => setVenueStatus(v.id, e.target.value as Status))}
                      className="h-8 rounded-full border border-line bg-surface px-2"
                      aria-label="Stav"
                    >
                      {(Object.keys(STATUS) as Status[]).map((s) => (
                        <option key={s} value={s}>
                          {STATUS[s].label}
                        </option>
                      ))}
                    </select>
                    <button type="button" onClick={() => setEditing(v)} className="ml-auto text-eucalyptus-deep hover:underline">
                      Upravit
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (window.confirm(`Smazat ${v.name}?`)) run(() => deleteVenue(v.id));
                      }}
                      className="text-ink-soft hover:text-danger"
                    >
                      Smazat
                    </button>
                  </>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <div className="overflow-x-auto rounded-2xl bg-surface shadow-card ring-1 ring-line/70">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-line">
                <th className="w-36 px-4 py-3 font-normal text-ink-soft" />
                {shown.map((v) => (
                  <th key={v.id} className={`px-4 py-3 align-bottom ${v.status === "booked" ? "bg-eucalyptus-mist" : ""}`}>
                    <span className="block font-serif text-lg font-normal leading-tight">{v.name}</span>
                    <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs ${STATUS[v.status].cls}`}>{STATUS[v.status].label}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line/70 align-top">
              {(
                [
                  ["Hodnocení", (v: Venue) => <Stars value={v.rating} />],
                  ["Cena", (v: Venue) => (v.price !== null ? <span className={v.price === cheapest ? "font-medium text-eucalyptus-deep" : ""}>{czk(v.price)}</span> : "–")],
                  ["Zahrnuje", (v: Venue) => v.price_note ?? "–"],
                  ["Kapacita", (v: Venue) => (v.capacity !== null ? <span className={guestCount > v.capacity ? "text-danger" : ""}>{v.capacity}</span> : "–")],
                  ["Kde", (v: Venue) => v.location ?? "–"],
                  ["Termíny", (v: Venue) => v.dates ?? "–"],
                  ["Plusy", (v: Venue) => <span className="whitespace-pre-line">{v.pros ?? "–"}</span>],
                  ["Minusy", (v: Venue) => <span className="whitespace-pre-line">{v.cons ?? "–"}</span>],
                  ["Kontakt", (v: Venue) => v.contact ?? "–"],
                ] as const
              ).map(([label, render]) => (
                <tr key={label}>
                  <th className="px-4 py-3 font-normal text-ink-soft">{label}</th>
                  {shown.map((v) => (
                    <td key={v.id} className={`px-4 py-3 ${v.status === "booked" ? "bg-eucalyptus-mist/50" : ""}`}>
                      {render(v)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing ? <Editor v={editing === "new" ? null : editing} onClose={() => setEditing(null)} /> : null}
    </div>
  );
}
