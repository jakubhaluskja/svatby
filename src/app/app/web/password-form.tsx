"use client";

import { useActionState, useState } from "react";
import { Button, FormMessage } from "@/components/ui";
import { savePassword, type PasswordState } from "./actions";

const SECTIONS: [string, string][] = [
  ["location", "Jak se k nám dostanete"],
  ["accommodation", "Ubytování"],
  ["story", "Náš příběh"],
  ["gifts", "Dary"],
  ["contacts", "Kontakty"],
  ["faq", "Časté dotazy"],
  ["dresscode", "Dress code"],
];

export function PasswordForm({ scope, protectedSections, hasPassword, canEdit }: { scope: string; protectedSections: string[]; hasPassword: boolean; canEdit: boolean }) {
  const [state, action, pending] = useActionState<PasswordState, FormData>(savePassword, {});
  const [current, setCurrent] = useState(scope);
  const field = "h-11 rounded-lg border border-line bg-surface px-3.5 text-[15px] focus:border-eucalyptus focus:outline-none";
  return (
    <form action={action} className="flex flex-col gap-5">
      <fieldset disabled={!canEdit} className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          {[
            ["none", "Bez hesla", "Web uvidí každý, kdo zná adresu. Vyhledávače ho nezobrazí."],
            ["site", "Heslo na celý web", "Bez hesla host uvidí jen pole pro jeho zadání."],
            ["sections", "Heslo jen na vybrané sekce", "Třeba adresu a ubytování. Zbytek webu je vidět."],
          ].map(([value, label, hint]) => (
            <label key={value} className="flex items-start gap-2.5">
              <input type="radio" name="scope" value={value} checked={current === value} onChange={() => setCurrent(value)} className="mt-1 accent-eucalyptus" />
              <span>
                {label}
                <span className="block text-sm text-ink-soft">{hint}</span>
              </span>
            </label>
          ))}
        </div>

        {current === "sections" ? (
          <fieldset className="grid gap-2 sm:grid-cols-2">
            <legend className="mb-2 text-sm font-medium">Chráněné sekce</legend>
            {SECTIONS.map(([value, label]) => (
              <label key={value} className="flex items-center gap-2.5">
                <input type="checkbox" name="sections" value={value} defaultChecked={protectedSections.length ? protectedSections.includes(value) : ["location", "accommodation"].includes(value)} className="size-4 accent-eucalyptus" />
                {label}
              </label>
            ))}
          </fieldset>
        ) : null}

        {current !== "none" ? (
          <label className="flex max-w-sm flex-col gap-1.5 text-sm font-medium">
            {hasPassword ? "Nové heslo (nechte prázdné, pokud ho neměníte)" : "Heslo"}
            <input name="password" type="text" autoComplete="off" minLength={4} maxLength={60} className={`${field} font-normal`} />
            <span className="font-normal text-ink-soft">Napište ho na pozvánku. Hosté s osobním odkazem ho zadávat nemusí.</span>
          </label>
        ) : null}
      </fieldset>

      {state.error ? <FormMessage>{state.error}</FormMessage> : null}
      {state.ok ? <FormMessage tone="info">{state.ok}</FormMessage> : null}
      {canEdit ? (
        <Button type="submit" disabled={pending} className="self-start">
          {pending ? "Ukládám…" : "Uložit"}
        </Button>
      ) : null}
    </form>
  );
}
