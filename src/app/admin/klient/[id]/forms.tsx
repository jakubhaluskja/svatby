"use client";

import { useActionState, useState, useTransition } from "react";
import { Icon } from "@/components/icons";
import { FormMessage } from "@/components/ui";
import { changeOwnerEmail, impersonate, resumeWedding, suspendWedding, updateWedding, type AdminState } from "../../actions";

const field = "h-10 w-full rounded-lg border border-line bg-surface px-3 text-[15px] focus:border-eucalyptus focus:outline-none disabled:bg-paper disabled:text-ink-soft";
const label = "flex flex-col gap-1 text-sm font-medium";
const primary = "h-10 rounded-full bg-ink px-5 text-sm font-medium text-white hover:bg-ink/85 disabled:opacity-50";

type WeddingInitial = {
  partner1_name: string;
  partner2_name: string;
  slug: string;
  wedding_date: string;
  default_locale: string;
  package: string;
  status: string;
  web_expires_at: string;
  admin_note: string;
};

function Saved({ state }: { state: AdminState }) {
  if (state.error) return <FormMessage>{state.error}</FormMessage>;
  if (state.ok) return <FormMessage tone="info">Uloženo.</FormMessage>;
  return null;
}

export function WeddingForm({ id, initial, superadmin }: { id: string; initial: WeddingInitial; superadmin: boolean }) {
  const [state, action, pending] = useActionState(updateWedding.bind(null, id), {});
  return (
    <form action={action} className="mt-4 grid gap-4 sm:grid-cols-2">
      <label className={label}>
        Jméno 1
        <input name="partner1_name" defaultValue={initial.partner1_name} required className={field} />
      </label>
      <label className={label}>
        Jméno 2
        <input name="partner2_name" defaultValue={initial.partner2_name} required className={field} />
      </label>
      <label className={label}>
        Adresa webu
        <input name="slug" defaultValue={initial.slug} required className={field} />
      </label>
      <label className={label}>
        Datum svatby
        <input type="date" name="wedding_date" defaultValue={initial.wedding_date} className={field} />
      </label>
      <label className={label}>
        Výchozí jazyk webu
        <select name="default_locale" defaultValue={initial.default_locale} className={field}>
          <option value="cs">čeština</option>
          <option value="en">angličtina</option>
        </select>
      </label>
      <label className={label}>
        Stav webu
        <select name="status" defaultValue={initial.status} disabled={!superadmin} className={field}>
          <option value="draft">Koncept</option>
          <option value="published">Zveřejněno</option>
          <option value="expired">Vypršelo</option>
        </select>
      </label>
      <label className={label}>
        Balíček
        <select name="package" defaultValue={initial.package} disabled={!superadmin} className={field}>
          <option value="none">Bez balíčku</option>
          <option value="web">Web</option>
          <option value="web_gallery">Web + galerie</option>
        </select>
      </label>
      <label className={label}>
        Web platí do
        <input type="date" name="web_expires_at" defaultValue={initial.web_expires_at} disabled={!superadmin} className={field} />
      </label>
      <label className={`${label} sm:col-span-2`}>
        Interní poznámka
        <textarea name="admin_note" defaultValue={initial.admin_note} rows={3} placeholder="Vidí jen správci platformy" className={`${field} h-auto py-2`} />
      </label>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <button type="submit" disabled={pending} className={primary}>
          {pending ? "Ukládám…" : "Uložit údaje"}
        </button>
        <Saved state={state} />
      </div>
    </form>
  );
}

export function OwnerEmailForm({ id, email }: { id: string; email: string }) {
  const [state, action, pending] = useActionState(changeOwnerEmail.bind(null, id), {});
  return (
    <form action={action} className="mt-4 flex flex-col gap-3">
      <label className={label}>
        Přihlašovací e-mail
        <input type="email" name="email" defaultValue={email} required className={field} />
      </label>
      <p className="text-xs text-ink-soft">Změna platí hned, klientovi nepřijde potvrzovací e-mail.</p>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className={primary}>
          {pending ? "Ukládám…" : "Změnit e-mail"}
        </button>
        <Saved state={state} />
      </div>
    </form>
  );
}

export function SuspensionPanel({ id, suspended }: { id: string; suspended: { at: string; reason: string; note: string | null } | null }) {
  const [state, action, pending] = useActionState(suspendWedding.bind(null, id), {});
  const [resumeError, setResumeError] = useState<string | null>(null);
  const [resuming, startResume] = useTransition();

  if (suspended) {
    return (
      <div className="mt-3 flex flex-col gap-3 text-sm">
        <p className="rounded-xl bg-danger/8 px-4 py-3 text-danger">
          Pozastaveno {suspended.at} · {suspended.reason}
          {suspended.note ? <span className="mt-1 block text-ink">{suspended.note}</span> : null}
        </p>
        <p className="text-ink-soft">Web a odkazy hostů jsou nedostupné, pár data jen prohlíží.</p>
        <button
          type="button"
          disabled={resuming}
          onClick={() =>
            startResume(async () => {
              const r = await resumeWedding(id);
              setResumeError(r.error ?? null);
            })
          }
          className="h-10 rounded-full bg-eucalyptus px-5 text-sm font-medium text-white hover:bg-eucalyptus-deep disabled:opacity-50"
        >
          {resuming ? "Obnovuji…" : "Obnovit službu"}
        </button>
        {resumeError ? <FormMessage>{resumeError}</FormMessage> : null}
      </div>
    );
  }

  return (
    <form action={action} className="mt-3 flex flex-col gap-3">
      <p className="text-sm text-ink-soft">Služba běží. Pozastavení skryje web i osobní odkazy hostů a páru zakáže úpravy.</p>
      <label className={label}>
        Důvod
        <select name="reason" defaultValue="" required className={field}>
          <option value="" disabled>
            Vyberte…
          </option>
          <option value="nonpayment">Nezaplacení</option>
          <option value="violation">Porušení pravidel</option>
          <option value="other">Jiný důvod</option>
        </select>
      </label>
      <label className={label}>
        Zpráva pro klienta
        <textarea name="note" rows={2} maxLength={500} placeholder="Zobrazí se páru v aplikaci" className={`${field} h-auto py-2`} />
      </label>
      <button type="submit" disabled={pending} className="h-10 rounded-full bg-danger px-5 text-sm font-medium text-white hover:bg-danger/85 disabled:opacity-50">
        {pending ? "Pozastavuji…" : "Pozastavit službu"}
      </button>
      {state.error ? <FormMessage>{state.error}</FormMessage> : null}
    </form>
  );
}

export function ImpersonateButton({ id, disabled }: { id: string; disabled: boolean }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="flex flex-col items-end gap-2">
      <button
        type="button"
        disabled={disabled || pending}
        onClick={() =>
          start(async () => {
            const r = await impersonate(id);
            if (r?.error) setError(r.error);
          })
        }
        className="inline-flex h-10 items-center gap-2 rounded-full bg-plum px-5 text-sm font-medium text-white hover:bg-plum/85 disabled:opacity-50"
      >
        <Icon n="user" className="size-4" />
        {pending ? "Přihlašuji…" : "Přihlásit se za klienta"}
      </button>
      {error ? <FormMessage>{error}</FormMessage> : null}
    </div>
  );
}
