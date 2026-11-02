"use client";

import { useActionState } from "react";
import type { Locale } from "@/lib/i18n";
import { unlockSite, type UnlockState } from "./actions";

const COPY = {
  cs: { title: "Web je chráněný heslem", text: "Heslo najdete na pozvánce.", label: "Heslo", submit: "Vstoupit", error: "Heslo nesedí. Zkuste to znovu, nebo se ozvěte novomanželům." },
  en: { title: "This website is password protected", text: "You'll find the password on your invitation.", label: "Password", submit: "Enter", error: "That password doesn't match. Please try again or contact the couple." },
};

export function PasswordGate({ site, locale, names }: { site: string; locale: Locale; names: string }) {
  const [state, action, pending] = useActionState<UnlockState, FormData>(unlockSite.bind(null, site), {});
  const c = COPY[locale];
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-6 px-6 text-center">
      <p className="text-3xl" style={{ fontFamily: "var(--site-display)" }}>{names}</p>
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-medium">{c.title}</h1>
        <p style={{ color: "var(--site-muted)" }}>{c.text}</p>
      </div>
      <form action={action} className="flex flex-col items-center gap-3">
        <label htmlFor="password" className="sr-only">{c.label}</label>
        <div className="flex gap-2">
          <input
            id="password"
            name="password"
            type="password"
            required
            autoComplete="off"
            className="h-12 w-52 rounded-full border bg-white/70 px-5 focus:outline-none focus:ring-2 focus:ring-[var(--site-accent)]"
            style={{ borderColor: "var(--site-line)", color: "var(--site-text)" }}
          />
          <button type="submit" disabled={pending} className="h-12 rounded-full px-6 text-white disabled:opacity-60" style={{ background: "var(--site-accent)" }}>
            {c.submit}
          </button>
        </div>
        {state.error ? <p role="alert" className="max-w-sm text-sm" style={{ color: "var(--site-accent)" }}>{c.error}</p> : null}
      </form>
    </main>
  );
}
