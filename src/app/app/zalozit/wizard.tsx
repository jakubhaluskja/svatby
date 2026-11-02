"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { PhoneFrame } from "@/components/phone-frame";
import { SiteHero } from "@/components/site/site-hero";
import { Button, Field, FormMessage } from "@/components/ui";
import { slugify, suggestSlug } from "@/lib/slug";
import { TEMPLATES, type TemplateId } from "@/lib/templates";
import { checkSlug, createWedding, type SlugCheck } from "./actions";

const STEPS = ["Jména", "Datum a místo", "Vzhled", "Adresa webu"] as const;

export function Wizard({ appDomain }: { appDomain: string }) {
  const [step, setStep] = useState(0);
  const [partner1, setPartner1] = useState("");
  const [partner2, setPartner2] = useState("");
  const [date, setDate] = useState("");
  const [dateUnknown, setDateUnknown] = useState(false);
  const [place, setPlace] = useState("");
  const [template, setTemplate] = useState<TemplateId>("modern");
  const [locale, setLocale] = useState<"cs" | "en">("cs");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [slugCheck, setSlugCheck] = useState<SlugCheck | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [checking, startChecking] = useTransition();
  const [creating, startCreating] = useTransition();
  const headingRef = useRef<HTMLHeadingElement>(null);

  // Adresa se navrhuje z jmen, dokud ji pár sám nezmění.
  const effectiveSlug = slugEdited ? slug : suggestSlug(partner1, partner2);
  const year = date ? Number(date.slice(0, 4)) : undefined;

  useEffect(() => {
    if (step !== 3 || !effectiveSlug) return;
    const t = setTimeout(() => {
      startChecking(async () => setSlugCheck(await checkSlug(effectiveSlug, year)));
    }, 350);
    return () => clearTimeout(t);
  }, [step, effectiveSlug, year]);

  useEffect(() => {
    headingRef.current?.focus();
  }, [step]);

  const canContinue = useMemo(() => {
    if (step === 0) return partner1.trim() !== "" && partner2.trim() !== "";
    if (step === 1) return dateUnknown || /^\d{4}-\d{2}-\d{2}$/.test(date);
    if (step === 3) return !!slugCheck?.available && slugCheck.slug === effectiveSlug && !checking;
    return true;
  }, [step, partner1, partner2, date, dateUnknown, slugCheck, effectiveSlug, checking]);

  function next(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!canContinue) return;
    if (step < STEPS.length - 1) {
      setStep(step + 1);
      return;
    }
    startCreating(async () => {
      const result = await createWedding({
        partner1,
        partner2,
        date: dateUnknown ? null : date,
        place: place || null,
        slug: effectiveSlug,
        template,
        locale,
      });
      if (result?.error) setError(result.error);
    });
  }

  const preview = (
    <PhoneFrame address={`${effectiveSlug || "vase-adresa"}.${appDomain.replace(/:\d+$/, "")}`}>
      <SiteHero
        partner1={partner1}
        partner2={partner2}
        date={dateUnknown ? null : date || null}
        place={place || null}
        template={template}
        locale={locale}
        compact
      />
    </PhoneFrame>
  );

  return (
    <div className="grid min-h-[calc(100svh-4rem)] lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="flex flex-col px-6 py-10 sm:px-12">
        <ol className="flex gap-2" aria-label="Postup">
          {STEPS.map((label, i) => (
            <li key={label} className="flex-1">
              <span
                className={`block h-1 rounded-full transition-colors ${i <= step ? "bg-eucalyptus" : "bg-line"}`}
              />
              <span className={`mt-2 hidden text-xs sm:block ${i === step ? "text-ink" : "text-ink-soft"}`}>
                {i + 1}. {label}
              </span>
            </li>
          ))}
        </ol>

        <form onSubmit={next} className="flex flex-1 flex-col justify-center gap-8 py-10" noValidate>
          {step === 0 ? (
            <>
              <StepHeading ref={headingRef} title="Kdo se bere?" text="Jména uvidí hosté na úvodu webu." />
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="První z vás" name="partner1" value={partner1} onChange={(e) => setPartner1(e.target.value)} autoComplete="off" maxLength={60} autoFocus />
                <Field label="Druhý z vás" name="partner2" value={partner2} onChange={(e) => setPartner2(e.target.value)} autoComplete="off" maxLength={60} />
              </div>
            </>
          ) : null}

          {step === 1 ? (
            <>
              <StepHeading ref={headingRef} title="Kdy a kde?" text="Podle data spočítáme termíny úkolů. Změnit ho můžete kdykoli." />
              <div className="flex flex-col gap-5">
                <Field label="Datum svatby" name="date" type="date" value={date} disabled={dateUnknown} onChange={(e) => setDate(e.target.value)} />
                <label className="-mt-2 flex items-center gap-2.5 text-sm text-ink-soft">
                  <input type="checkbox" checked={dateUnknown} onChange={(e) => setDateUnknown(e.target.checked)} className="size-4 accent-eucalyptus" />
                  Datum zatím nevíme
                </label>
                <Field label="Místo obřadu" name="place" value={place} onChange={(e) => setPlace(e.target.value)} placeholder="Například Zámek Hrubá Skála" hint="Nepovinné. Adresu a další místa doplníte později." maxLength={120} />
              </div>
            </>
          ) : null}

          {step === 2 ? (
            <>
              <StepHeading ref={headingRef} title="Jak má web vypadat?" text="Šablonu můžete změnit kdykoli, obsah zůstane." />
              <fieldset className="flex flex-col gap-2">
                <legend className="sr-only">Šablona</legend>
                {TEMPLATES.map((t) => (
                  <label
                    key={t.id}
                    className={`flex cursor-pointer items-center gap-4 rounded-xl border px-4 py-3 transition-colors ${
                      template === t.id ? "border-eucalyptus bg-eucalyptus-mist" : "border-line bg-surface hover:border-ink-soft/40"
                    }`}
                  >
                    <input type="radio" name="template" value={t.id} checked={template === t.id} onChange={() => setTemplate(t.id)} className="sr-only" />
                    <span className="flex shrink-0 -space-x-1.5" aria-hidden>
                      {[t.colors.background, t.colors.accent, t.colors.text].map((c) => (
                        <span key={c} className="size-5 rounded-full border border-black/10" style={{ background: c }} />
                      ))}
                    </span>
                    <span className="flex flex-col">
                      <span className="font-medium">{t.name}</span>
                      <span className="text-sm text-ink-soft">{t.description}</span>
                    </span>
                  </label>
                ))}
              </fieldset>
              <fieldset className="flex flex-col gap-2">
                <legend className="mb-2 text-sm font-medium">Hlavní jazyk webu</legend>
                <div className="flex gap-2">
                  {(["cs", "en"] as const).map((l) => (
                    <label key={l} className={`cursor-pointer rounded-full border px-4 py-2 text-sm ${locale === l ? "border-eucalyptus bg-eucalyptus-mist" : "border-line bg-surface"}`}>
                      <input type="radio" name="locale" value={l} checked={locale === l} onChange={() => setLocale(l)} className="sr-only" />
                      {l === "cs" ? "Čeština" : "Angličtina"}
                    </label>
                  ))}
                </div>
                <p className="text-sm text-ink-soft">Druhý jazyk pro zahraniční hosty zapnete v nastavení webu.</p>
              </fieldset>
            </>
          ) : null}

          {step === 3 ? (
            <>
              <StepHeading ref={headingRef} title="Adresa vašeho webu" text="Tuhle adresu pošlete hostům. Vlastní doménu připojíte později." />
              <div className="flex flex-col gap-3">
                <label htmlFor="slug" className="text-sm font-medium">Adresa</label>
                <div className="flex h-11 items-center overflow-hidden rounded-lg border border-line bg-surface focus-within:border-eucalyptus">
                  <input
                    id="slug"
                    value={effectiveSlug}
                    onChange={(e) => {
                      setSlugEdited(true);
                      setSlug(slugify(e.target.value));
                    }}
                    className="h-full min-w-0 flex-1 bg-transparent px-3.5 text-[15px] focus:outline-none"
                    autoComplete="off"
                    spellCheck={false}
                    aria-describedby="slug-status"
                  />
                  <span className="shrink-0 pr-3.5 text-[15px] text-ink-soft">.{appDomain.replace(/:\d+$/, "")}</span>
                </div>
                <p id="slug-status" aria-live="polite" className="min-h-5 text-sm">
                  {checking ? (
                    <span className="text-ink-soft">Ověřuji…</span>
                  ) : slugCheck && slugCheck.slug === effectiveSlug ? (
                    slugCheck.available ? (
                      <span className="text-eucalyptus-deep">Adresa je volná.</span>
                    ) : (
                      <span className="text-danger">{slugCheck.reason}</span>
                    )
                  ) : null}
                </p>
                {slugCheck && !slugCheck.available && slugCheck.suggestions.length > 0 && slugCheck.slug === effectiveSlug ? (
                  <div className="flex flex-wrap gap-2">
                    {slugCheck.suggestions.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => {
                          setSlugEdited(true);
                          setSlug(s);
                        }}
                        className="rounded-full border border-line bg-surface px-3 py-1.5 text-sm hover:border-eucalyptus"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            </>
          ) : null}

          {error ? <FormMessage>{error}</FormMessage> : null}

          <div className="flex items-center gap-3">
            {step > 0 ? (
              <Button type="button" variant="quiet" onClick={() => setStep(step - 1)} disabled={creating}>
                Zpět
              </Button>
            ) : null}
            <Button type="submit" disabled={!canContinue || creating}>
              {step < STEPS.length - 1 ? "Pokračovat" : creating ? "Zakládám svatbu…" : "Založit svatbu"}
            </Button>
          </div>

          <div className="flex justify-center lg:hidden">{preview}</div>
        </form>
      </div>

      <aside className="hidden items-center justify-center bg-eucalyptus-mist lg:flex" aria-label="Náhled webu">
        {preview}
      </aside>
    </div>
  );
}

function StepHeading({ title, text, ref }: { title: string; text: string; ref: React.Ref<HTMLHeadingElement> }) {
  return (
    <div className="flex flex-col gap-2">
      <h1 ref={ref} tabIndex={-1} className="font-display text-3xl font-semibold tracking-tight focus:outline-none">
        {title}
      </h1>
      <p className="text-ink-soft">{text}</p>
    </div>
  );
}
