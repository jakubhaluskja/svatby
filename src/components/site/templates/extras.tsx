"use client";

import Image from "next/image";
import { useEffect, useState, type CSSProperties } from "react";
import type { Locale } from "@/lib/i18n";
import { photoUrl } from "@/lib/media";
import { lt, type LText, type Section, type SectionContent } from "@/lib/site-sections";
import { AddButton, FieldText, LineText, PhotoGrid, RemoveButton, RichText, hasText, useEdit } from "../edit";
import type { SiteModel } from "../model";
import { SANS, address, mapUrl, place, when } from "./shared";

/** Vzhled doplňků podle šablony. */
export type ExtrasTheme = {
  /** Barva zvýraznění (odkazy, štítky) */
  accent: string;
  /** Barva linek a rámečků */
  line: string;
  /** Písmo nadpisů (chody menu, čas v hlavních informacích) */
  display: CSSProperties;
  /** Třída karty hlavní informace */
  card?: string;
  cardStyle?: CSSProperties;
  /** Zaoblení fotek */
  radius?: string;
};

const WORDS = {
  cs: { map: "Otevřít mapu", label: "Např. Sraz", place: "Místo", time: "Čas", text: "Doplňující text (nepovinné)", mapLink: "Odkaz na mapu (mapy.cz, Google)", add: "Přidat informaci", fill: "Vyplnit z programu", colors: "Barvy, které budou slušet", inspiration: "Inspirace", addColor: "Přidat barvu", course: "Chod", dishes: "Co se bude podávat", addCourse: "Přidat chod", close: "Zavřít", prev: "Předchozí", next: "Další" },
  en: { map: "Open map", label: "e.g. Meet-up", place: "Place", time: "Time", text: "Extra note (optional)", mapLink: "Map link (Google, mapy.cz)", add: "Add info", fill: "Fill from schedule", colors: "Colours to wear", inspiration: "Inspiration", addColor: "Add colour", course: "Course", dishes: "What we'll serve", addCourse: "Add course", close: "Close", prev: "Previous", next: "Next" },
};

const empty = (): LText => ({ cs: "", en: "" });
const both = (t: string): LText => ({ cs: t, en: t });

/**
 * Hlavní informace pod úvodem: sraz, obřad, hostina – čas, místo, text a odkaz na mapu.
 * V editoru jdou karty vyplnit z programu svatby.
 */
export function KeyInfo({ s, model, theme, className = "" }: { s: Extract<Section, { type: "hero" }>; model: SiteModel; theme: ExtrasTheme; className?: string }) {
  const { editing, locale, update } = useEdit();
  const w = WORDS[locale];
  const items = s.content.info;
  if (!editing && !items.length) return null;
  const set = (next: SectionContent<"hero">["info"]) => update(s.id, { info: next });
  const patch = (i: number, p: Partial<(typeof items)[number]>) => set(items.map((x, k) => (k === i ? { ...x, ...p } : x)));
  const fill = () =>
    set(
      model.events.slice(0, 6).map((e) => {
        const a = address(e);
        const pl = [place(e), a].filter(Boolean).join(", ");
        return { label: both(e.name), time: when(e, locale, model.timeZone).time ?? "", place: both(pl), text: empty(), map: a ? mapUrl(a) : "" };
      }),
    );
  const cols = items.length >= 3 ? "@3xl:grid-cols-3" : items.length === 2 ? "@2xl:grid-cols-2" : "";
  return (
    <div data-key-info className={`relative mx-auto max-w-[1100px] px-5 @3xl:px-10 ${className}`}>
      <ul className={`grid gap-5 ${cols} ${items.length === 1 ? "mx-auto max-w-[460px]" : ""}`}>
        {items.map((it, i) => (
          <li key={i} className={`relative flex flex-col items-center gap-1.5 px-6 py-7 text-center ${theme.card ?? ""}`} style={theme.cardStyle}>
            <RemoveButton onClick={() => set(items.filter((_, k) => k !== i))} label="Smazat informaci" />
            <LineText value={it.label} onValue={(v) => patch(i, { label: v })} fallback={editing ? w.label : ""} className="text-[13px] font-semibold uppercase tracking-[0.18em]" style={{ fontFamily: SANS, color: theme.accent }} />
            <FieldText value={it.time} onValue={(v) => patch(i, { time: v.slice(0, 20) })} placeholder={w.time} className="text-[clamp(34px,5cqw,44px)] leading-none tabular-nums" style={theme.display} />
            <LineText value={it.place} onValue={(v) => patch(i, { place: v })} fallback={editing ? w.place : ""} className="mt-1 text-[18px] leading-snug" />
            <RichText value={it.text} onValue={(v) => patch(i, { text: v })} placeholder={w.text} className="text-[16px] leading-relaxed opacity-80" />
            {editing ? (
              <FieldText value={it.map} onValue={(v) => patch(i, { map: v.slice(0, 500) })} placeholder={w.mapLink} className="mt-2 w-full break-all text-[13px] opacity-70" style={{ fontFamily: SANS }} />
            ) : it.map ? (
              <a href={it.map} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1.5 text-[15px] underline underline-offset-4" style={{ fontFamily: SANS, color: theme.accent }}>
                <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden>
                  <path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21Z" />
                  <circle cx="12" cy="9.5" r="2.5" />
                </svg>
                {w.map}
              </a>
            ) : null}
          </li>
        ))}
      </ul>
      {editing ? (
        <div className="flex flex-wrap justify-center gap-3" style={{ fontFamily: SANS }}>
          {items.length < 6 ? <AddButton onClick={() => set([...items, { label: empty(), time: "", place: empty(), text: empty(), map: "" }])}>{w.add}</AddButton> : null}
          {!items.length && model.events.length ? (
            <button type="button" onClick={fill} className="mt-4 rounded-full px-4 py-2 text-[14px] font-medium text-white" style={{ background: theme.accent }}>
              {w.fill}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/** Obsah navíc u textových sekcí: barvy a inspirace (dress code), fotky, galerie, menu. */
export function SectionExtras({ s, theme, className = "mt-10" }: { s: Section; theme: ExtrasTheme; className?: string }) {
  switch (s.type) {
    case "dresscode":
      return (
        <div className={`flex flex-col gap-10 ${className}`}>
          <Swatches s={s} theme={theme} />
          <Photos s={s} theme={theme} max={8} title />
        </div>
      );
    case "custom":
      return <Photos s={s} theme={theme} max={12} className={className} />;
    case "gallery":
      return <Photos s={s} theme={theme} max={40} className={className} gallery />;
    case "menu":
      return <Menu s={s} theme={theme} className={className} />;
    default:
      return null;
  }
}

function Swatches({ s, theme }: { s: Extract<Section, { type: "dresscode" }>; theme: ExtrasTheme }) {
  const { editing, locale, update } = useEdit();
  const w = WORDS[locale];
  const colors = s.content.colors;
  if (!editing && !colors.length) return null;
  const set = (next: string[]) => update(s.id, { colors: next });
  return (
    <div className="flex flex-col items-center gap-4">
      <p className="text-[13px] font-semibold uppercase tracking-[0.18em]" style={{ fontFamily: SANS, color: theme.accent }}>
        {w.colors}
      </p>
      <ul className="flex flex-wrap justify-center gap-4">
        {colors.map((c, i) => (
          <li key={i} className="relative">
            <span className="block size-16 rounded-full @3xl:size-20" style={{ background: c, boxShadow: `0 0 0 1px ${theme.line}, 0 8px 18px -8px rgba(0,0,0,.35)` }} />
            {editing ? (
              <>
                <input type="color" value={c} onChange={(e) => set(colors.map((x, k) => (k === i ? e.target.value : x)))} aria-label={`Barva ${i + 1}`} className="absolute inset-0 size-full cursor-pointer rounded-full opacity-0" />
                <RemoveButton onClick={() => set(colors.filter((_, k) => k !== i))} label="Odebrat barvu" />
              </>
            ) : null}
          </li>
        ))}
        {editing && colors.length < 5 ? (
          <li>
            <button
              type="button"
              onClick={() => set([...colors, ["#c9b8a6", "#7d8b6a", "#2f3e5c", "#b76e79", "#e8dcc8"][colors.length] ?? "#cccccc"])}
              aria-label={w.addColor}
              title={w.addColor}
              className="grid size-16 place-items-center rounded-full border border-dashed text-[24px] opacity-70 hover:opacity-100 @3xl:size-20"
              style={{ borderColor: "currentColor", fontFamily: SANS }}
            >
              +
            </button>
          </li>
        ) : null}
      </ul>
      {editing ? <p className="text-[12px] opacity-60" style={{ fontFamily: SANS }}>Klepnutím na barvu ji změníte (1–5 barev).</p> : null}
    </div>
  );
}

function Photos({ s, theme, max, className = "", title = false, gallery = false }: { s: Extract<Section, { type: "dresscode" | "custom" | "gallery" }>; theme: ExtrasTheme; max: number; className?: string; title?: boolean; gallery?: boolean }) {
  const { editing, locale, update } = useEdit();
  const [open, setOpen] = useState<number | null>(null);
  const photos = s.content.photos;
  if (!editing && !photos.length) return null;
  const grid =
    gallery || photos.length > 4
      ? "grid grid-cols-2 gap-2 @xl:grid-cols-3 @3xl:gap-3 @5xl:grid-cols-4"
      : photos.length === 1 && !editing
        ? "mx-auto grid max-w-[640px] grid-cols-1"
        : "grid grid-cols-2 gap-3 @3xl:grid-cols-4";
  return (
    <div className={className}>
      {title ? (
        <p className="mb-4 text-center text-[13px] font-semibold uppercase tracking-[0.18em]" style={{ fontFamily: SANS, color: theme.accent }}>
          {WORDS[locale].inspiration}
        </p>
      ) : null}
      <PhotoGrid
        photos={photos}
        onChange={(next) => update(s.id, { photos: next })}
        max={max}
        className={grid}
        itemClass={`${photos.length === 1 && !editing && !gallery ? "aspect-[3/2]" : gallery ? "aspect-square" : "aspect-[4/5]"} ${theme.radius ?? ""}`}
        addLabel={gallery ? "Přidat fotky" : title ? "Přidat inspiraci" : "Přidat fotky"}
        onOpen={setOpen}
      />
      {open !== null ? <Lightbox photos={photos} index={open} onIndex={setOpen} locale={locale} /> : null}
    </div>
  );
}

/** Fotka přes celou obrazovku s listováním (šipky, Esc). */
function Lightbox({ photos, index, onIndex, locale }: { photos: string[]; index: number; onIndex: (i: number | null) => void; locale: Locale }) {
  const w = WORDS[locale];
  const n = photos.length;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onIndex(null);
      if (e.key === "ArrowRight") onIndex((index + 1) % n);
      if (e.key === "ArrowLeft") onIndex((index - 1 + n) % n);
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [index, n, onIndex]);
  const url = photoUrl(photos[index]);
  const btn = "grid size-12 place-items-center rounded-full bg-white/10 text-[22px] text-white hover:bg-white/20";
  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4" style={{ fontFamily: SANS }} onClick={() => onIndex(null)}>
      {url ? (
        <div className="relative h-[86vh] w-[92vw]" onClick={(e) => e.stopPropagation()}>
          <Image src={url} alt="" fill sizes="92vw" className="object-contain" />
        </div>
      ) : null}
      <button type="button" onClick={() => onIndex(null)} aria-label={w.close} className={`${btn} absolute right-4 top-4`}>
        ×
      </button>
      {n > 1 ? (
        <>
          <button type="button" onClick={(e) => (e.stopPropagation(), onIndex((index - 1 + n) % n))} aria-label={w.prev} className={`${btn} absolute left-4 top-1/2 -translate-y-1/2`}>
            ‹
          </button>
          <button type="button" onClick={(e) => (e.stopPropagation(), onIndex((index + 1) % n))} aria-label={w.next} className={`${btn} absolute right-4 top-1/2 -translate-y-1/2`}>
            ›
          </button>
          <p className="absolute bottom-4 left-1/2 -translate-x-1/2 text-[14px] text-white/70 tabular-nums">
            {index + 1} / {n}
          </p>
        </>
      ) : null}
    </div>
  );
}

function Menu({ s, theme, className = "" }: { s: Extract<Section, { type: "menu" }>; theme: ExtrasTheme; className?: string }) {
  const { editing, locale, update } = useEdit();
  const w = WORDS[locale];
  const courses = s.content.courses;
  const set = (next: SectionContent<"menu">["courses"]) => update(s.id, { courses: next });
  const patch = (i: number, p: Partial<(typeof courses)[number]>) => set(courses.map((x, k) => (k === i ? { ...x, ...p } : x)));
  const visible = editing ? courses : courses.filter((c) => hasText(c.name, locale) || hasText(c.dishes, locale));
  if (!visible.length && !editing) return null;
  return (
    <div className={className}>
      <ol className="flex flex-col text-center">
        {courses.map((c, i) =>
          !editing && !hasText(c.name, locale) && !hasText(c.dishes, locale) ? null : (
            <li key={i} className="relative flex flex-col items-center gap-2 border-t py-7 first:border-t-0 first:pt-0" style={{ borderColor: theme.line }}>
              <RemoveButton onClick={() => set(courses.filter((_, k) => k !== i))} label="Smazat chod" />
              <LineText value={c.name} onValue={(v) => patch(i, { name: v })} fallback={editing ? `${w.course} ${i + 1}` : lt(c.name, locale)} className="text-[13px] font-semibold uppercase tracking-[0.2em]" style={{ fontFamily: SANS, color: theme.accent }} />
              <RichText value={c.dishes} onValue={(v) => patch(i, { dishes: v })} placeholder={w.dishes} className="max-w-[46ch] text-[clamp(20px,3cqw,24px)] leading-snug" style={theme.display} />
            </li>
          ),
        )}
      </ol>
      {courses.length < 12 ? <AddButton onClick={() => set([...courses, { name: empty(), dishes: empty() }])}>{w.addCourse}</AddButton> : null}
    </div>
  );
}
