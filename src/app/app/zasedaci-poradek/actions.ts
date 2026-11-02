"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { loadSeating } from "@/lib/seating-data";
import { freeSeatIndexes, suggestSeating, type Problem } from "@/lib/seating";
import { createClient } from "@/lib/supabase/server";
import { requireWedding } from "@/lib/wedding";

const uuid = z.string().uuid();

const itemSchema = z.object({
  id: uuid,
  kind: z.enum(["table", "decor"]),
  shape: z.enum(["round", "rect", "oval", "head", "t", "u", "banquet", "dancefloor", "bar", "stage", "dj", "entrance"]),
  label: z.string().max(40).nullable(),
  seats: z.number().int().min(0).max(200),
  x: z.number().finite(),
  y: z.number().finite(),
  w: z.number().min(20).max(3000),
  h: z.number().min(20).max(3000),
  rotation: z.number().finite(),
  sort: z.number().int(),
});

export type LayoutInput = z.infer<typeof itemSchema>;

const path = (eventId: string) => `/app/zasedaci-poradek?udalost=${eventId}`;

export async function saveLayout(eventId: string, items: unknown[], background?: string | null): Promise<{ error?: string }> {
  await requireWedding();
  const parsed = z.array(itemSchema).max(300).safeParse(items);
  if (!parsed.success || !uuid.safeParse(eventId).success) return { error: "Plán se nepodařilo uložit." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("save_layout", {
    p_event_id: eventId,
    p_items: parsed.data,
    p_background: background ?? null,
    p_clear_background: background === null,
  });
  if (error) return { error: error.message.includes("forbidden") ? "K úpravě zasedacího pořádku nemáte oprávnění." : "Plán se nepodařilo uložit." };
  revalidatePath("/app/zasedaci-poradek");
  return {};
}

/** Posadí hosty ke stolu na první volné židle (přetažení, celá domácnost). */
export async function assignGuests(eventId: string, tableId: string, guestIds: string[]): Promise<{ error?: string }> {
  const wedding = await requireWedding();
  const ids = z.array(uuid).max(50).parse(guestIds);
  const supabase = await createClient();
  const [{ data: table }, { data: current }] = await Promise.all([
    supabase.from("layout_items").select("seats").eq("id", tableId).single(),
    supabase.from("seat_assignments").select("guest_id, seat_index").eq("table_id", tableId),
  ]);
  const taken = (current ?? []).filter((a) => !ids.includes(a.guest_id)).map((a) => a.seat_index);
  const indexes = freeSeatIndexes(table?.seats ?? 0, taken, ids.length);
  const { error } = await supabase.from("seat_assignments").upsert(
    ids.map((guest_id, i) => ({ guest_id, event_id: eventId, wedding_id: wedding.id, table_id: tableId, seat_index: indexes[i] })),
    { onConflict: "guest_id,event_id" },
  );
  if (error) return { error: "Hosty se nepodařilo posadit." };
  revalidatePath("/app/zasedaci-poradek");
  return {};
}

/** Posadí hosta na konkrétní židli. Kdo na ní seděl, uvolní místo. */
export async function seatAt(eventId: string, tableId: string, seatIndex: number, guestId: string): Promise<{ error?: string }> {
  const wedding = await requireWedding();
  const idx = z.number().int().min(0).max(199).parse(seatIndex);
  const supabase = await createClient();
  await supabase.from("seat_assignments").delete().eq("table_id", uuid.parse(tableId)).eq("seat_index", idx).neq("guest_id", uuid.parse(guestId));
  const { error } = await supabase.from("seat_assignments").upsert(
    { guest_id: guestId, event_id: eventId, wedding_id: wedding.id, table_id: tableId, seat_index: idx },
    { onConflict: "guest_id,event_id" },
  );
  if (error) return { error: "Hosta se nepodařilo posadit." };
  revalidatePath("/app/zasedaci-poradek");
  return {};
}

export async function unassignGuests(eventId: string, guestIds: string[]) {
  await requireWedding();
  const ids = z.array(uuid).max(200).parse(guestIds);
  const supabase = await createClient();
  await supabase.from("seat_assignments").delete().eq("event_id", eventId).in("guest_id", ids);
  revalidatePath("/app/zasedaci-poradek");
}

export async function setLocked(eventId: string, guestId: string, locked: boolean) {
  await requireWedding();
  const supabase = await createClient();
  await supabase.from("seat_assignments").update({ locked }).eq("event_id", eventId).eq("guest_id", uuid.parse(guestId));
  revalidatePath("/app/zasedaci-poradek");
}

const ruleSchema = z.object({
  kind: z.enum(["together", "apart", "fixed_table"]),
  guest_ids: z.array(uuid).min(1).max(30),
  table_id: uuid.nullable(),
});

export async function addRule(eventId: string, rule: z.infer<typeof ruleSchema>): Promise<{ error?: string }> {
  const wedding = await requireWedding();
  const r = ruleSchema.safeParse(rule);
  if (!r.success) return { error: "Pravidlo není úplné." };
  if (r.data.kind === "fixed_table" && !r.data.table_id) return { error: "Vyberte stůl." };
  if (r.data.kind !== "fixed_table" && r.data.guest_ids.length < 2) return { error: "Vyberte aspoň dva hosty." };
  const supabase = await createClient();
  const { error } = await supabase.from("seating_rules").insert({
    wedding_id: wedding.id,
    event_id: r.data.kind === "fixed_table" ? eventId : null,
    kind: r.data.kind,
    guest_ids: r.data.guest_ids,
    table_id: r.data.kind === "fixed_table" ? r.data.table_id : null,
  });
  if (error) return { error: "Pravidlo se nepodařilo uložit." };
  revalidatePath("/app/zasedaci-poradek");
  return {};
}

export async function deleteRule(ruleId: string) {
  const wedding = await requireWedding();
  const supabase = await createClient();
  await supabase.from("seating_rules").delete().eq("id", uuid.parse(ruleId)).eq("wedding_id", wedding.id);
  revalidatePath("/app/zasedaci-poradek");
}

/**
 * Automatický návrh: zamčení hosté zůstávají, ostatní se rozsadí znovu.
 * Nejdřív potvrzení hosté, do zbylých míst ti, kdo ještě neodpověděli.
 */
export async function autoSeat(eventId: string): Promise<{ error?: string; problems?: Problem[]; seated?: number; unseated?: number; pendingUnseated?: number }> {
  const wedding = await requireWedding();
  const supabase = await createClient();
  const data = await loadSeating(supabase, wedding.id, eventId);
  if (!data) return { error: "Událost nebyla nalezena." };

  const tableItems = data.items.filter((i) => i.kind === "table" && i.seats > 0);
  const tables = tableItems.map((i) => ({ id: i.id, label: i.label ?? "stůl", seats: i.seats }));
  if (tables.length === 0) return { error: "Nejdřív přidejte stoly." };

  const rules = data.rules.map((r) =>
    r.kind === "fixed_table" ? { kind: r.kind, guest_ids: r.guest_ids, table_id: r.table_id! } : { kind: r.kind, guest_ids: r.guest_ids },
  );
  const toSeatGuest = (g: (typeof data.guests)[number]) => ({ id: g.id, name: g.name, household_id: g.household_id, tags: g.tags });
  const confirmed = data.guests.filter((g) => g.status === "yes");
  const pending = data.guests.filter((g) => g.status === "pending");
  const seatable = new Set([...confirmed, ...pending].map((g) => g.id));
  const locked = data.assignments.filter((a) => a.locked && seatable.has(a.guest_id));

  // 1. potvrzení
  const first = suggestSeating({ tables, guests: confirmed.map(toSeatGuest), rules, locked: locked.map((a) => ({ guest_id: a.guest_id, table_id: a.table_id })) });
  // 2. bez odpovědi do zbylých míst (potvrzení jsou už „zamčení“)
  const second = suggestSeating({
    tables,
    guests: [...confirmed, ...pending].map(toSeatGuest),
    rules,
    locked: [...first.assignments, ...locked.filter((a) => pending.some((p) => p.id === a.guest_id))].map((a) => ({ guest_id: a.guest_id, table_id: a.table_id })),
  });

  // Čísla židlí: zamčení si nechají svou, ostatní dostanou volné
  const lockedIds = new Set(locked.map((a) => a.guest_id));
  const rows: { guest_id: string; table_id: string; seat_index: number | null; event_id: string; wedding_id: string; locked: boolean }[] = [];
  for (const t of tableItems) {
    const here = second.assignments.filter((a) => a.table_id === t.id && !lockedIds.has(a.guest_id)).map((a) => a.guest_id);
    // Potvrzení první, ať při nedostatku míst zůstanou na židlích
    here.sort((a, b) => Number(seatable.has(b) && confirmed.some((c) => c.id === b)) - Number(seatable.has(a) && confirmed.some((c) => c.id === a)));
    const taken = locked.filter((a) => a.table_id === t.id).map((a) => a.seat_index);
    const indexes = freeSeatIndexes(t.seats, taken, here.length);
    here.forEach((guest_id, i) => rows.push({ guest_id, table_id: t.id, seat_index: indexes[i], event_id: eventId, wedding_id: wedding.id, locked: false }));
  }

  await supabase.from("seat_assignments").delete().eq("event_id", eventId).eq("locked", false);
  if (rows.length) {
    const { error } = await supabase.from("seat_assignments").insert(rows);
    if (error) return { error: "Návrh se nepodařilo uložit." };
  }
  revalidatePath("/app/zasedaci-poradek");
  const pendingUnseated = pending.filter((p) => !second.assignments.some((a) => a.guest_id === p.id)).length;
  return { problems: first.problems, seated: second.assignments.length, unseated: first.unseated.length, pendingUnseated };
}

export async function clearSeating(eventId: string) {
  await requireWedding();
  const supabase = await createClient();
  await supabase.from("seat_assignments").delete().eq("event_id", uuid.parse(eventId)).eq("locked", false);
  revalidatePath(path(eventId));
}
