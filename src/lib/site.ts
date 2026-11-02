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
  starts_at: string | null;
  ends_at: string | null;
  location_name: string | null;
  address: string | null;
  plan_b_active: boolean;
  plan_b_location_name: string | null;
  plan_b_address: string | null;
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
};

function toSiteEvent(e: EventRow, locale: Locale): SiteEvent {
  return {
    id: e.id,
    name: tr(e.name, locale),
    description: tr(e.description, locale),
    starts_at: e.starts_at,
    ends_at: e.ends_at,
    location_name: e.location_name,
    address: e.address,
    plan_b_active: e.plan_b_active,
    plan_b_location_name: e.plan_b_location_name,
    plan_b_address: e.plan_b_address,
  };
}

const EVENT_FIELDS =
  "id, name, description, starts_at, ends_at, location_name, address, visibility, plan_b_active, plan_b_location_name, plan_b_address";

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
