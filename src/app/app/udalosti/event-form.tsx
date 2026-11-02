"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button, Field, FormMessage } from "@/components/ui";
import { saveEvent, type EventFormState } from "./actions";

export type EventDefaults = {
  name_cs?: string;
  name_en?: string;
  date?: string;
  start?: string;
  end?: string;
  location_name?: string;
  address?: string;
  description_cs?: string;
  description_en?: string;
  visibility?: "public" | "invited";
  is_seated?: boolean;
};

export function EventForm({ eventId, defaults, showEnglish }: { eventId: string | null; defaults: EventDefaults; showEnglish: boolean }) {
  const [state, action, pending] = useActionState<EventFormState, FormData>(saveEvent.bind(null, eventId), {});

  return (
    <form action={action} className="flex flex-col gap-8">
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Název" name="name_cs" required maxLength={80} defaultValue={defaults.name_cs} placeholder="Například Hostina" />
        {showEnglish ? <Field label="Název anglicky" name="name_en" maxLength={80} defaultValue={defaults.name_en} /> : null}
      </div>

      <div className="grid gap-5 sm:grid-cols-3">
        <Field label="Datum" name="date" type="date" defaultValue={defaults.date} />
        <Field label="Začátek" name="start" type="time" defaultValue={defaults.start} />
        <Field label="Konec" name="end" type="time" defaultValue={defaults.end} hint="Nepovinné" />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Místo" name="location_name" maxLength={120} defaultValue={defaults.location_name} placeholder="Například Statek Bukovina" />
        <Field label="Adresa" name="address" maxLength={200} defaultValue={defaults.address} hint="Podle adresy hostům ukážeme mapu." />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="description_cs" className="text-sm font-medium">Popis pro hosty</label>
        <textarea
          id="description_cs"
          name="description_cs"
          rows={3}
          maxLength={1000}
          defaultValue={defaults.description_cs}
          className="rounded-lg border border-line bg-surface px-3.5 py-2.5 text-[15px] focus:border-eucalyptus focus:outline-none"
        />
      </div>
      {showEnglish ? (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="description_en" className="text-sm font-medium">Popis anglicky</label>
          <textarea
            id="description_en"
            name="description_en"
            rows={3}
            maxLength={1000}
            defaultValue={defaults.description_en}
            className="rounded-lg border border-line bg-surface px-3.5 py-2.5 text-[15px] focus:border-eucalyptus focus:outline-none"
          />
        </div>
      ) : null}

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-1 text-sm font-medium">Kdo událost uvidí na webu</legend>
        <label className="flex items-start gap-2.5">
          <input type="radio" name="visibility" value="public" defaultChecked={defaults.visibility !== "invited"} className="mt-1 accent-eucalyptus" />
          <span>
            Všichni návštěvníci webu
            <span className="block text-sm text-ink-soft">Například obřad, na který může přijít kdokoli.</span>
          </span>
        </label>
        <label className="flex items-start gap-2.5">
          <input type="radio" name="visibility" value="invited" defaultChecked={defaults.visibility === "invited"} className="mt-1 accent-eucalyptus" />
          <span>
            Jen pozvaní hosté
            <span className="block text-sm text-ink-soft">Uvidí ji jen domácnosti, které na ni pozvete, přes svůj osobní odkaz.</span>
          </span>
        </label>
      </fieldset>

      <label className="flex items-start gap-2.5">
        <input type="checkbox" name="is_seated" defaultChecked={defaults.is_seated} className="mt-1 size-4 accent-eucalyptus" />
        <span>
          Hosté sedí u stolů
          <span className="block text-sm text-ink-soft">Pro tuto událost připravíte zasedací pořádek.</span>
        </span>
      </label>

      {state.error ? <FormMessage>{state.error}</FormMessage> : null}

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Ukládám…" : "Uložit událost"}
        </Button>
        <Link href="/app/udalosti" className="px-4 text-ink-soft hover:text-ink">
          Zrušit
        </Link>
      </div>
    </form>
  );
}
