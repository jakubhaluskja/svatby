"use client";

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";
import { Button, FormMessage } from "@/components/ui";
import { parseGuestImport } from "@/lib/guest-import";
import { importGuests, type ImportState } from "../actions";

const EXAMPLE = "Novákovi\tJan\tNovák\tdospělý\tjan@novak.cz\n\tEva\tNováková\n\tTonda\tNovák\t4–12\nBabička\tMarie\tSvobodová";

export function ImportForm({ events }: { events: { id: string; name: string }[] }) {
  const [state, action, pending] = useActionState<ImportState, FormData>(importGuests, {});
  const [text, setText] = useState("");
  const preview = useMemo(() => (text.trim() ? parseGuestImport(text) : null), [text]);

  if (state.created) {
    return (
      <div className="flex flex-col items-start gap-4">
        <FormMessage tone="info">
          Vloženo {state.created} domácností a {state.guests} hostů.
          {state.skipped?.length ? ` Přeskočené řádky bez jména: ${state.skipped.join(", ")}.` : ""}
        </FormMessage>
        <Link href="/app/hoste" className="font-medium underline">Zobrazit hosty</Link>
      </div>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <label htmlFor="data" className="text-sm font-medium">Řádky z tabulky</label>
        <textarea
          id="data"
          name="data"
          rows={10}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={EXAMPLE}
          spellCheck={false}
          className="rounded-lg border border-line bg-surface px-3.5 py-3 font-mono text-sm focus:border-eucalyptus focus:outline-none"
        />
        <p className="text-sm text-ink-soft">
          Sloupce: domácnost, jméno, příjmení, kategorie (nepovinné), e-mail (nepovinné). Prázdná buňka domácnosti znamená
          stejnou domácnost jako na řádku nad ní.
        </p>
      </div>

      {preview ? (
        <p className="text-sm" aria-live="polite">
          Rozpoznáno {preview.households.length} domácností a {preview.households.reduce((n, h) => n + h.guests.length, 0)} hostů
          {preview.households.length > 0 ? `: ${preview.households.slice(0, 4).map((h) => h.name).join(", ")}${preview.households.length > 4 ? "…" : ""}` : ""}
          .
        </p>
      ) : null}

      {events.length > 0 ? (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-medium">Pozvat všechny na</legend>
          {events.map((e) => (
            <label key={e.id} className="flex items-center gap-2.5">
              <input type="checkbox" name="event_ids" value={e.id} defaultChecked className="size-4 accent-eucalyptus" />
              {e.name}
            </label>
          ))}
          <p className="text-sm text-ink-soft">U jednotlivých domácností to pak můžete změnit.</p>
        </fieldset>
      ) : null}

      {state.error ? <FormMessage>{state.error}</FormMessage> : null}

      <Button type="submit" disabled={pending || !preview?.households.length} className="self-start">
        {pending ? "Vkládám…" : "Vložit hosty"}
      </Button>
    </form>
  );
}
