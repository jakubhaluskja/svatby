"use client";

import { useActionState } from "react";
import { Button, FormMessage } from "@/components/ui";
import { TEMPLATES } from "@/lib/templates";
import { saveSettings, type SettingsState } from "./actions";

export function SettingsForm({ template, english, deadline, canEdit }: { template: string; english: boolean; deadline: string; canEdit: boolean }) {
  const [state, action, pending] = useActionState<SettingsState, FormData>(saveSettings, {});
  return (
    <form action={action} className="flex flex-col gap-6">
      <fieldset disabled={!canEdit} className="flex flex-col gap-6">
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-sm font-medium">Šablona</legend>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            {TEMPLATES.map((t) => (
              <label key={t.id} className="cursor-pointer">
                <input type="radio" name="template" value={t.id} defaultChecked={t.id === template} className="peer sr-only" />
                <span
                  className="flex h-24 flex-col justify-between rounded-xl border border-line p-3 transition-colors peer-checked:border-eucalyptus peer-checked:ring-2 peer-checked:ring-eucalyptus/30 peer-focus-visible:ring-2"
                  style={{ background: t.colors.background, color: t.colors.text }}
                >
                  <span style={{ fontFamily: t.displayFont, fontStyle: t.displayStyle, fontWeight: t.displayWeight }} className="text-2xl leading-none">
                    J &amp; P
                  </span>
                  <span className="text-xs" style={{ color: t.colors.muted }}>{t.name}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <div className="grid gap-5 sm:grid-cols-2">
          <label className="flex items-start gap-2.5">
            <input type="checkbox" name="english" defaultChecked={english} className="mt-1 size-4 accent-eucalyptus" />
            <span>
              Web i v angličtině
              <span className="block text-sm text-ink-soft">U textů se objeví pole pro anglickou verzi a hosté si jazyk přepnou.</span>
            </span>
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            Uzávěrka potvrzení účasti
            <input type="date" name="rsvp_deadline" defaultValue={deadline} className="h-11 rounded-lg border border-line bg-surface px-3.5 text-[15px] font-normal focus:border-eucalyptus focus:outline-none" />
            <span className="font-normal text-ink-soft">Po tomto dni můžou odpovědi měnit už jen novomanželé.</span>
          </label>
        </div>
      </fieldset>

      {state.error ? <FormMessage>{state.error}</FormMessage> : null}
      {state.ok ? <FormMessage tone="info">Nastavení je uložené.</FormMessage> : null}
      {canEdit ? (
        <Button type="submit" disabled={pending} className="self-start">
          {pending ? "Ukládám…" : "Uložit nastavení"}
        </Button>
      ) : null}
    </form>
  );
}
