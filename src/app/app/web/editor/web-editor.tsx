"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { Icon } from "@/components/icons";
import { uploadSitePhoto } from "@/components/photo-upload";
import { EditProvider } from "@/components/site/edit";
import type { SiteModel } from "@/components/site/model";
import { SiteTemplate } from "@/components/site/templates";
import type { Locale } from "@/lib/i18n";
import { SECTION_LABELS, type Section, type SectionType } from "@/lib/site-sections";
import { TEMPLATES, templateId, type TemplateId } from "@/lib/templates";
import { publishChanges, saveSite } from "../actions";

type Save = "saved" | "saving" | "error";

export function WebEditor({
  base,
  initialSections,
  initialTemplate,
  locales,
  siteUrl,
  published,
  canPublish,
}: {
  base: Omit<SiteModel, "sections" | "locale" | "rsvp">;
  initialSections: Section[];
  initialTemplate: string;
  locales: Locale[];
  siteUrl: string;
  published: boolean;
  canPublish: boolean;
}) {
  const [sections, setSections] = useState<Section[]>(initialSections);
  const [template, setTemplate] = useState<TemplateId>(templateId(initialTemplate));
  const [locale, setLocale] = useState<Locale>(locales[0] ?? "cs");
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [save, setSave] = useState<Save>("saved");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isPublished, setPublished] = useState(published);
  const [dirtySincePublish, setDirtySincePublish] = useState(false);
  const [panel, setPanel] = useState(true);
  const [publishing, startPublish] = useTransition();
  const first = useRef(true);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef({ sections, template });
  latest.current = { sections, template };

  const flush = useCallback(async () => {
    if (timer.current) clearTimeout(timer.current);
    setSave("saving");
    const r = await saveSite(latest.current.sections, latest.current.template);
    if (r.error) {
      setSave("error");
      setError(r.error);
      return false;
    }
    setSave("saved");
    setError(null);
    return true;
  }, []);

  // Automatické ukládání chvíli po poslední změně
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    setSave("saving");
    setDirtySincePublish(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(flush, 900);
  }, [sections, template, flush]);

  // Neuložené změny při zavření stránky
  useEffect(() => {
    const onLeave = (e: BeforeUnloadEvent) => {
      if (save === "saving") e.preventDefault();
    };
    window.addEventListener("beforeunload", onLeave);
    return () => window.removeEventListener("beforeunload", onLeave);
  }, [save]);

  const update = useCallback((type: SectionType, patch: Record<string, unknown>) => {
    setSections((list) => list.map((s) => (s.type === type ? ({ ...s, content: { ...s.content, ...patch } } as Section) : s)));
  }, []);

  const move = (type: SectionType, dir: -1 | 1) =>
    setSections((list) => {
      const i = list.findIndex((s) => s.type === type);
      const j = i + dir;
      if (i <= 0 || j <= 0 || j >= list.length) return list;
      const next = [...list];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  const toggle = (type: SectionType) => setSections((list) => list.map((s) => (s.type === type && type !== "hero" ? ({ ...s, enabled: !s.enabled } as Section) : s)));

  const scrollTo = (type: SectionType) => {
    document.querySelector(`[data-canvas] [data-section="${type}"]`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const upload = useCallback(
    async (file: File) => {
      try {
        return await uploadSitePhoto(base.weddingId, file);
      } catch {
        setError("Fotku se nepodařilo nahrát. Použijte JPG, PNG nebo WebP.");
        return null;
      }
    },
    [base.weddingId],
  );

  const controls = (s: Section) => {
    const i = sections.findIndex((x) => x.type === s.type);
    return (
      <div className="absolute right-3 top-3 z-30 hidden items-center gap-0.5 rounded-xl bg-[#1e2b26] px-1.5 py-1 text-[13px] text-white shadow-[0_18px_40px_-12px_rgba(30,43,38,.5)] group-hover/sec:flex group-focus-within/sec:flex" style={{ fontFamily: "var(--font-geist-sans), sans-serif", fontStyle: "normal", letterSpacing: 0, textTransform: "none", lineHeight: 1.4 }}>
        <span className="px-2 font-medium">{SECTION_LABELS[s.type].cs}</span>
        {s.type !== "hero" ? (
          <>
            <span className="mx-1 h-5 w-px bg-white/20" />
            <button type="button" onClick={() => move(s.type, -1)} disabled={i <= 1} aria-label="Posunout nahoru" className="grid size-8 place-items-center rounded-lg hover:bg-white/10 disabled:opacity-30">↑</button>
            <button type="button" onClick={() => move(s.type, 1)} disabled={i >= sections.length - 1} aria-label="Posunout dolů" className="grid size-8 place-items-center rounded-lg hover:bg-white/10 disabled:opacity-30">↓</button>
            <button type="button" onClick={() => toggle(s.type)} className="h-8 rounded-lg px-2 hover:bg-white/10">Skrýt</button>
          </>
        ) : null}
        {s.type === "gifts" ? (
          <label className="flex h-8 items-center gap-1.5 rounded-lg px-2 hover:bg-white/10">
            <input type="checkbox" checked={s.content.show_account} onChange={(e) => update("gifts", { show_account: e.target.checked })} className="accent-[#9fc2b0]" />
            Číslo účtu
          </label>
        ) : null}
      </div>
    );
  };

  const model: SiteModel = { ...base, sections, locale, rsvp: null };

  const publish = () =>
    startPublish(async () => {
      const ok = await flush();
      if (!ok) return;
      const r = await publishChanges();
      if (r.error) setError(r.error);
      else {
        setPublished(true);
        setDirtySincePublish(false);
        setMessage(isPublished ? "Změny jsou na webu." : "Web je online. Hosté ho teď uvidí.");
        setTimeout(() => setMessage(null), 4000);
      }
    });

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#e9edea] text-ink">
      <header className="flex h-14 shrink-0 items-center gap-2 border-b border-line bg-surface px-3 sm:gap-4 sm:px-4">
        <Link href="/app/web" className="flex items-center gap-1.5 rounded-full px-2 py-1.5 text-sm text-ink-soft hover:bg-paper hover:text-ink">
          <Icon n="chev" className="size-4 rotate-180" />
          <span className="hidden sm:inline">Zpět</span>
        </Link>
        <span className="hidden font-serif text-lg md:inline">Svatební web</span>
        <button type="button" onClick={() => setPanel(!panel)} aria-pressed={panel} className="rounded-full px-3 py-1.5 text-sm ring-1 ring-line lg:hidden">
          Sekce
        </button>
        <div className="ml-2 hidden rounded-full bg-paper p-1 text-sm ring-1 ring-line sm:flex">
          {(["desktop", "mobile"] as const).map((d) => (
            <button key={d} type="button" onClick={() => setDevice(d)} aria-pressed={device === d} className={`rounded-full px-3 py-1 ${device === d ? "bg-surface font-medium shadow-card" : "text-ink-soft"}`}>
              {d === "desktop" ? "Počítač" : "Mobil"}
            </button>
          ))}
        </div>
        {locales.length > 1 ? (
          <div className="flex rounded-full bg-paper p-1 text-sm ring-1 ring-line">
            {locales.map((l) => (
              <button key={l} type="button" onClick={() => setLocale(l)} aria-pressed={locale === l} className={`rounded-full px-3 py-1 ${locale === l ? "bg-surface font-medium shadow-card" : "text-ink-soft"}`}>
                {l === "cs" ? "Čeština" : "English"}
              </button>
            ))}
          </div>
        ) : null}
        <span role="status" className="ml-auto hidden items-center gap-1.5 text-sm text-ink-soft sm:flex">
          <span className={`size-2 rounded-full ${save === "saved" ? "bg-eucalyptus" : save === "saving" ? "animate-pulse bg-[#b8913a]" : "bg-danger"}`} />
          {save === "saved" ? "Uloženo" : save === "saving" ? "Ukládám…" : "Neuloženo"}
        </span>
        <a href={siteUrl} target="_blank" rel="noreferrer" className="ml-auto flex h-9 items-center gap-2 rounded-full px-3 text-sm font-medium ring-1 ring-line hover:ring-eucalyptus sm:ml-0 sm:px-4">
          <Icon n="eye" className="size-4" />
          <span className="hidden md:inline">Otevřít web</span>
        </a>
        {canPublish ? (
          <button type="button" onClick={publish} disabled={publishing || (isPublished && !dirtySincePublish)} className="h-9 rounded-full bg-ink px-4 text-sm font-medium text-white hover:bg-ink/85 disabled:opacity-50">
            {publishing ? "Zveřejňuji…" : isPublished ? (dirtySincePublish ? "Zveřejnit změny" : "Zveřejněno") : "Zveřejnit web"}
          </button>
        ) : null}
      </header>

      {error || message ? (
        <p role="alert" className={`px-4 py-2 text-center text-sm ${error ? "bg-danger/10 text-danger" : "bg-eucalyptus-mist text-eucalyptus-deep"}`}>
          {error ?? message}
        </p>
      ) : null}

      <div className="flex min-h-0 flex-1">
        <aside className={`${panel ? "flex" : "hidden"} absolute inset-y-14 left-0 z-40 w-[290px] shrink-0 flex-col gap-6 overflow-y-auto border-r border-line bg-surface px-5 py-5 shadow-pop lg:static lg:flex lg:shadow-none`}>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-soft/80">Šablona</p>
            <div className="mt-3 grid grid-cols-5 gap-2">
              {TEMPLATES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTemplate(t.id)}
                  title={t.name}
                  aria-pressed={template === t.id}
                  className={`flex aspect-[3/4] flex-col items-center justify-center gap-1 rounded-lg ring-1 transition-shadow ${template === t.id ? "ring-2 ring-ink" : "ring-line hover:ring-ink/40"}`}
                  style={{ background: t.colors.background }}
                >
                  <span className="text-[15px] leading-none" style={{ fontFamily: t.displayFont, color: t.colors.text }}>
                    Aa
                  </span>
                  <span className="h-1 w-5 rounded-full" style={{ background: t.colors.accent }} />
                </button>
              ))}
            </div>
            <p className="mt-2 text-sm font-medium">{TEMPLATES.find((t) => t.id === template)?.name}</p>
            <p className="text-[13px] text-ink-soft">{TEMPLATES.find((t) => t.id === template)?.description}</p>
          </div>

          <div className="flex min-h-0 flex-col">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-soft/80">Sekce</p>
            <ul className="mt-2 flex flex-col">
              {sections.map((s, i) => (
                <li key={s.type} className={`group flex h-10 items-center gap-1 rounded-lg pl-2 pr-1 text-sm hover:bg-paper ${s.enabled ? "" : "text-ink-soft/60"}`}>
                  <button type="button" onClick={() => s.enabled && scrollTo(s.type)} className="min-w-0 flex-1 truncate text-left">
                    {SECTION_LABELS[s.type].cs}
                  </button>
                  {s.type !== "hero" ? (
                    <>
                      <button type="button" onClick={() => move(s.type, -1)} disabled={i <= 1} aria-label={`Posunout ${SECTION_LABELS[s.type].cs} nahoru`} className="grid size-7 place-items-center rounded-md text-ink-soft opacity-0 hover:bg-surface group-hover:opacity-100 disabled:hidden">↑</button>
                      <button type="button" onClick={() => move(s.type, 1)} disabled={i >= sections.length - 1} aria-label={`Posunout ${SECTION_LABELS[s.type].cs} dolů`} className="grid size-7 place-items-center rounded-md text-ink-soft opacity-0 hover:bg-surface group-hover:opacity-100 disabled:hidden">↓</button>
                      <button type="button" onClick={() => toggle(s.type)} aria-pressed={s.enabled} aria-label={s.enabled ? `Skrýt ${SECTION_LABELS[s.type].cs}` : `Zobrazit ${SECTION_LABELS[s.type].cs}`} className="grid size-7 place-items-center rounded-md text-ink-soft hover:bg-surface hover:text-ink">
                        {s.enabled ? (
                          <Icon n="eye" className="size-4" />
                        ) : (
                          <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
                            <path d="M3 3l18 18M10.6 6.1A9.6 9.6 0 0 1 12 6c6 0 9.5 6 9.5 6a17 17 0 0 1-3 3.6M6.6 7.6C4 9.4 2.5 12 2.5 12S6 18 12 18c1.5 0 2.9-.4 4.1-1" />
                          </svg>
                        )}
                      </button>
                    </>
                  ) : null}
                </li>
              ))}
            </ul>
            <p className="mt-4 text-[13px] leading-relaxed text-ink-soft">
              Klikněte na libovolný text na webu a pište. Fotky vyměníte tlačítkem na fotce. Program se skládá z <Link href="/app/udalosti" className="underline">událostí</Link>.
            </p>
          </div>
        </aside>

        <main data-canvas className="min-w-0 flex-1 overflow-y-auto">
          <div className={device === "mobile" ? "mx-auto my-6 w-[390px] overflow-hidden rounded-[2rem] shadow-pop ring-8 ring-ink" : "min-h-full"}>
            <EditProvider value={{ editing: true, locale, update, upload, sectionControls: controls }}>
              <SiteTemplate template={template} model={model} />
            </EditProvider>
          </div>
        </main>
      </div>
    </div>
  );
}
