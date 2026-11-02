"use client";

import { useActionState, useEffect } from "react";
import { FormMessage } from "@/components/ui";
import type { Lodging, Room } from "@/lib/lodging-data";
import { saveLodging, saveRoom, type FormState } from "./actions";

const field = "h-10 rounded-lg border border-line bg-surface px-3 text-[15px] font-normal focus:border-eucalyptus focus:outline-none";
const label = "flex flex-col gap-1 text-sm font-medium";

export function LodgingForm({ lodging, onDone }: { lodging: Lodging | null; onDone: () => void }) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveLodging.bind(null, lodging?.id ?? null), {});
  useEffect(() => {
    if (state.ok) onDone();
  }, [state, onDone]);
  return (
    <form action={action} className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className={label}>
          Název
          <input name="name" required maxLength={100} defaultValue={lodging?.name} placeholder="Například Penzion U Lípy" className={field} autoFocus />
        </label>
        <label className={label}>
          Adresa
          <input name="address" maxLength={200} defaultValue={lodging?.address ?? ""} className={field} />
        </label>
        <label className={`${label} sm:col-span-2`}>
          Web ubytování
          <input name="url" type="url" maxLength={300} defaultValue={lodging?.url ?? ""} placeholder="https://" className={field} />
        </label>
        <label className={label}>
          Informace pro hosty
          <textarea name="check_in_cs" rows={3} maxLength={1000} defaultValue={lodging?.check_in_info.cs} placeholder="Check-in od 14:00, klíče na recepci." className={`${field} h-auto py-2`} />
        </label>
        <label className={label}>
          Informace anglicky
          <textarea name="check_in_en" rows={3} maxLength={1000} defaultValue={lodging?.check_in_info.en} className={`${field} h-auto py-2`} />
        </label>
      </div>
      {state.error ? <FormMessage>{state.error}</FormMessage> : null}
      <div className="flex gap-3">
        <button type="submit" disabled={pending} className="h-10 rounded-full bg-eucalyptus px-5 text-sm font-medium text-white hover:bg-eucalyptus-deep disabled:opacity-50">
          {pending ? "Ukládám…" : "Uložit ubytování"}
        </button>
        <button type="button" onClick={onDone} className="px-3 text-sm text-ink-soft hover:text-ink">Zrušit</button>
      </div>
    </form>
  );
}

export function RoomForm({ lodgingId, room, onDone }: { lodgingId: string; room: Room | null; onDone: () => void }) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveRoom.bind(null, lodgingId, room?.id ?? null), {});
  useEffect(() => {
    if (state.ok) onDone();
  }, [state, onDone]);
  return (
    <form action={action} className="flex flex-col gap-3 rounded-xl border border-eucalyptus bg-surface p-4">
      <div className="grid grid-cols-2 gap-3">
        <label className={`${label} col-span-2`}>
          Pokoj
          <input name="name" required maxLength={60} defaultValue={room?.name} placeholder="Například Pokoj 2" className={field} autoFocus />
        </label>
        <label className={label}>
          Lůžek
          <input name="capacity" type="number" min={1} max={50} required defaultValue={room?.capacity ?? 2} className={field} />
        </label>
        <label className={label}>
          Cena za noc
          <span className="flex gap-1">
            <input name="price" inputMode="decimal" defaultValue={room?.price ?? ""} className={`${field} min-w-0 flex-1`} />
            <select name="currency" defaultValue={room?.currency ?? "CZK"} className={`${field} w-20`}>
              <option>CZK</option>
              <option>EUR</option>
            </select>
          </span>
        </label>
        <label className={`${label} col-span-2`}>
          Kdo platí
          <select name="paid_by" defaultValue={room?.paid_by ?? "guest"} className={field}>
            <option value="guest">Hosté sami</option>
            <option value="couple">Platíme my</option>
          </select>
        </label>
        <label className={`${label} col-span-2`}>
          Poznámka
          <input name="notes" maxLength={300} defaultValue={room?.notes ?? ""} placeholder="Například manželská postel + přistýlka" className={field} />
        </label>
      </div>
      {state.error ? <FormMessage>{state.error}</FormMessage> : null}
      <div className="flex gap-3">
        <button type="submit" disabled={pending} className="h-9 rounded-full bg-eucalyptus px-4 text-sm font-medium text-white hover:bg-eucalyptus-deep disabled:opacity-50">
          {pending ? "Ukládám…" : "Uložit pokoj"}
        </button>
        <button type="button" onClick={onDone} className="px-2 text-sm text-ink-soft hover:text-ink">Zrušit</button>
      </div>
    </form>
  );
}
