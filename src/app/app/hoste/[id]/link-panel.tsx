"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { regenerateLink } from "../actions";

export function LinkPanel({
  householdId,
  url,
  shortCode,
  message,
  email,
  invited,
}: {
  householdId: string;
  url: string;
  shortCode: string;
  message: string;
  email: string | null;
  invited: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [pending, start] = useTransition();

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <section className="flex flex-col gap-4 rounded-2xl bg-eucalyptus-mist p-5 sm:p-6">
      <div className="flex flex-col gap-1">
        <h2 className="font-medium">Osobní odkaz</h2>
        <p className="text-sm text-ink-soft">
          Přes něj domácnost uvidí své pozvání a potvrdí účast. Na webu jde zadat i kód <strong className="font-mono tracking-wider text-ink">{shortCode}</strong>.
        </p>
      </div>
      <input
        readOnly
        value={url}
        aria-label="Osobní odkaz"
        onFocus={(e) => e.target.select()}
        className="h-11 w-full rounded-lg border border-line bg-surface px-3.5 text-[15px]"
      />
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={copy} className="h-10 rounded-full bg-eucalyptus px-5 text-sm font-medium text-white hover:bg-eucalyptus-deep">
          {copied ? "Zkopírováno" : "Kopírovat odkaz"}
        </button>
        {email ? (
          <Link
            href={`/app/hoste/emaily?druh=${invited ? "pripominky" : "pozvanky"}&domacnost=${householdId}`}
            className="inline-flex h-10 items-center rounded-full border border-line bg-surface px-5 text-sm font-medium hover:border-eucalyptus"
          >
            {invited ? "Připomenout e-mailem" : "Poslat pozvánku e-mailem"}
          </Link>
        ) : null}
        <a href={url} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center rounded-full border border-line bg-surface px-5 text-sm font-medium hover:border-eucalyptus">
          Zobrazit jako host
        </a>
        <a
          href={`https://wa.me/?text=${encodeURIComponent(`${message} ${url}`)}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-10 items-center rounded-full border border-line bg-surface px-5 text-sm font-medium hover:border-eucalyptus"
        >
          Poslat přes WhatsApp
        </a>
        {confirming ? (
          <span className="flex flex-wrap items-center gap-2 text-sm">
            Starý odkaz přestane fungovat.
            <button
              type="button"
              disabled={pending}
              onClick={() => start(async () => { await regenerateLink(householdId); setConfirming(false); })}
              className="font-medium text-danger underline"
            >
              {pending ? "Vytvářím…" : "Vytvořit nový"}
            </button>
            <button type="button" onClick={() => setConfirming(false)} className="text-ink-soft underline">Zrušit</button>
          </span>
        ) : (
          <button type="button" onClick={() => setConfirming(true)} className="px-2 text-sm text-ink-soft underline-offset-2 hover:text-ink hover:underline">
            Vytvořit nový odkaz
          </button>
        )}
      </div>
    </section>
  );
}
