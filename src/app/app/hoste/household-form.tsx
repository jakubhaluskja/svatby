"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Button, FormMessage } from "@/components/ui";
import { saveHousehold, type HouseholdInput } from "./actions";

type Category = { id: string; label: string; is_adult: boolean };
type EventOption = { id: string; name: string; when: string | null };

type GuestDraft = HouseholdInput["guests"][number] & { key: string };

const inputCls =
  "h-10 w-full rounded-lg border border-line bg-surface px-3 text-[15px] focus:border-eucalyptus focus:outline-none";

let counter = 0;
const newKey = () => `g${++counter}`;

export function HouseholdForm({
  initial,
  categories,
  events,
  knownTags,
}: {
  initial: HouseholdInput;
  categories: Category[];
  events: EventOption[];
  knownTags: string[];
}) {
  const adult = categories.find((c) => c.is_adult)?.id ?? null;
  const [name, setName] = useState(initial.name);
  const [nameTouched, setNameTouched] = useState(!!initial.id);
  const [locale, setLocale] = useState(initial.locale);
  const [email, setEmail] = useState(initial.email);
  const [plusOnes, setPlusOnes] = useState(initial.plus_ones_allowed);
  const [notes, setNotes] = useState(initial.notes);
  const [eventIds, setEventIds] = useState<string[]>(initial.event_ids);
  const [guests, setGuests] = useState<GuestDraft[]>(() =>
    (initial.guests.length ? initial.guests : [emptyGuest(adult)]).map((g) => ({ ...g, key: newKey() })),
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function emptyGuest(category: string | null): HouseholdInput["guests"][number] {
    return { id: null, first_name: "", last_name: "", age_category_id: category, needs_high_chair: false, email: "", notes: "", tags: [] };
  }

  function update(key: string, patch: Partial<GuestDraft>) {
    const next = guests.map((g) => (g.key === key ? { ...g, ...patch } : g));
    setGuests(next);
    // Název domácnosti se navrhne z příjmení prvního hosta, dokud ho pár nepřepíše.
    if (!nameTouched) {
      const first = next[0];
      setName(
        next.length > 1 && first.last_name
          ? familyName(first.last_name)
          : [first.first_name, first.last_name].filter(Boolean).join(" "),
      );
    }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    start(async () => {
      const result = await saveHousehold({
        id: initial.id,
        name,
        locale,
        email,
        plus_ones_allowed: plusOnes,
        notes,
        event_ids: eventIds,
        guests: guests.map(stripKey),
      });
      if (result?.error) setError(result.error);
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-10">
      <section className="flex flex-col gap-4">
        <h2 className="font-display text-xl font-semibold tracking-tight">Kdo patří do domácnosti</h2>
        <ul className="flex flex-col gap-3">
          {guests.map((g, i) => (
            <li key={g.key} className="grid grid-cols-2 gap-2 rounded-xl border border-line bg-surface p-3 sm:grid-cols-[1fr_1fr_11rem_auto]">
              <input aria-label={`Jméno, host ${i + 1}`} placeholder="Jméno" className={inputCls} value={g.first_name} maxLength={60} onChange={(e) => update(g.key, { first_name: e.target.value })} autoFocus={i === 0 && !initial.id} />
              <input aria-label={`Příjmení, host ${i + 1}`} placeholder="Příjmení" className={inputCls} value={g.last_name} maxLength={60} onChange={(e) => update(g.key, { last_name: e.target.value })} />
              <select aria-label={`Věková kategorie, host ${i + 1}`} className={inputCls} value={g.age_category_id ?? ""} onChange={(e) => update(g.key, { age_category_id: e.target.value || null })}>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.label}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setGuests((list) => list.filter((x) => x.key !== g.key))}
                disabled={guests.length === 1}
                className="h-10 rounded-lg px-3 text-sm text-ink-soft hover:bg-paper hover:text-danger disabled:invisible"
              >
                Odebrat
              </button>
              <details className="col-span-2 sm:col-span-4">
                <summary className="cursor-pointer text-sm text-ink-soft hover:text-ink">
                  Další údaje{g.tags.length ? `, štítky: ${g.tags.join(", ")}` : ""}
                </summary>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <label className="flex flex-col gap-1 text-sm">
                    Štítky
                    <input
                      className={inputCls}
                      list="known-tags"
                      placeholder="Rodina nevěsty, Kolegové"
                      defaultValue={g.tags.join(", ")}
                      onBlur={(e) => update(g.key, { tags: e.target.value.split(",").map((t) => t.trim()).filter(Boolean) })}
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-sm">
                    E-mail hosta
                    <input type="email" className={inputCls} value={g.email} maxLength={120} onChange={(e) => update(g.key, { email: e.target.value })} />
                  </label>
                  <label className="flex flex-col gap-1 text-sm sm:col-span-2">
                    Poznámka
                    <input className={inputCls} value={g.notes} maxLength={500} onChange={(e) => update(g.key, { notes: e.target.value })} />
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={g.needs_high_chair} onChange={(e) => update(g.key, { needs_high_chair: e.target.checked })} className="size-4 accent-eucalyptus" />
                    Potřebuje dětskou židličku
                  </label>
                </div>
              </details>
            </li>
          ))}
        </ul>
        <datalist id="known-tags">
          {knownTags.map((t) => (
            <option key={t} value={t} />
          ))}
        </datalist>
        <button
          type="button"
          onClick={() => setGuests((list) => [...list, { ...emptyGuest(adult), last_name: list[0]?.last_name ?? "", key: newKey() }])}
          className="self-start rounded-full border border-dashed border-ink-soft/40 px-4 py-2 text-sm hover:border-eucalyptus hover:text-eucalyptus-deep"
        >
          Přidat dalšího člena
        </button>
      </section>

      <section className="grid gap-5 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Název domácnosti
          <input className={inputCls} value={name} maxLength={80} required onChange={(e) => { setNameTouched(true); setName(e.target.value); }} />
          <span className="font-normal text-ink-soft">Uvidíte ho v seznamu a hosté v pozdravu na webu.</span>
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          E-mail pro pozvánku
          <input type="email" className={inputCls} value={email} maxLength={120} onChange={(e) => setEmail(e.target.value)} />
          <span className="font-normal text-ink-soft">Nepovinné. Hosté ho můžou doplnit i sami při odpovědi.</span>
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Kolik doprovodů smí přivést
          <select className={inputCls} value={plusOnes} onChange={(e) => setPlusOnes(Number(e.target.value))}>
            {[0, 1, 2, 3].map((n) => (
              <option key={n} value={n}>{n === 0 ? "Žádný" : n}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Jazyk webu a e-mailů
          <select className={inputCls} value={locale} onChange={(e) => setLocale(e.target.value as "cs" | "en")}>
            <option value="cs">Čeština</option>
            <option value="en">Angličtina</option>
          </select>
        </label>
      </section>

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-1 font-display text-xl font-semibold tracking-tight">Na co je pozvaná</legend>
        {events.length === 0 ? (
          <p className="text-sm text-ink-soft">
            Zatím nemáte žádné události. <Link href="/app/udalosti/nova" className="underline">Přidejte je</Link>, ať hosté můžou potvrdit účast.
          </p>
        ) : (
          events.map((ev) => (
            <label key={ev.id} className="flex items-start gap-2.5">
              <input
                type="checkbox"
                checked={eventIds.includes(ev.id)}
                onChange={(e) => setEventIds((ids) => (e.target.checked ? [...ids, ev.id] : ids.filter((x) => x !== ev.id)))}
                className="mt-1 size-4 accent-eucalyptus"
              />
              <span>
                {ev.name}
                {ev.when ? <span className="block text-sm text-ink-soft">{ev.when}</span> : null}
              </span>
            </label>
          ))
        )}
      </fieldset>

      <label className="flex flex-col gap-1.5 text-sm font-medium">
        Poznámka pro vás
        <textarea rows={2} maxLength={1000} value={notes} onChange={(e) => setNotes(e.target.value)} className="rounded-lg border border-line bg-surface px-3 py-2 text-[15px] font-normal focus:border-eucalyptus focus:outline-none" />
      </label>

      {error ? <FormMessage>{error}</FormMessage> : null}

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Ukládám…" : initial.id ? "Uložit změny" : "Přidat domácnost"}
        </Button>
        <Link href={initial.id ? `/app/hoste/${initial.id}` : "/app/hoste"} className="px-4 text-ink-soft hover:text-ink">
          Zrušit
        </Link>
      </div>
    </form>
  );
}

function stripKey(g: GuestDraft): HouseholdInput["guests"][number] {
  const { id, first_name, last_name, age_category_id, needs_high_chair, email, notes, tags } = g;
  return { id, first_name, last_name, age_category_id, needs_high_chair, email, notes, tags };
}

/** „Novák“ → „Novákovi“, „Nováková“ → „Novákovi“. Jednoduchý odhad, pár ho může přepsat. */
function familyName(lastName: string): string {
  const n = lastName.trim();
  if (/ová$/i.test(n)) return n.replace(/ová$/i, "ovi");
  if (/ý$/i.test(n)) return n.replace(/ý$/i, "ých");
  if (/á$/i.test(n)) return n.replace(/á$/i, "ých");
  if (/a$/i.test(n)) return n.replace(/a$/i, "ovi");
  if (/[eiouyéíóúůě]$/i.test(n)) return n;
  return `${n}ovi`;
}
