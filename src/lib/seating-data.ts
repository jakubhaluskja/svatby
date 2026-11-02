import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { guestName, guestStatus, loadGuestBook } from "@/lib/guest-data";

export type LayoutItem = {
  id: string;
  kind: "table" | "decor";
  shape: string;
  label: string | null;
  seats: number;
  x: number;
  y: number;
  w: number;
  h: number;
  rotation: number;
  sort: number;
};

export type SeatingGuest = {
  id: string;
  name: string;
  household_id: string;
  household: string;
  category: string | null;
  tags: string[];
  diet: string | null;
  allergies: string | null;
  high_chair: boolean;
  /** Odpověď na událost: přijde / čeká na odpověď / nepřijde */
  status: "yes" | "pending" | "no";
  attending: boolean;
};

export type SeatingRuleRow = { id: string; kind: "together" | "apart" | "fixed_table"; guest_ids: string[]; table_id: string | null };

export type SeatingData = {
  event: { id: string; name: string; starts_at: string | null };
  layout: { id: string | null; width: number; height: number; background_key: string | null };
  items: LayoutItem[];
  assignments: { guest_id: string; table_id: string; seat_index: number | null; locked: boolean }[];
  guests: SeatingGuest[];
  rules: SeatingRuleRow[];
  tags: string[];
};

/**
 * Data pro zasedací pořádek jedné události: stoly, rozsazení a hosté.
 * Hosté = pozvaní na událost, kteří neodmítli (potvrzení i bez odpovědi)
 * + ti, kdo už u stolu sedí (i kdyby mezitím odmítli).
 */
export async function loadSeating(db: SupabaseClient, weddingId: string, eventId: string): Promise<SeatingData | null> {
  const book = await loadGuestBook(db, weddingId);
  const event = book.events.find((e) => e.id === eventId);
  if (!event) return null;

  const { data: layout } = await db
    .from("venue_layouts")
    .select("id, width, height, background_key")
    .eq("event_id", eventId)
    .maybeSingle();

  const [{ data: items }, { data: assignments }, { data: rules }] = await Promise.all([
    layout
      ? db.from("layout_items").select("id, kind, shape, label, seats, x, y, w, h, rotation, sort").eq("layout_id", layout.id).order("sort")
      : Promise.resolve({ data: [] }),
    db.from("seat_assignments").select("guest_id, table_id, seat_index, locked").eq("event_id", eventId),
    db.from("seating_rules").select("id, kind, guest_ids, table_id, event_id").eq("wedding_id", weddingId),
  ]);

  const assigned = new Set((assignments ?? []).map((a) => a.guest_id));
  const category = new Map(book.categories.map((c) => [c.id, c.label]));
  const guests: SeatingGuest[] = [];
  for (const h of book.households) {
    for (const g of h.guests) {
      // Sedí-li u stolu host, jehož domácnost už na událost pozvaná není, bereme ho jako odmítnutého.
      const status = guestStatus(h, g, eventId) ?? (assigned.has(g.id) ? "no" : null);
      if (!status) continue;
      if (status === "no" && !assigned.has(g.id)) continue;
      guests.push({
        id: g.id,
        name: guestName(g),
        household_id: h.id,
        household: h.name,
        category: g.age_category_id ? category.get(g.age_category_id) ?? null : null,
        tags: g.tags,
        diet: g.diet,
        allergies: g.allergies,
        high_chair: g.needs_high_chair,
        status,
        attending: status === "yes",
      });
    }
  }

  return {
    event: { id: event.id, name: event.name, starts_at: event.starts_at },
    layout: { id: layout?.id ?? null, width: layout?.width ?? 2000, height: layout?.height ?? 1400, background_key: layout?.background_key ?? null },
    items: (items ?? []) as LayoutItem[],
    assignments: assignments ?? [],
    guests,
    rules: (rules ?? []).filter((r) => !r.event_id || r.event_id === eventId) as SeatingRuleRow[],
    tags: book.tags,
  };
}
