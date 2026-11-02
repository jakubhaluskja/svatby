"use client";

import { useActionState } from "react";
import type { Locale } from "@/lib/i18n";
import { siteCopy } from "@/lib/site-copy";
import { openByCode, type CodeState } from "./actions";

export function CodeForm({ site, locale }: { site: string; locale: Locale }) {
  const copy = siteCopy(locale);
  const [state, action, pending] = useActionState<CodeState, FormData>(openByCode.bind(null, site), {});
  return (
    <form action={action} className="flex flex-col items-center gap-3">
      <label htmlFor="code" className="sr-only">{copy.codeLabel}</label>
      <div className="flex gap-2">
        <input
          id="code"
          name="code"
          required
          maxLength={8}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          placeholder="K7M2PX"
          aria-invalid={state.error ? true : undefined}
          className="h-12 w-40 rounded-full border bg-white/70 px-5 text-center font-mono text-lg uppercase tracking-[0.2em] focus:outline-none focus:ring-2 focus:ring-[var(--site-accent)]"
          style={{ borderColor: "var(--site-line)", color: "var(--site-text)" }}
        />
        <button type="submit" disabled={pending} className="h-12 rounded-full px-6 text-white disabled:opacity-60" style={{ background: "var(--site-accent)" }}>
          {copy.codeSubmit}
        </button>
      </div>
      {state.error ? <p role="alert" className="max-w-sm text-center text-sm" style={{ color: "var(--site-accent)" }}>{copy.codeInvalid}</p> : null}
    </form>
  );
}
