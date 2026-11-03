"use client";

import { normalizeSections } from "@/lib/site-sections";
import { EditProvider } from "./edit";
import type { SiteModel } from "./model";
import { SiteTemplate } from "./templates";

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

export function formatWeddingDate(date: string, locale: "cs" | "en" = "cs"): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Intl.DateTimeFormat(locale === "cs" ? "cs-CZ" : "en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(y, m - 1, d)));
}

export function daysUntil(date: string, now = new Date()): number {
  const [y, m, d] = date.split("-").map(Number);
  const target = Date.UTC(y, m - 1, d);
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((target - today) / 86_400_000);
}

/** Úvod webu v dané šabloně (náhled v průvodci založením a na přihlášení). */
export function SiteHero({ partner1, partner2, date, place, template, locale = "cs" }: Props) {
  const hero = normalizeSections([]).filter((s) => s.type === "hero");
  const model: SiteModel = {
    weddingId: "",
    partner1: partner1.trim() || " ",
    partner2: partner2.trim() || " ",
    date,
    timeZone: "Europe/Prague",
    locale,
    sections: hero,
    events: place ? [{ id: "e", name: "", description: "", starts_at: null, ends_at: null, location_name: place, address: null, plan_b_active: false, plan_b_location_name: null, plan_b_address: null }] : [],
    gifts: { iban: null, holder: null, qrSvg: null },
    rsvpDeadline: null,
    hidden: [],
    rsvp: null,
  };
  return (
    <EditProvider value={{ editing: false, locale, update: () => {}, upload: async () => null }}>
      <div className="pointer-events-none">
        <SiteTemplate template={template} model={model} />
      </div>
    </EditProvider>
  );
}
