import "server-only";
import QRCode from "qrcode";
import type { ReactNode } from "react";
import type { SiteModel, WebEvent } from "@/components/site/model";
import type { Locale } from "@/lib/i18n";
import { spayd } from "@/lib/payment-qr";
import type { PublicWedding, SiteContent, SiteEvent } from "@/lib/site";
import { GIFT_COPY } from "@/lib/site-copy";

export function toWebEvents(events: SiteEvent[]): WebEvent[] {
  return events.map((e) => ({
    id: e.id,
    name: e.name,
    description: e.description,
    starts_at: e.starts_at,
    ends_at: e.ends_at,
    location_name: e.location_name,
    address: e.address,
    plan_b_active: e.plan_b_active,
    plan_b_location_name: e.plan_b_location_name,
    plan_b_address: e.plan_b_address,
  }));
}

export async function giftQr(iban: string | null, locale: Locale): Promise<string | null> {
  if (!iban) return null;
  return QRCode.toString(spayd({ iban, message: GIFT_COPY[locale].message }), { type: "svg", margin: 0, errorCorrectionLevel: "M" });
}

/** Data pro šablonu svatebního webu. */
export async function buildSiteModel(
  wedding: Pick<PublicWedding, "id" | "partner1_name" | "partner2_name" | "wedding_date" | "timezone" | "rsvp_deadline">,
  content: SiteContent,
  events: SiteEvent[],
  locale: Locale,
  opts: { rsvp: ReactNode; banner?: ReactNode; hidden?: string[] },
): Promise<SiteModel> {
  return {
    weddingId: wedding.id,
    partner1: wedding.partner1_name,
    partner2: wedding.partner2_name,
    date: wedding.wedding_date,
    timeZone: wedding.timezone,
    locale,
    sections: content.sections,
    events: toWebEvents(events),
    gifts: { iban: content.gifts.iban, holder: content.gifts.holder, qrSvg: await giftQr(content.gifts.iban, locale) },
    rsvpDeadline: wedding.rsvp_deadline,
    hidden: opts.hidden ?? [],
    rsvp: opts.rsvp,
    banner: opts.banner,
    coords: null,
  };
}
