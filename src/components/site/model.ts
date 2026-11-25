import type { ReactNode } from "react";
import type { Locale } from "@/lib/i18n";
import type { Section } from "@/lib/site-sections";

/** Událost pro svatební web (bez serverových závislostí). */
export type WebEvent = {
  id: string;
  name: string;
  description: string;
  starts_at: string | null;
  ends_at: string | null;
  location_name: string | null;
  address: string | null;
  plan_b_active: boolean;
  plan_b_location_name: string | null;
  plan_b_address: string | null;
};

/** Dar ze seznamu na webu (pohled hosta). */
export type WebGift = {
  id: string;
  kind: "item" | "fund" | "group";
  title: string;
  description: string;
  url: string | null;
  price: number | null;
  image: string | null;
  target: number | null;
  /** Přislíbeno celkem (jen když to pár zobrazuje nebo jde o skupinový dar) */
  raised: number | null;
  contributors: string[];
  reserved: boolean;
  /** Rezervace / příspěvek této domácnosti */
  mine: boolean;
  myAmount: number;
};

/** Seznam darů a kontext hosta (osobní odkaz) pro rezervace. */
export type GiftList = { items: WebGift[]; site: string | null; token: string | null; hasAccount: boolean };

/** Vše, co šablona potřebuje k vykreslení webu. */
export type SiteModel = {
  weddingId: string;
  partner1: string;
  partner2: string;
  /** YYYY-MM-DD */
  date: string | null;
  timeZone: string;
  locale: Locale;
  sections: Section[];
  events: WebEvent[];
  gifts: { iban: string | null; holder: string | null; qrSvg: string | null };
  giftList?: GiftList;
  /** Uzávěrka odpovědí (ISO) */
  rsvpDeadline: string | null;
  /** Sekce skryté za heslem */
  hidden: string[];
  /** Obsah sekce Potvrzení účasti (formulář nebo kód z pozvánky) */
  rsvp: ReactNode;
  /** Osobní informace domácnosti nad webem (stůl) */
  banner?: ReactNode;
  /** Souřadnice místa pro hvězdnou mapu */
  coords?: { lat: number; lon: number } | null;
};
