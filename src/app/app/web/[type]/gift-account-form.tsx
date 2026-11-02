"use client";

import { useActionState } from "react";
import { Button, FormMessage } from "@/components/ui";
import { saveGiftAccount, type GiftAccountState } from "../actions";

export function GiftAccountForm({ account, holder, iban }: { account: string; holder: string; iban: string | null }) {
  const [state, action, pending] = useActionState<GiftAccountState, FormData>(saveGiftAccount, {});
  const inputCls = "h-11 rounded-lg border border-line bg-surface px-3.5 text-[15px] font-normal focus:border-eucalyptus focus:outline-none";
  return (
    <form action={action} className="flex flex-col gap-5 rounded-2xl border border-line bg-surface p-5">
      <div className="flex flex-col gap-1">
        <h2 className="font-medium">Účet pro dary</h2>
        <p className="text-sm text-ink-soft">Z čísla účtu vytvoříme QR platbu. Hosté ho naskenují v bankovní aplikaci a částku zvolí sami.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Číslo účtu nebo IBAN
          <input name="account" defaultValue={account} placeholder="123456789/0800" className={inputCls} maxLength={40} />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Majitel účtu
          <input name="holder" defaultValue={holder} placeholder="Jana Nováková" className={inputCls} maxLength={80} />
        </label>
      </div>
      {iban ? <p className="text-sm text-ink-soft">IBAN pro QR platbu: <span className="font-mono">{iban}</span></p> : null}
      {state.error ? <FormMessage>{state.error}</FormMessage> : null}
      {state.ok ? <FormMessage tone="info">Účet je uložený.</FormMessage> : null}
      <Button type="submit" disabled={pending} className="self-start">
        {pending ? "Ukládám…" : "Uložit účet"}
      </Button>
    </form>
  );
}
