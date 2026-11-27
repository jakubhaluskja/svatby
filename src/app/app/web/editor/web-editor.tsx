"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { Icon } from "@/components/icons";
import { uploadSitePhoto } from "@/components/photo-upload";
import { EditProvider } from "@/components/site/edit";
import type { SiteModel } from "@/components/site/model";
import { SiteTemplate } from "@/components/site/templates";
import type { Locale } from "@/lib/i18n";
import { MAX_CUSTOM, SECTION_LABELS, SECTION_SCHEMAS, isRepeatable, lt, newSectionId, type Section, type SectionType } from "@/lib/site-sections";
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

  const update = useCallback((id: string, patch: Record<string, unknown>) => {
    setSections((list) => list.map((s) => (s.id === id ? ({ ...s, content: { ...s.content, ...patch } } as Section) : s)));
  }, []);

  const move = (id: string, dir: -1 | 1) =>
    setSections((list) => {
      const i = list.findIndex((s) => s.id === id);
      const j = i + dir;
      if (i <= 0 || j <= 0 || j >= list.length) return list;
      const next = [...list];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  /** Přesun sekce tažením: vloží sekci from na pozici sekce to. */
  const moveTo = (from: string, to: string) =>
    setSections((list) => {
      const i = list.findIndex((s) => s.id === from);
      const j = list.findIndex((s) => s.id === to);
      if (i <= 0 || j <= 0 || i === j) return list;
      const next = [...list];
      const [item] = next.splice(i, 1);
      next.splice(j, 0, item);
      return next;
    });
  const toggle = (id: string) => setSections((list) => list.map((s) => (s.id === id && s.type !== "hero" ? ({ ...s, enabled: !s.enabled } as Section) : s)));
  const remove = (s: Section) => {
    const name = label(s);
    if (!window.confirm(`Smazat sekci „${name}“ i s textem a fotkami?`)) return;
    setSections((list) => list.filter((x) => x.id !== s.id));
  };
  const customCount = sections.filter((s) => s.type === "custom").length;
  const hidden = sections.filter((s) => !s.enabled);
  const add = (type: SectionType) => {
    setAdding(false);
    if (isRepeatable(type)) {
      const id = newSectionId(type);
      setSections((list) => [...list, { id, type, enabled: true, content: SECTION_SCHEMAS[type].parse({}) } as Section]);
      setTimeout(() => scrollTo(id), 120);
      return;
    }
    // Jedinečnou sekci zapneme a přesuneme na konec
    setSections((list) => {
      const s = list.find((x) => x.type === type);
      if (!s) return list;
      return [...list.filter((x) => x.id !== s.id), { ...s, enabled: true } as Section];
    });
    setTimeout(() => scrollTo(type), 120);
  };
  const [adding, setAdding] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  const scrollTo = (id: string) => {
    document.querySelector(`[data-canvas] [data-section="${id}"]`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const label = (s: Section) => (s.type === "custom" ? lt(s.content.title, "cs") || SECTION_LABELS.custom.cs : SECTION_LABELS[s.type].cs);

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
    const i = sections.findIndex((x) => x.id === s.id);
    return (
      <div className="absolute right-3 top-3 z-30 hidden items-center gap-0.5 rounded-xl bg-[#1e2b26] px-1.5 py-1 text-[13px] text-white shadow-[0_18px_40px_-12px_rgba(30,43,38,.5)] group-hover/sec:flex group-focus-within/sec:flex" style={{ fontFamily: "var(--font-geist-sans), sans-serif", fontStyle: "normal", letterSpacing: 0, textTransform: "none", lineHeight: 1.4 }}>
        <span className="max-w-[12rem] truncate px-2 font-medium">{label(s)}</span>
        {s.type !== "hero" ? (
          <>
            <span className="mx-1 h-5 w-px bg-white/20" />
            <button type="button" onClick={() => move(s.id, -1)} disabled={i <= 1} aria-label="Posunout nahoru" className="grid size-8 place-items-center rounded-lg hover:bg-white/10 disabled:opacity-30">↑</button>
            <button type="button" onClick={() => move(s.id, 1)} disabled={i >= sections.length - 1} aria-label="Posunout dolů" className="grid size-8 place-items-center rounded-lg hover:bg-white/10 disabled:opacity-30">↓</button>
            {s.type === "custom" ? (
              <button type="button" onClick={() => remove(s)} className="h-8 rounded-lg px-2 hover:bg-white/10">Smazat</button>
            ) : (
              <button type="button" onClick={() => toggle(s.id)} className="h-8 rounded-lg px-2 hover:bg-white/10">Skrýt</button>
            )}
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
                <li
                  key={s.id}
                  draggable={s.type !== "hero"}
                  onDragStart={(e) => {
                    setDragId(s.id);
                    e.dataTransfer.effectAllowed = "move";
                    e.dataTransfer.setData("text/plain", s.id);
                  }}
                  onDragOver={(e) => {
                    if (!dragId || s.type === "hero") return;
                    e.preventDefault();
                    setOverId(s.id);
                  }}
                  onDragLeave={() => setOverId((o) => (o === s.id ? null : o))}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (dragId) moveTo(dragId, s.id);
                    setDragId(null);
                    setOverId(null);
                  }}
                  onDragEnd={() => {
                    setDragId(null);
                    setOverId(null);
                  }}
                  className={`group flex h-10 items-center gap-1 rounded-lg pl-1 pr-1 text-sm hover:bg-paper ${s.enabled ? "" : "text-ink-soft/60"} ${dragId === s.id ? "opacity-40" : ""} ${overId === s.id && dragId !== s.id ? "ring-2 ring-eucalyptus" : ""}`}
                >
                  <span aria-hidden className={`grid w-4 shrink-0 place-items-center text-ink-soft/50 ${s.type === "hero" ? "invisible" : "cursor-grab active:cursor-grabbing"}`}>
                    <svg viewBox="0 0 10 16" className="h-3.5 w-2.5" fill="currentColor">
                      <circle cx="2.5" cy="3" r="1.3" /><circle cx="7.5" cy="3" r="1.3" /><circle cx="2.5" cy="8" r="1.3" /><circle cx="7.5" cy="8" r="1.3" /><circle cx="2.5" cy="13" r="1.3" /><circle cx="7.5" cy="13" r="1.3" />
                    </svg>
                  </span>
                  <button type="button" onClick={() => s.enabled && scrollTo(s.id)} className="min-w-0 flex-1 truncate text-left">
                    {label(s)}
                  </button>
                  {s.type !== "hero" ? (
                    <>
                      <button type="button" onClick={() => move(s.id, -1)} disabled={i <= 1} aria-label={`Posunout ${label(s)} nahoru`} className="grid size-7 place-items-center rounded-md text-ink-soft opacity-0 hover:bg-surface focus:opacity-100 group-hover:opacity-100 disabled:hidden">↑</button>
                      <button type="button" onClick={() => move(s.id, 1)} disabled={i >= sections.length - 1} aria-label={`Posunout ${label(s)} dolů`} className="grid size-7 place-items-center rounded-md text-ink-soft opacity-0 hover:bg-surface focus:opacity-100 group-hover:opacity-100 disabled:hidden">↓</button>
                      {s.type === "custom" ? (
                        <button type="button" onClick={() => remove(s)} aria-label={`Smazat ${label(s)}`} className="grid size-7 place-items-center rounded-md text-ink-soft hover:bg-surface hover:text-danger">
                          <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
                            <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6" />
                          </svg>
                        </button>
                      ) : (
                        <button type="button" onClick={() => toggle(s.id)} aria-pressed={s.enabled} aria-label={s.enabled ? `Skrýt ${label(s)}` : `Zobrazit ${label(s)}`} className="grid size-7 place-items-center rounded-md text-ink-soft hover:bg-surface hover:text-ink">
                          {s.enabled ? (
                            <Icon n="eye" className="size-4" />
                          ) : (
                            <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
                              <path d="M3 3l18 18M10.6 6.1A9.6 9.6 0 0 1 12 6c6 0 9.5 6 9.5 6a17 17 0 0 1-3 3.6M6.6 7.6C4 9.4 2.5 12 2.5 12S6 18 12 18c1.5 0 2.9-.4 4.1-1" />
                            </svg>
                          )}
                        </button>
                      )}
                    </>
                  ) : null}
                </li>
              ))}
            </ul>
            <div className="relative mt-2">
              <button type="button" onClick={() => setAdding(!adding)} aria-expanded={adding} className="flex h-10 w-full items-center justify-center gap-1.5 rounded-lg text-sm font-medium text-eucalyptus-deep border border-dashed border-line hover:bg-paper hover:border-eucalyptus">
                + Přidat sekci
              </button>
              {adding ? (
                <div className="absolute inset-x-0 top-11 z-10 flex flex-col gap-0.5 rounded-xl bg-surface p-1.5 shadow-pop ring-1 ring-line">
                  <button type="button" onClick={() => add("custom")} disabled={customCount >= MAX_CUSTOM} className="rounded-lg px-3 py-2 text-left hover:bg-paper disabled:opacity-40">
                    <span className="block text-sm font-medium">Vlastní sekce</span>
                    <span className="block text-[12px] text-ink-soft">{SECTION_LABELS.custom.hint}</span>
                  </button>
                  {hidden.length ? <p className="px-3 pt-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-soft/70">Skryté sekce</p> : null}
                  {hidden.map((s) => (
                    <button key={s.id} type="button" onClick={() => add(s.type)} className="rounded-lg px-3 py-2 text-left hover:bg-paper">
                      <span className="block text-sm font-medium">{SECTION_LABELS[s.type].cs}</span>
                      <span className="block text-[12px] text-ink-soft">{SECTION_LABELS[s.type].hint}</span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
            <p className="mt-4 text-[13px] leading-relaxed text-ink-soft">
              Pořadí změníte přetažením. Klikněte na libovolný text na webu a pište, fotky vyměníte tlačítkem na fotce. Program se skládá z <Link href="/app/udalosti" className="underline">událostí</Link>.
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
