import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { tr, type Locale } from "@/lib/i18n";

export type RsvpStatus = "pending" | "yes" | "no";

export type EventInfo = {
  id: string;
  name: string;
  name_json: Record<string, string>;
  starts_at: string | null;
  ends_at: string | null;
  location_name: string | null;
  address: string | null;
  description_json: Record<string, string>;
  visibility: "public" | "invited";
  is_seated: boolean;
};

export type AgeCategory = { id: string; label: string; is_adult: boolean; min_age: number | null; max_age: number | null };

export type GuestRow = {
  id: string;
  household_id: string;
  first_name: string;
  last_name: string | null;
  age_category_id: string | null;
  needs_high_chair: boolean;
  is_plus_one: boolean;
  diet: string | null;
  allergies: string | null;
  email: string | null;
  notes: string | null;
  tags: string[];
  responses: Record<string, RsvpStatus>;
};

export type HouseholdRow = {
  id: string;
  name: string;
  token: string;
  short_code: string;
  locale: Locale;
  email: string | null;
  plus_ones_allowed: number;
  notes: string | null;
  needs_lodging: boolean | null;
  lodging_note: string | null;
  song_wish: string | null;
  message: string | null;
  rsvp_submitted_at: string | null;
  event_ids: string[];
  guests: GuestRow[];
};

export type GuestBook = {
  events: EventInfo[];
  categories: AgeCategory[];
  tags: string[];
  households: HouseholdRow[];
};

/** Kompletní seznam hostů svatby pro administraci a exporty. */
export async function loadGuestBook(db: SupabaseClient, weddingId: string, householdId?: string): Promise<GuestBook> {
  let householdsQuery = db
    .from("households")
    .select(
      "id, name, token, short_code, locale, email, plus_ones_allowed, notes, needs_lodging, lodging_note, song_wish, message, rsvp_submitted_at",
    )
    .eq("wedding_id", weddingId)
    .order("sort");
  let guestsQuery = db
    .from("guests")
    .select("id, household_id, first_name, last_name, age_category_id, needs_high_chair, is_plus_one, diet, allergies, email, notes")
    .eq("wedding_id", weddingId)
    .order("sort");
  let invitesQuery = db.from("household_events").select("household_id, event_id").eq("wedding_id", weddingId);
  if (householdId) {
    householdsQuery = householdsQuery.eq("id", householdId);
    guestsQuery = guestsQuery.eq("household_id", householdId);
    invitesQuery = invitesQuery.eq("household_id", householdId);
  }

  const [events, categories, tags, households, guests, invites, responses, guestTags] = await Promise.all([
    db
      .from("events")
      .select("id, name, starts_at, ends_at, location_name, address, description, visibility, is_seated")
      .eq("wedding_id", weddingId)
      .order("starts_at", { ascending: true, nullsFirst: false })
      .order("sort"),
    db.from("age_categories").select("id, name, is_adult, min_age, max_age").eq("wedding_id", weddingId).order("sort"),
    db.from("tags").select("id, name").eq("wedding_id", weddingId).order("name"),
    householdsQuery,
    guestsQuery,
    invitesQuery,
    db.from("rsvp_responses").select("guest_id, event_id, status").eq("wedding_id", weddingId),
    db.from("guest_tags").select("guest_id, tag_id").eq("wedding_id", weddingId),
  ]);

  const tagNames = new Map((tags.data ?? []).map((t) => [t.id as string, t.name as string]));
  const tagsByGuest = new Map<string, string[]>();
  for (const gt of guestTags.data ?? []) {
    const list = tagsByGuest.get(gt.guest_id) ?? [];
    const name = tagNames.get(gt.tag_id);
    if (name) list.push(name);
    tagsByGuest.set(gt.guest_id, list);
  }

  const responsesByGuest = new Map<string, Record<string, RsvpStatus>>();
  for (const r of responses.data ?? []) {
    const map = responsesByGuest.get(r.guest_id) ?? {};
    map[r.event_id] = r.status as RsvpStatus;
    responsesByGuest.set(r.guest_id, map);
  }

  const eventsByHousehold = new Map<string, string[]>();
  for (const i of invites.data ?? []) {
    const list = eventsByHousehold.get(i.household_id) ?? [];
    list.push(i.event_id);
    eventsByHousehold.set(i.household_id, list);
  }

  const guestsByHousehold = new Map<string, GuestRow[]>();
  for (const g of guests.data ?? []) {
    const list = guestsByHousehold.get(g.household_id) ?? [];
    list.push({ ...g, tags: tagsByGuest.get(g.id) ?? [], responses: responsesByGuest.get(g.id) ?? {} } as GuestRow);
    guestsByHousehold.set(g.household_id, list);
  }

  return {
    events: (events.data ?? []).map((e) => ({
      ...e,
      name: tr(e.name),
      name_json: (e.name ?? {}) as Record<string, string>,
      description_json: (e.description ?? {}) as Record<string, string>,
    })) as EventInfo[],
    categories: (categories.data ?? []).map((c) => ({
      id: c.id,
      label: tr(c.name),
      is_adult: c.is_adult,
      min_age: c.min_age,
      max_age: c.max_age,
    })),
    tags: (tags.data ?? []).map((t) => t.name as string),
    households: (households.data ?? []).map((h) => ({
      ...h,
      event_ids: eventsByHousehold.get(h.id) ?? [],
      guests: guestsByHousehold.get(h.id) ?? [],
    })) as HouseholdRow[],
  };
}

/** Stav odpovědi hosta na událost, na kterou je jeho domácnost pozvaná. */
export function guestStatus(h: HouseholdRow, g: GuestRow, eventId: string): RsvpStatus | null {
  if (!h.event_ids.includes(eventId)) return null;
  return g.responses[eventId] ?? "pending";
}

export type EventSummary = {
  event: EventInfo;
  yes: number;
  no: number;
  pending: number;
  byCategory: Map<string | null, number>;
};

/** Počty pro dashboard a catering: kdo přijde na kterou událost, po věkových kategoriích. */
export function summarize(book: GuestBook): EventSummary[] {
  return book.events.map((event) => {
    const s: EventSummary = { event, yes: 0, no: 0, pending: 0, byCategory: new Map() };
    for (const h of book.households) {
      for (const g of h.guests) {
        const status = guestStatus(h, g, event.id);
        if (!status) continue;
        s[status]++;
        if (status === "yes") s.byCategory.set(g.age_category_id, (s.byCategory.get(g.age_category_id) ?? 0) + 1);
      }
    }
    return s;
  });
}

export function guestName(g: { first_name: string; last_name: string | null }): string {
  return [g.first_name, g.last_name].filter(Boolean).join(" ");
}

export type DietNote = { guest: string; household: string; diet: string | null; allergies: string | null; category: string | null };

/** Strava a alergie potvrzených hostů dané události (pro catering). */
export function dietNotes(book: GuestBook, eventId: string): DietNote[] {
  const category = new Map(book.categories.map((c) => [c.id, c.label]));
  const out: DietNote[] = [];
  for (const h of book.households) {
    for (const g of h.guests) {
      if (guestStatus(h, g, eventId) !== "yes" || (!g.diet && !g.allergies)) continue;
      out.push({
        guest: guestName(g),
        household: h.name,
        diet: g.diet,
        allergies: g.allergies,
        category: g.age_category_id ? category.get(g.age_category_id) ?? null : null,
      });
    }
  }
  return out;
}

/** Počet potvrzených židliček pro děti na událost. */
export function highChairs(book: GuestBook, eventId: string): number {
  let n = 0;
  for (const h of book.households) for (const g of h.guests) if (g.needs_high_chair && guestStatus(h, g, eventId) === "yes") n++;
  return n;
}
