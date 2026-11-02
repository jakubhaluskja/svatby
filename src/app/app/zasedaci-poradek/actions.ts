"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { loadSeating } from "@/lib/seating-data";
import { suggestSeating, type Problem } from "@/lib/seating";
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

export async function assignGuests(eventId: string, tableId: string, guestIds: string[]): Promise<{ error?: string }> {
  const wedding = await requireWedding();
  const ids = z.array(uuid).max(50).parse(guestIds);
  const supabase = await createClient();
  const { error } = await supabase.from("seat_assignments").upsert(
    ids.map((guest_id) => ({ guest_id, event_id: eventId, wedding_id: wedding.id, table_id: tableId, seat_index: null })),
    { onConflict: "guest_id,event_id" },
  );
  if (error) return { error: "Hosty se nepodařilo posadit." };
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

/** Automatický návrh: zamčení hosté zůstávají, ostatní se rozsadí znovu. */
export async function autoSeat(eventId: string): Promise<{ error?: string; problems?: Problem[]; seated?: number; unseated?: number }> {
  const wedding = await requireWedding();
  const supabase = await createClient();
  const data = await loadSeating(supabase, wedding.id, eventId);
  if (!data) return { error: "Událost nebyla nalezena." };

  const tables = data.items.filter((i) => i.kind === "table" && i.seats > 0).map((i) => ({ id: i.id, label: i.label ?? "stůl", seats: i.seats }));
  if (tables.length === 0) return { error: "Nejdřív přidejte stoly." };

  const attending = data.guests.filter((g) => g.attending);
  const locked = data.assignments.filter((a) => a.locked && attending.some((g) => g.id === a.guest_id));
  const result = suggestSeating({
    tables,
    guests: attending.map((g) => ({ id: g.id, name: g.name, household_id: g.household_id, tags: g.tags })),
    rules: data.rules.map((r) => (r.kind === "fixed_table" ? { kind: r.kind, guest_ids: r.guest_ids, table_id: r.table_id! } : { kind: r.kind, guest_ids: r.guest_ids })),
    locked: locked.map((a) => ({ guest_id: a.guest_id, table_id: a.table_id })),
  });

  // Nahradit nezamčené rozsazení návrhem
  await supabase.from("seat_assignments").delete().eq("event_id", eventId).eq("locked", false);
  const lockedIds = new Set(locked.map((a) => a.guest_id));
  const rows = result.assignments
    .filter((a) => !lockedIds.has(a.guest_id))
    .map((a) => ({ guest_id: a.guest_id, table_id: a.table_id, event_id: eventId, wedding_id: wedding.id, locked: false }));
  if (rows.length) {
    const { error } = await supabase.from("seat_assignments").insert(rows);
    if (error) return { error: "Návrh se nepodařilo uložit." };
  }
  revalidatePath("/app/zasedaci-poradek");
  return { problems: result.problems, seated: result.assignments.length, unseated: result.unseated.length };
}

export async function clearSeating(eventId: string) {
  await requireWedding();
  const supabase = await createClient();
  await supabase.from("seat_assignments").delete().eq("event_id", uuid.parse(eventId)).eq("locked", false);
  revalidatePath(path(eventId));
}
