"use client";

import { useActionState, useRef, useEffect } from "react";
import { Button, FormMessage } from "@/components/ui";
import { createMessage, type MessageState } from "./actions";

export function MessageForm({ events, english, defaultUntil }: { events: { id: string; name: string }[]; english: boolean; defaultUntil: string }) {
  const [state, action, pending] = useActionState<MessageState, FormData>(createMessage, {});
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok) form.current?.reset();
  }, [state]);
  const field = "rounded-lg border border-line bg-surface px-3.5 text-[15px] font-normal focus:border-eucalyptus focus:outline-none";
  return (
    <form ref={form} action={action} className="flex flex-col gap-5 rounded-2xl border border-line bg-surface p-5">
      <div className={english ? "grid gap-4 sm:grid-cols-2" : ""}>
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Zpráva
          <textarea name="body_cs" rows={3} maxLength={500} required placeholder="Obřad začíná za 30 minut, prosíme, usaďte se." className={`${field} py-2.5`} />
        </label>
        {english ? (
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            Zpráva anglicky
            <textarea name="body_en" rows={3} maxLength={500} className={`${field} py-2.5`} />
          </label>
        ) : null}
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Komu
          <select name="audience" className={`${field} h-11`}>
            <option value="all">Všem hostům</option>
            {events.map((e) => (
              <option key={e.id} value={`event:${e.id}`}>Pozvaným na: {e.name}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Zobrazit od
          <input type="datetime-local" name="from" className={`${field} h-11`} />
          <span className="font-normal text-ink-soft">Prázdné = hned.</span>
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Zobrazit do
          <input type="datetime-local" name="until" defaultValue={defaultUntil} className={`${field} h-11`} />
        </label>
      </div>
      {state.error ? <FormMessage>{state.error}</FormMessage> : null}
      {state.ok ? <FormMessage tone="info">Zpráva je uložená. Hosté ji uvidí nahoře na webu ve zvoleném čase.</FormMessage> : null}
      <Button type="submit" disabled={pending} className="self-start">
        {pending ? "Ukládám…" : "Uložit zprávu"}
      </Button>
    </form>
  );
}
