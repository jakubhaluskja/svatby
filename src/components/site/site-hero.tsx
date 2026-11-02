import type { CSSProperties } from "react";
import { getTemplate } from "@/lib/templates";

type Props = {
  partner1: string;
  partner2: string;
  /** ISO datum YYYY-MM-DD nebo null, když ho pár ještě nezná */
  date: string | null;
  place?: string | null;
  template: string;
  locale?: "cs" | "en";
  /** Kompaktní varianta pro náhled v telefonu */
  compact?: boolean;
};

const copy = {
  cs: { dateUnknown: "Datum brzy oznámíme", daysLeft: (n: number) => `Zbývá ${n} ${n === 1 ? "den" : n < 5 ? "dny" : "dní"}`, today: "Dnes je ten den" },
  en: { dateUnknown: "Date to be announced", daysLeft: (n: number) => `${n} ${n === 1 ? "day" : "days"} to go`, today: "Today is the day" },
};

export function formatWeddingDate(date: string, locale: "cs" | "en" = "cs"): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Intl.DateTimeFormat(locale === "cs" ? "cs-CZ" : "en-GB", { day: "numeric", month: "long", year: "numeric" })
    .format(new Date(Date.UTC(y, m - 1, d)));
}

export function daysUntil(date: string, now = new Date()): number {
  const [y, m, d] = date.split("-").map(Number);
  const target = Date.UTC(y, m - 1, d);
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((target - today) / 86_400_000);
}

/** Úvodní sekce svatebního webu. Sdílí ji web, náhled v editoru i průvodce založením. */
export function SiteHero({ partner1, partner2, date, place, template, locale = "cs", compact }: Props) {
  const t = getTemplate(template);
  const c = copy[locale];
  const days = date ? daysUntil(date) : null;

  const style = {
    "--site-bg": t.colors.background,
    "--site-text": t.colors.text,
    "--site-muted": t.colors.muted,
    "--site-accent": t.colors.accent,
    "--site-line": t.colors.line,
    background: "var(--site-bg)",
    color: "var(--site-text)",
    fontFamily: t.bodyFont,
  } as CSSProperties;

  const nameStyle: CSSProperties = {
    fontFamily: t.displayFont,
    fontStyle: t.displayStyle,
    fontWeight: t.displayWeight,
  };

  const names = [partner1.trim(), partner2.trim()];

  return (
    <section
      style={style}
      className={`flex flex-col items-center justify-center text-center transition-colors duration-500 ${
        compact ? "min-h-full px-6 py-16" : "min-h-[85svh] px-6 py-24"
      }`}
    >
      <h1
        style={nameStyle}
        className={`flex flex-col leading-[0.95] tracking-tight ${compact ? "gap-1 text-[2.6rem]" : "gap-2 text-6xl sm:text-8xl"}`}
      >
        <span>{names[0] || " "}</span>
        <span aria-hidden className={`${compact ? "text-2xl" : "text-4xl sm:text-5xl"}`} style={{ color: "var(--site-accent)" }}>
          &amp;
        </span>
        <span>{names[1] || " "}</span>
      </h1>

      <div className={`flex flex-col items-center ${compact ? "mt-8 gap-1" : "mt-12 gap-2"}`}>
        <p className={compact ? "text-base" : "text-xl sm:text-2xl"}>
          {date ? formatWeddingDate(date, locale) : c.dateUnknown}
        </p>
        {place ? <p style={{ color: "var(--site-muted)" }} className={compact ? "text-sm" : "text-lg"}>{place}</p> : null}
      </div>

      {days !== null && days >= 0 ? (
        <p
          className={`border-t pt-3 ${compact ? "mt-8 text-xs" : "mt-14 text-sm"}`}
          style={{ borderColor: "var(--site-line)", color: "var(--site-muted)" }}
        >
          {days === 0 ? c.today : c.daysLeft(days)}
        </p>
      ) : null}
    </section>
  );
}
