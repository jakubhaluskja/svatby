"use client";

import type { CSSProperties, ReactNode } from "react";
import "@fontsource/pinyon-script/400.css";
import "@fontsource/bodoni-moda/400.css";
import "@fontsource/bodoni-moda/400-italic.css";
import "@fontsource/bodoni-moda/700.css";
import "@fontsource/instrument-serif/400.css";
import "@fontsource/instrument-serif/400-italic.css";
import "@fontsource/gloock/400.css";
import "@fontsource/caveat/400.css";
import "@fontsource/caveat/600.css";
import type { Locale } from "@/lib/i18n";
import { formatIban } from "@/lib/payment-qr";
import { GIFT_COPY, SECTION_TITLES } from "@/lib/site-copy";
import { lt, type LText, type Section, type SectionContent, type SectionType } from "@/lib/site-sections";
import { AddButton, FieldText, LineText, RemoveButton, RichText, hasText, useEdit } from "../edit";
import type { SiteModel, WebEvent } from "../model";

export const GRAIN =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence baseFrequency='.85' numOctaves='3' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 .55 0'/></filter><rect width='160' height='160' filter='url(%23n)'/></svg>\")";
export const grain: CSSProperties = { backgroundImage: GRAIN };

export const SANS = "var(--font-geist-sans), system-ui, sans-serif";

/** Sekce, které se mají zobrazit (v editoru i ty bez obsahu, aby šly vyplnit). */
export function useSections(model: SiteModel): Section[] {
  const { editing } = useEdit();
  return model.sections.filter((s) => s.enabled && !model.hidden.includes(s.type) && (editing || s.type === "hero" || s.type === "schedule" || s.type === "rsvp" || hasContent(s, model)));
}

function hasContent(s: Section, model: SiteModel): boolean {
  const loc = model.locale;
  switch (s.type) {
    case "story":
      return hasText(s.content.text, loc) || s.content.photos.length > 0;
    case "location":
      return hasText(s.content.text, loc) || !!s.content.photo;
    case "dresscode":
    case "accommodation":
      return hasText(s.content.text, loc);
    case "gifts":
      return hasText(s.content.text, loc) || (s.content.show_account && !!model.gifts.iban);
    case "faq":
      return s.content.items.some((i) => hasText(i.q, loc));
    case "contacts":
      return s.content.items.some((i) => i.name);
    default:
      return true;
  }
}

export function defaultTitle(type: SectionType, locale: Locale): string {
  if (type === "hero") return "";
  return SECTION_TITLES[locale][type as keyof (typeof SECTION_TITLES)["cs"]];
}

/** Nadpis sekce: vlastní, nebo výchozí; v editoru se dá přepsat. */
export function Title({ s, className = "", style, as = "h2" }: { s: Section; className?: string; style?: CSSProperties; as?: "h2" | "h3" | "p" | "span" }) {
  const { locale } = useEdit();
  const value = (s.content as { title?: LText }).title;
  return <LineText type={s.type} field="title" value={value} fallback={defaultTitle(s.type, locale)} as={as} className={className} style={style} />;
}

export function fmtDate(date: string | null, locale: Locale, opts: Intl.DateTimeFormatOptions): string | null {
  if (!date) return null;
  const [y, m, d] = date.split("-").map(Number);
  return new Intl.DateTimeFormat(locale === "cs" ? "cs-CZ" : "en-GB", { timeZone: "UTC", ...opts }).format(new Date(Date.UTC(y, m - 1, d)));
}

export function daysLeft(date: string | null): number | null {
  if (!date) return null;
  const [y, m, d] = date.split("-").map(Number);
  const now = new Date();
  return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())) / 86_400_000);
}

export function daysWord(n: number, locale: Locale) {
  if (locale === "en") return n === 1 ? "day" : "days";
  return n === 1 ? "den" : n >= 2 && n <= 4 ? "dny" : "dní";
}

export type When = { time: string | null; end: string | null; day: string | null };
export function when(e: WebEvent, locale: Locale, timeZone: string): When {
  if (!e.starts_at) return { time: null, end: null, day: null };
  const f = (iso: string, o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(locale === "cs" ? "cs-CZ" : "en-GB", { timeZone, ...o }).format(new Date(iso));
  return {
    time: f(e.starts_at, { hour: "2-digit", minute: "2-digit" }),
    end: e.ends_at ? f(e.ends_at, { hour: "2-digit", minute: "2-digit" }) : null,
    day: f(e.starts_at, { weekday: "long", day: "numeric", month: "long" }),
  };
}

export const place = (e: WebEvent) => (e.plan_b_active ? e.plan_b_location_name ?? e.location_name : e.location_name);
export const address = (e: WebEvent) => (e.plan_b_active ? e.plan_b_address ?? e.address : e.address);
export const mapUrl = (q: string) => `https://mapy.cz/?q=${encodeURIComponent(q)}`;

export const COPY = {
  cs: { planB: "Kvůli počasí jinde", map: "Mapa", noEvents: "Program doplníte v Událostech.", editEvents: "Program se skládá z vašich událostí.", editEventsLink: "Upravit události", addQ: "Přidat otázku", addContact: "Přidat kontakt", q: "Otázka", a: "Odpověď", name: "Jméno", role: "Kdo to je", phone: "Telefon", email: "E-mail" },
  en: { planB: "Moved due to weather", map: "Map", noEvents: "", editEvents: "", editEventsLink: "", addQ: "Add question", addContact: "Add contact", q: "Question", a: "Answer", name: "Name", role: "Role", phone: "Phone", email: "Email" },
} as const;

/** Upozornění v editoru u programu. */
export function EventsHint() {
  const { editing } = useEdit();
  if (!editing) return null;
  return (
    <p className="mt-6 text-center text-[14px] opacity-70" style={{ fontFamily: SANS, fontStyle: "normal" }}>
      {COPY.cs.editEvents}{" "}
      <a href="/app/udalosti" target="_blank" rel="noreferrer" className="underline">
        {COPY.cs.editEventsLink}
      </a>
    </p>
  );
}

/** Časté dotazy: rozbalovací otázky. */
export function FaqList({ s, className = "", qClass = "", aClass = "", lineColor, accent }: { s: Extract<Section, { type: "faq" }>; className?: string; qClass?: string; aClass?: string; lineColor: string; accent: string }) {
  const { editing, locale, update } = useEdit();
  const items = s.content.items;
  const set = (next: SectionContent<"faq">["items"]) => update("faq", { items: next });
  const c = COPY[locale];
  return (
    <div className={className}>
      {items.map((it, i) =>
        !editing && !hasText(it.q, locale) ? null : editing ? (
          <div key={i} className="relative border-t py-5 last:border-b" style={{ borderColor: lineColor }}>
            <RemoveButton onClick={() => set(items.filter((_, k) => k !== i))} label="Smazat otázku" />
            <LineText value={it.q} fallback="" onValue={(v) => set(items.map((x, k) => (k === i ? { ...x, q: v } : x)))} as="h3" className={qClass} />
            <RichText value={it.a} onValue={(v) => set(items.map((x, k) => (k === i ? { ...x, a: v } : x)))} className={`mt-2 ${aClass}`} placeholder={c.a} />
          </div>
        ) : (
          <details key={i} className="group border-t py-5 last:border-b" style={{ borderColor: lineColor }}>
            <summary className={`flex cursor-pointer list-none items-start justify-between gap-6 ${qClass}`}>
              {lt(it.q, locale)}
              <span aria-hidden className="mt-1 shrink-0 text-[1.2em] leading-none transition-transform group-open:rotate-45" style={{ color: accent }}>+</span>
            </summary>
            <RichText value={it.a} className={`mt-3 ${aClass}`} />
          </details>
        ),
      )}
      <AddButton onClick={() => set([...items, { q: { cs: locale === "cs" ? "Nová otázka" : "", en: locale === "en" ? "New question" : "" }, a: { cs: "", en: "" } }])}>{c.addQ}</AddButton>
    </div>
  );
}

/** Kontakty na svědky a koordinátory. */
export function ContactList({ s, className = "", itemClass = "", nameClass = "", accent }: { s: Extract<Section, { type: "contacts" }>; className?: string; itemClass?: string; nameClass?: string; accent: string }) {
  const { editing, locale, update } = useEdit();
  const items = s.content.items;
  const set = (next: SectionContent<"contacts">["items"]) => update("contacts", { items: next });
  const c = COPY[locale];
  const patch = (i: number, p: Partial<(typeof items)[number]>) => set(items.map((x, k) => (k === i ? { ...x, ...p } : x)));
  return (
    <div>
      <ul className={className}>
        {items.map((it, i) =>
          !editing && !it.name ? null : (
            <li key={i} className={`relative flex flex-col gap-1 ${itemClass}`}>
              <RemoveButton onClick={() => set(items.filter((_, k) => k !== i))} label="Smazat kontakt" />
              <FieldText value={it.name} onValue={(v) => patch(i, { name: v })} placeholder={c.name} className={nameClass} />
              <LineText value={it.role} onValue={(v) => patch(i, { role: v })} fallback={editing ? "" : ""} className="opacity-70" />
              {editing ? (
                <>
                  <FieldText value={it.phone} onValue={(v) => patch(i, { phone: v })} placeholder={c.phone} />
                  <FieldText value={it.email} onValue={(v) => patch(i, { email: v })} placeholder={c.email} />
                </>
              ) : (
                <>
                  {it.phone ? <a href={`tel:${it.phone.replace(/\s+/g, "")}`} className="underline underline-offset-4" style={{ color: accent }}>{it.phone}</a> : null}
                  {it.email ? <a href={`mailto:${it.email}`} className="underline underline-offset-4" style={{ color: accent }}>{it.email}</a> : null}
                </>
              )}
            </li>
          ),
        )}
      </ul>
      <AddButton onClick={() => set([...items, { name: "", role: { cs: "", en: "" }, phone: "", email: "" }])}>{c.addContact}</AddButton>
    </div>
  );
}

/** Číslo účtu s QR platbou. */
export function GiftAccount({ model, s, className = "", style, qrBg = "#fff" }: { model: SiteModel; s: Extract<Section, { type: "gifts" }>; className?: string; style?: CSSProperties; qrBg?: string }) {
  const { editing, locale } = useEdit();
  const g = GIFT_COPY[locale];
  if (!s.content.show_account) return null;
  if (!model.gifts.iban) {
    return editing ? (
      <p className="text-center text-[14px] opacity-70" style={{ fontFamily: SANS }}>
        Číslo účtu pro dary nastavíte <a href="/app/web/gifts" target="_blank" rel="noreferrer" className="underline">tady</a>.
      </p>
    ) : null;
  }
  return (
    <div className={`flex flex-col items-center gap-5 text-center @xl:flex-row @xl:text-left ${className}`} style={style}>
      {model.gifts.qrSvg ? <div className="w-36 shrink-0 p-2" style={{ background: qrBg }} dangerouslySetInnerHTML={{ __html: model.gifts.qrSvg }} /> : null}
      <div className="flex flex-col gap-1">
        <span className="text-[0.85em] opacity-70">{g.account}</span>
        <span className="text-[1.15em] tabular-nums" style={{ fontFamily: SANS, letterSpacing: "0.02em" }}>{formatIban(model.gifts.iban)}</span>
        {model.gifts.holder ? <span className="opacity-70">{g.holder}: {model.gifts.holder}</span> : null}
        <span className="mt-2 text-[0.85em] opacity-70">{g.qr}</span>
      </div>
    </div>
  );
}

/** Oblast formuláře potvrzení účasti (v editoru jen ukázka). */
export function RsvpSlot({ model }: { model: SiteModel }): ReactNode {
  const { editing } = useEdit();
  if (editing) {
    return (
      <div className="mx-auto max-w-md rounded-xl border border-dashed px-6 py-8 text-center text-[15px] opacity-70" style={{ fontFamily: SANS, borderColor: "currentColor" }}>
        Tady hosté potvrdí účast. Každá domácnost má svůj odkaz, nebo zadá kód z pozvánky.
      </div>
    );
  }
  return model.rsvp;
}

/** Text sekce s nadpisem a obsahem (místo, dress code, ubytování). */
export function textOf(s: Section): LText | undefined {
  return (s.content as { text?: LText }).text;
}

export function useLocaleText(v: LText | undefined) {
  const { locale } = useEdit();
  return lt(v, locale);
}
