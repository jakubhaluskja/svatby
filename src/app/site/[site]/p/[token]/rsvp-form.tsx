"use client";

import { useState, useTransition } from "react";
import type { GuestHousehold } from "@/lib/site";
import type { Locale } from "@/lib/i18n";
import { siteCopy, type SiteCopy } from "@/lib/site-copy";
import { submitRsvp, type RsvpPayload } from "../../actions";

type Status = "yes" | "no";
type GuestState = { id: string; name: string; isPlusOne: boolean; first_name: string; last_name: string; diet: string; allergies: string; events: Record<string, Status | undefined> };
type PlusOne = { key: number; first_name: string; last_name: string; age_category_id: string | null; diet: string; allergies: string; events: Record<string, Status | undefined> };

const field =
  "h-11 w-full rounded-lg border bg-white/70 px-3.5 text-[15px] focus:outline-none focus:ring-2 focus:ring-[var(--site-accent)]";
const fieldStyle = { borderColor: "var(--site-line)", color: "var(--site-text)" };

export function RsvpForm({
  site,
  token,
  household,
  locale,
  disabled,
  disabledText,
}: {
  site: string;
  token: string;
  household: GuestHousehold;
  locale: Locale;
  disabled: boolean;
  disabledText: string | null;
}) {
  const copy = siteCopy(locale);
  const events = household.events.filter((e) => e.invited);
  const adult = household.categories.find((c) => c.is_adult)?.id ?? null;
  const existingPlusOnes = household.guests.filter((g) => g.is_plus_one).length;
  const remaining = Math.max(0, household.plus_ones_allowed - existingPlusOnes);

  const [guests, setGuests] = useState<GuestState[]>(() =>
    household.guests.map((g) => ({
      id: g.id,
      name: [g.first_name, g.last_name].filter(Boolean).join(" "),
      isPlusOne: g.is_plus_one,
      first_name: g.first_name,
      last_name: g.last_name ?? "",
      diet: g.diet ?? "",
      allergies: g.allergies ?? "",
      events: Object.fromEntries(
        events.map((e) => [e.id, g.responses[e.id] === "yes" || g.responses[e.id] === "no" ? (g.responses[e.id] as Status) : undefined]),
      ),
    })),
  );
  const [plusOnes, setPlusOnes] = useState<PlusOne[]>([]);
  const [lodging, setLodging] = useState<boolean | null>(household.needs_lodging);
  const [lodgingNote, setLodgingNote] = useState(household.lodging_note ?? "");
  const [song, setSong] = useState(household.song_wish ?? "");
  const [message, setMessage] = useState(household.message ?? "");
  const [email, setEmail] = useState(household.email ?? "");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, start] = useTransition();

  const anyoneComing = [...guests, ...plusOnes].some((g) => Object.values(g.events).includes("yes"));
  const answered = !!household.rsvp_submitted_at;

  function setGuest(id: string, patch: Partial<GuestState>) {
    setGuests((list) => list.map((g) => (g.id === id ? { ...g, ...patch } : g)));
    setDone(false);
  }
  function setPlus(key: number, patch: Partial<PlusOne>) {
    setPlusOnes((list) => list.map((p) => (p.key === key ? { ...p, ...patch } : p)));
    setDone(false);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const incomplete = guests.some((g) => events.some((ev) => !g.events[ev.id])) || plusOnes.some((p) => !p.first_name.trim() || events.some((ev) => !p.events[ev.id]));
    if (incomplete) {
      setError(copy.chooseAll);
      return;
    }
    const payload: RsvpPayload = {
      guests: guests.map((g) => ({
        id: g.id,
        first_name: g.first_name,
        last_name: g.last_name,
        diet: g.diet,
        allergies: g.allergies,
        events: g.events as Record<string, Status>,
      })),
      plus_ones: plusOnes.map((p) => ({
        first_name: p.first_name,
        last_name: p.last_name,
        age_category_id: p.age_category_id,
        diet: p.diet,
        allergies: p.allergies,
        events: p.events as Record<string, Status>,
      })),
      needs_lodging: lodging,
      lodging_note: lodgingNote,
      song_wish: song,
      message,
      email,
    };
    start(async () => {
      const result = await submitRsvp(site, token, payload);
      if (result.ok) {
        setDone(true);
        // Nově přidané doprovody jsou teď hosté domácnosti – načteme stránku znovu.
        if (plusOnes.length) window.location.reload();
        return;
      }
      setError(
        result.error === "closed" ? copy.closed : result.error === "plus_ones" ? copy.tooManyPlusOnes : result.error === "preview" ? disabledText ?? copy.error : copy.error,
      );
    });
  }

  if (done) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border px-6 py-10 text-center" style={{ borderColor: "var(--site-line)" }} role="status">
        <p className="text-2xl">{copy.thanks}</p>
        <p style={{ color: "var(--site-muted)" }}>{copy.thanksChange}</p>
        <button type="button" onClick={() => setDone(false)} className="mt-2 underline underline-offset-2" style={{ color: "var(--site-accent)" }}>
          {copy.update}
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-8" noValidate>
      <fieldset disabled={disabled || pending} className="flex flex-col gap-8">
        {guests.map((g) => (
          <PersonBlock
            key={g.id}
            name={g.name}
            editableName={g.isPlusOne ? { first: g.first_name, last: g.last_name, onChange: (first, last) => setGuest(g.id, { first_name: first, last_name: last }) } : null}
            events={events}
            value={g.events}
            onChoose={(eventId, s) => setGuest(g.id, { events: { ...g.events, [eventId]: s } })}
            diet={g.diet}
            allergies={g.allergies}
            onDiet={(diet) => setGuest(g.id, { diet })}
            onAllergies={(allergies) => setGuest(g.id, { allergies })}
            copy={copy}
          />
        ))}

        {plusOnes.map((p, i) => (
          <div key={p.key} className="flex flex-col gap-4 rounded-2xl border p-5" style={{ borderColor: "var(--site-line)" }}>
            <div className="flex items-center justify-between">
              <p className="font-medium">{copy.plusOneTitle} {plusOnes.length > 1 ? i + 1 : ""}</p>
              <button type="button" onClick={() => setPlusOnes((l) => l.filter((x) => x.key !== p.key))} className="text-sm underline" style={{ color: "var(--site-muted)" }}>
                {copy.plusOneRemove}
              </button>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <input aria-label={copy.firstName} placeholder={copy.firstName} value={p.first_name} onChange={(e) => setPlus(p.key, { first_name: e.target.value })} className={field} style={fieldStyle} maxLength={60} />
              <input aria-label={copy.lastName} placeholder={copy.lastName} value={p.last_name} onChange={(e) => setPlus(p.key, { last_name: e.target.value })} className={field} style={fieldStyle} maxLength={60} />
              <select aria-label={copy.ageCategory} value={p.age_category_id ?? ""} onChange={(e) => setPlus(p.key, { age_category_id: e.target.value || null })} className={field} style={fieldStyle}>
                {household.categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.label}</option>
                ))}
              </select>
            </div>
            <PersonBlock
              bare
              name={p.first_name || copy.plusOneTitle}
              editableName={null}
              events={events}
              value={p.events}
              onChoose={(eventId, s) => setPlus(p.key, { events: { ...p.events, [eventId]: s } })}
              diet={p.diet}
              allergies={p.allergies}
              onDiet={(diet) => setPlus(p.key, { diet })}
              onAllergies={(allergies) => setPlus(p.key, { allergies })}
              copy={copy}
            />
          </div>
        ))}

        {plusOnes.length < remaining ? (
          <button
            type="button"
            onClick={() => setPlusOnes((l) => [...l, { key: Date.now(), first_name: "", last_name: "", age_category_id: adult, diet: "", allergies: "", events: {} }])}
            className="self-start rounded-full border border-dashed px-5 py-2.5"
            style={{ borderColor: "var(--site-accent)", color: "var(--site-accent)" }}
          >
            {copy.plusOneAdd}
          </button>
        ) : null}

        {anyoneComing ? (
          <div className="flex flex-col gap-5">
            <p className="text-sm" style={{ color: "var(--site-muted)" }}>{copy.allergiesHint}</p>
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-2 font-medium">{copy.lodging}</legend>
              <div className="flex gap-2">
                {([true, false] as const).map((v) => (
                  <Choice key={String(v)} selected={lodging === v} onClick={() => setLodging(v)}>
                    {v ? copy.yes : copy.no}
                  </Choice>
                ))}
              </div>
            </fieldset>
            {lodging ? (
              <label className="flex flex-col gap-1.5">
                {copy.lodgingNote}
                <input value={lodgingNote} onChange={(e) => setLodgingNote(e.target.value)} className={field} style={fieldStyle} maxLength={300} />
              </label>
            ) : null}
            <label className="flex flex-col gap-1.5">
              {copy.song}
              <input value={song} onChange={(e) => setSong(e.target.value)} className={field} style={fieldStyle} maxLength={200} />
            </label>
          </div>
        ) : null}

        <label className="flex flex-col gap-1.5">
          {copy.message}
          <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={3} maxLength={2000} className={`${field} h-auto py-2.5`} style={fieldStyle} />
        </label>

        <label className="flex flex-col gap-1.5">
          {copy.email}
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={field} style={fieldStyle} maxLength={120} autoComplete="email" />
          <span className="text-sm" style={{ color: "var(--site-muted)" }}>{copy.emailHint}</span>
        </label>
      </fieldset>

      {error ? <p role="alert" className="font-medium" style={{ color: "var(--site-accent)" }}>{error}</p> : null}
      {disabled && disabledText ? <p className="text-sm" style={{ color: "var(--site-muted)" }}>{disabledText}</p> : null}

      <button
        type="submit"
        disabled={disabled || pending}
        className="h-12 self-start rounded-full px-8 text-white transition-opacity disabled:opacity-50"
        style={{ background: "var(--site-accent)" }}
      >
        {pending ? copy.sending : answered ? copy.update : copy.submit}
      </button>
    </form>
  );
}

function Choice({ selected, onClick, children, label }: { selected: boolean; onClick: () => void; children: React.ReactNode; label?: string }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      aria-label={label}
      onClick={onClick}
      className="h-11 rounded-full border px-5 transition-colors"
      style={
        selected
          ? { background: "var(--site-accent)", borderColor: "var(--site-accent)", color: "#fff" }
          : { borderColor: "var(--site-line)", color: "var(--site-text)" }
      }
    >
      {children}
    </button>
  );
}

function PersonBlock({
  name,
  editableName,
  events,
  value,
  onChoose,
  diet,
  allergies,
  onDiet,
  onAllergies,
  copy,
  bare,
}: {
  name: string;
  editableName: { first: string; last: string; onChange: (first: string, last: string) => void } | null;
  events: { id: string; name: string }[];
  value: Record<string, Status | undefined>;
  onChoose: (eventId: string, s: Status) => void;
  diet: string;
  allergies: string;
  onDiet: (v: string) => void;
  onAllergies: (v: string) => void;
  copy: SiteCopy;
  bare?: boolean;
}) {
  const coming = Object.values(value).includes("yes");
  return (
    <div className={bare ? "flex flex-col gap-4" : "flex flex-col gap-4 border-t pt-6"} style={bare ? undefined : { borderColor: "var(--site-line)" }}>
      {!bare ? (
        editableName ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <input aria-label={copy.firstName} value={editableName.first} onChange={(e) => editableName.onChange(e.target.value, editableName.last)} className={field} style={fieldStyle} maxLength={60} />
            <input aria-label={copy.lastName} value={editableName.last} onChange={(e) => editableName.onChange(editableName.first, e.target.value)} className={field} style={fieldStyle} maxLength={60} />
          </div>
        ) : (
          <p className="text-xl font-medium">{name}</p>
        )
      ) : null}
      {events.map((ev) => (
        <div key={ev.id} role="radiogroup" aria-label={`${name}: ${ev.name}`} className="flex flex-wrap items-center gap-x-4 gap-y-2">
          {events.length > 1 ? <span className="min-w-36">{ev.name}</span> : null}
          <div className="flex gap-2">
            <Choice selected={value[ev.id] === "yes"} onClick={() => onChoose(ev.id, "yes")}>{copy.attending}</Choice>
            <Choice selected={value[ev.id] === "no"} onClick={() => onChoose(ev.id, "no")}>{copy.notAttending}</Choice>
          </div>
        </div>
      ))}
      {coming ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5 text-sm">
            {copy.diet}
            <input value={diet} onChange={(e) => onDiet(e.target.value)} placeholder={copy.dietPlaceholder} className={field} style={fieldStyle} maxLength={200} />
          </label>
          <label className="flex flex-col gap-1.5 text-sm">
            {copy.allergies}
            <input value={allergies} onChange={(e) => onAllergies(e.target.value)} className={field} style={fieldStyle} maxLength={200} />
          </label>
        </div>
      ) : null}
    </div>
  );
}
