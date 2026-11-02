import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { guestName, loadGuestBook } from "@/lib/guest-data";

export type Room = {
  id: string;
  lodging_id: string;
  name: string;
  capacity: number;
  price: number | null;
  currency: "CZK" | "EUR";
  paid_by: "guest" | "couple";
  notes: string | null;
  sort: number;
};

export type Lodging = {
  id: string;
  name: string;
  address: string | null;
  url: string | null;
  check_in_info: Record<string, string>;
  sort: number;
  rooms: Room[];
};

export type LodgingGuest = {
  id: string;
  name: string;
  household_id: string;
  household: string;
  /** Domácnost v RSVP uvedla, že chce ubytování */
  wants: boolean | null;
  note: string | null;
  attending: boolean;
};

export type LodgingData = {
  lodgings: Lodging[];
  assignments: { guest_id: string; room_id: string }[];
  guests: LodgingGuest[];
};

export async function loadLodging(db: SupabaseClient, weddingId: string): Promise<LodgingData> {
  const [book, { data: lodgings }, { data: rooms }, { data: assignments }] = await Promise.all([
    loadGuestBook(db, weddingId),
    db.from("lodgings").select("id, name, address, url, check_in_info, sort").eq("wedding_id", weddingId).order("sort"),
    db.from("rooms").select("id, lodging_id, name, capacity, price, currency, paid_by, notes, sort").eq("wedding_id", weddingId).order("sort"),
    db.from("room_assignments").select("guest_id, room_id").eq("wedding_id", weddingId),
  ]);

  const guests: LodgingGuest[] = [];
  for (const h of book.households) {
    for (const g of h.guests) {
      const statuses = h.event_ids.map((e) => g.responses[e] ?? "pending");
      guests.push({
        id: g.id,
        name: guestName(g),
        household_id: h.id,
        household: h.name,
        wants: h.needs_lodging,
        note: h.lodging_note,
        // Kdo odmítl všechny události, ubytování nepotřebuje
        attending: statuses.length === 0 || statuses.some((s) => s !== "no"),
      });
    }
  }

  return {
    lodgings: (lodgings ?? []).map((l) => ({
      ...l,
      check_in_info: (l.check_in_info ?? {}) as Record<string, string>,
      rooms: ((rooms ?? []) as Room[]).filter((r) => r.lodging_id === l.id),
    })),
    assignments: assignments ?? [],
    guests,
  };
}
