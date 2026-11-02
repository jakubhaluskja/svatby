import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { appDomain } from "@/lib/env";
import { parseHost } from "@/lib/hosts";
import { tr, type Locale } from "@/lib/i18n";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type PublicWedding = {
  id: string;
  slug: string;
  partner1_name: string;
  partner2_name: string;
  wedding_date: string | null;
  timezone: string;
  default_locale: Locale;
  locales: string[];
  template: string;
  status: "draft" | "published" | "expired" | "deleted";
  web_expires_at: string | null;
  password_scope: "none" | "site" | "sections";
  rsvp_deadline: string | null;
  /** Náhled konceptu pro člena týmu svatby – hosté ho nevidí. */
  preview: boolean;
};

const FIELDS =
  "id, slug, partner1_name, partner2_name, wedding_date, timezone, default_locale, locales, template, status, web_expires_at, password_scope, rsvp_deadline";

/** Parametr route /site/[site]: slug, nebo hostname vlastní domény (obsahuje tečku). */
export function isCustomDomainParam(site: string): boolean {
  return site.includes(".");
}

/**
 * Najde svatbu podle slugu nebo ověřené vlastní domény.
 * Hosté vidí jen zveřejněný web; přihlášený člen týmu i koncept (náhled).
 * Čte s tajným klíčem, proto vrací jen veřejně bezpečná pole.
 */
export const resolveWedding = cache(async (siteParam: string): Promise<PublicWedding | null> => {
  const site = decodeURIComponent(siteParam).toLowerCase();
  const db = createAdminClient();

  let weddingId: string | null = null;
  if (isCustomDomainParam(site)) {
    const { data } = await db.from("custom_domains").select("wedding_id").eq("hostname", site).eq("status", "verified").maybeSingle();
    weddingId = data?.wedding_id ?? null;
    if (!weddingId) return null;
  }

  const query = db.from("weddings").select(FIELDS);
  const { data: w } = await (weddingId ? query.eq("id", weddingId) : query.eq("slug", site)).maybeSingle();
  if (!w || w.status === "deleted") return null;

  const live = w.status === "published" && (!w.web_expires_at || new Date(w.web_expires_at) > new Date());
  if (live) return { ...w, preview: false } as PublicWedding;
  if (await isMemberOf(w.id)) return { ...w, preview: true } as PublicWedding;
  return null;
});

async function isMemberOf(weddingId: string): Promise<boolean> {
  try {
    const supabase = await createClient();
    const { data } = await supabase.from("weddings").select("id").eq("id", weddingId).maybeSingle();
    return !!data;
  } catch {
    return false;
  }
}

/**
 * Základ adres uvnitř webu: na subdoméně nebo vlastní doméně „“,
 * na doméně aplikace (Vercel náhled, vývoj) „/site/<slug>“.
 */
export async function siteBase(siteParam: string): Promise<string> {
  const h = await headers();
  const target = parseHost(h.get("host"), appDomain());
  return target.kind === "app" ? `/site/${siteParam}` : "";
}

export type SiteEvent = {
  id: string;
  name: string;
  description: string;
  /** Původní lokalizované texty pro přepnutí jazyka */
  i18n: { name: unknown; description: unknown; plan_b_note: unknown };
  starts_at: string | null;
  ends_at: string | null;
  location_name: string | null;
  address: string | null;
  plan_b_active: boolean;
  plan_b_location_name: string | null;
  plan_b_address: string | null;
  plan_b_note: string;
};

type EventRow = {
  id: string;
  name: unknown;
  description: unknown;
  starts_at: string | null;
  ends_at: string | null;
  location_name: string | null;
  address: string | null;
  visibility: string;
  plan_b_active: boolean;
  plan_b_location_name: string | null;
  plan_b_address: string | null;
  plan_b_note: unknown;
};

function toSiteEvent(e: EventRow, locale: Locale): SiteEvent {
  return {
    id: e.id,
    name: tr(e.name, locale),
    description: tr(e.description, locale),
    i18n: { name: e.name, description: e.description, plan_b_note: e.plan_b_note },
    starts_at: e.starts_at,
    ends_at: e.ends_at,
    location_name: e.location_name,
    address: e.address,
    plan_b_active: e.plan_b_active,
    plan_b_location_name: e.plan_b_location_name,
    plan_b_address: e.plan_b_address,
    plan_b_note: tr(e.plan_b_note, locale),
  };
}

const EVENT_FIELDS =
  "id, name, description, starts_at, ends_at, location_name, address, visibility, plan_b_active, plan_b_location_name, plan_b_address, plan_b_note";

/** Přeloží události do jazyka stránky. */
export function localizeEvents<T extends SiteEvent>(events: T[], locale: Locale): T[] {
  return events.map((e) => ({
    ...e,
    name: tr(e.i18n.name, locale),
    description: tr(e.i18n.description, locale),
    plan_b_note: tr(e.i18n.plan_b_note, locale),
  }));
}

/** Veřejné události (pro web bez osobního odkazu). */
export async function publicEvents(weddingId: string, locale: Locale): Promise<SiteEvent[]> {
  const db = createAdminClient();
  const { data } = await db
    .from("events")
    .select(EVENT_FIELDS)
    .eq("wedding_id", weddingId)
    .eq("visibility", "public")
    .order("starts_at", { ascending: true, nullsFirst: false })
    .order("sort");
  return ((data ?? []) as EventRow[]).map((e) => toSiteEvent(e, locale));
}

export type GuestHousehold = {
  id: string;
  name: string;
  token: string;
  locale: Locale;
  email: string | null;
  plus_ones_allowed: number;
  needs_lodging: boolean | null;
  lodging_note: string | null;
  song_wish: string | null;
  message: string | null;
  rsvp_submitted_at: string | null;
  guests: {
    id: string;
    first_name: string;
    last_name: string | null;
    is_plus_one: boolean;
    diet: string | null;
    allergies: string | null;
    responses: Record<string, "pending" | "yes" | "no">;
  }[];
  /** Události, na které je domácnost pozvaná, a veřejné události */
  events: (SiteEvent & { invited: boolean })[];
  categories: { id: string; label: string; is_adult: boolean }[];
};

/** Domácnost podle osobního odkazu (ověření tokenem, čtení s tajným klíčem). */
export async function householdByToken(weddingId: string, token: string): Promise<GuestHousehold | null> {
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) return null;
  const db = createAdminClient();
  const { data: h } = await db
    .from("households")
    .select("id, name, token, locale, email, plus_ones_allowed, needs_lodging, lodging_note, song_wish, message, rsvp_submitted_at")
    .eq("wedding_id", weddingId)
    .eq("token", token)
    .maybeSingle();
  if (!h) return null;

  const locale = (h.locale as Locale) ?? "cs";
  const [{ data: guests }, { data: invites }, { data: events }, { data: categories }] = await Promise.all([
    db
      .from("guests")
      .select("id, first_name, last_name, is_plus_one, diet, allergies")
      .eq("household_id", h.id)
      .order("sort"),
    db.from("household_events").select("event_id").eq("household_id", h.id),
    db
      .from("events")
      .select(EVENT_FIELDS)
      .eq("wedding_id", weddingId)
      .order("starts_at", { ascending: true, nullsFirst: false })
      .order("sort"),
    db.from("age_categories").select("id, name, is_adult").eq("wedding_id", weddingId).order("sort"),
  ]);

  const invited = new Set((invites ?? []).map((i) => i.event_id as string));
  const guestIds = (guests ?? []).map((g) => g.id);
  const { data: responses } = guestIds.length
    ? await db.from("rsvp_responses").select("guest_id, event_id, status").in("guest_id", guestIds)
    : { data: [] };

  const byGuest = new Map<string, Record<string, "pending" | "yes" | "no">>();
  for (const r of responses ?? []) {
    const map = byGuest.get(r.guest_id) ?? {};
    map[r.event_id] = r.status;
    byGuest.set(r.guest_id, map);
  }

  return {
    ...h,
    locale,
    guests: (guests ?? []).map((g) => ({ ...g, responses: byGuest.get(g.id) ?? {} })),
    events: ((events ?? []) as EventRow[])
      .filter((e) => invited.has(e.id) || e.visibility === "public")
      .map((e) => ({ ...toSiteEvent(e, locale), invited: invited.has(e.id) })),
    categories: (categories ?? []).map((c) => ({ id: c.id, label: tr(c.name, locale), is_adult: c.is_adult })),
  };
}

/** Kód z pozvánky → osobní odkaz. */
export async function tokenByShortCode(weddingId: string, code: string): Promise<string | null> {
  const normalized = code.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (normalized.length !== 6) return null;
  const db = createAdminClient();
  const { data } = await db.from("households").select("token").eq("wedding_id", weddingId).eq("short_code", normalized).maybeSingle();
  return data?.token ?? null;
}

export type SiteContent = {
  sections: import("@/lib/site-sections").Section[];
  template: string;
  gifts: { iban: string | null; holder: string | null };
};

/** Obsah webu: hosté vidí zveřejněnou verzi, náhled páru koncept. */
export async function siteContent(wedding: PublicWedding): Promise<SiteContent> {
  const { normalizeSections } = await import("@/lib/site-sections");
  const db = createAdminClient();
  const [{ data: pages }, { data: gifts }] = await Promise.all([
    db.from("site_pages").select("state, sections, template").eq("wedding_id", wedding.id),
    db.from("gift_settings").select("iban, account_holder").eq("wedding_id", wedding.id).maybeSingle(),
  ]);
  const draft = pages?.find((p) => p.state === "draft");
  const published = pages?.find((p) => p.state === "published");
  const page = wedding.preview ? draft ?? published : published ?? draft;
  return {
    sections: normalizeSections(page?.sections),
    template: page?.template ?? wedding.template,
    gifts: { iban: gifts?.iban ?? null, holder: gifts?.account_holder ?? null },
  };
}

/** Jazyk stránky: ?lang=en, pokud ho web nabízí; jinak jazyk domácnosti nebo výchozí. */
export function pickLocale(wedding: PublicWedding, requested: string | undefined, fallback?: Locale): Locale {
  if ((requested === "cs" || requested === "en") && wedding.locales.includes(requested)) return requested;
  if (fallback && wedding.locales.includes(fallback)) return fallback;
  return wedding.default_locale;
}

export type SiteAccess = { locked: boolean; hidden: string[] };

/**
 * Ochrana heslem. Celý web, nebo jen vybrané sekce. Osobní odkaz domácnosti heslo obchází.
 */
export async function siteAccess(wedding: PublicWedding, viaHouseholdLink: boolean): Promise<SiteAccess> {
  if (wedding.password_scope === "none" || viaHouseholdLink || wedding.preview) return { locked: false, hidden: [] };
  const { cookies } = await import("next/headers");
  const { isUnlocked, unlockCookieName } = await import("@/lib/site-password");
  const db = createAdminClient();
  const { data } = await db.from("weddings").select("password_hash, protected_sections").eq("id", wedding.id).single();
  const jar = await cookies();
  if (isUnlocked(wedding.id, data?.password_hash ?? null, jar.get(unlockCookieName(wedding.id))?.value)) {
    return { locked: false, hidden: [] };
  }
  if (wedding.password_scope === "site") return { locked: true, hidden: [] };
  return { locked: false, hidden: data?.protected_sections ?? [] };
}

/**
 * Oznámení nahoře na webu: aktivní plán B a zprávy hostům.
 * Zprávy pro konkrétní událost vidí jen domácnosti, které jsou na ni pozvané.
 */
export async function siteNotices(
  wedding: PublicWedding,
  events: SiteEvent[],
  locale: Locale,
  invitedEventIds: string[] | null,
): Promise<string[]> {
  const { SITE_COPY } = await import("@/lib/site-copy");
  const notices: string[] = [];
  for (const e of events) {
    if (!e.plan_b_active) continue;
    const where = [e.plan_b_location_name, e.plan_b_address].filter(Boolean).join(", ");
    notices.push(`${SITE_COPY[locale].planB}: ${e.name}${where ? ` → ${where}` : ""}.${e.plan_b_note ? ` ${e.plan_b_note}` : ""}`);
  }

  const db = createAdminClient();
  const now = new Date().toISOString();
  const { data } = await db
    .from("broadcasts")
    .select("body, audience, event_id, scheduled_at")
    .eq("wedding_id", wedding.id)
    .eq("kind", "message")
    .eq("show_banner", true)
    .lte("scheduled_at", now)
    .or(`banner_until.is.null,banner_until.gt.${now}`)
    .order("scheduled_at", { ascending: false })
    .limit(3);
  for (const m of data ?? []) {
    if (m.audience === "event" && !(invitedEventIds ?? []).includes(m.event_id)) continue;
    const text = tr(m.body, locale);
    if (text) notices.push(text);
  }
  return notices;
}

export type GuestTable = { event: string; guest: string; table: string };

/**
 * Stůl hosta se zobrazí v den události od půlnoci (v časovém pásmu svatby).
 */
export async function householdTables(wedding: PublicWedding, household: GuestHousehold, locale: Locale, now = new Date()): Promise<GuestTable[]> {
  const { utcToZonedParts } = await import("@/lib/time");
  const today = utcToZonedParts(now.toISOString(), wedding.timezone).date;
  const eventsToday = household.events.filter((e) => e.invited && e.starts_at && utcToZonedParts(e.starts_at, wedding.timezone).date <= today);
  if (eventsToday.length === 0 || household.guests.length === 0) return [];

  const db = createAdminClient();
  const { data } = await db
    .from("seat_assignments")
    .select("guest_id, event_id, layout_items(label)")
    .in("event_id", eventsToday.map((e) => e.id))
    .in("guest_id", household.guests.map((g) => g.id));

  const eventName = new Map(localizeEvents(eventsToday, locale).map((e) => [e.id, e.name]));
  const guestName = new Map(household.guests.map((g) => [g.id, g.first_name]));
  return (data ?? []).map((row) => ({
    event: eventName.get(row.event_id) ?? "",
    guest: guestName.get(row.guest_id) ?? "",
    table: ((row.layout_items as unknown as { label: string | null } | null)?.label ?? "").trim(),
  }));
}
