"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireWedding } from "@/lib/wedding";

const uuid = z.string().uuid();
const text = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => v || null);

export type FormState = { error?: string; ok?: boolean };

const lodgingSchema = z.object({
  name: z.string().trim().min(1, "Zadejte název ubytování.").max(100),
  address: text(200),
  url: z.union([z.literal(""), z.string().trim().url("Odkaz musí začínat https://")]).transform((v) => v || null),
  check_in_cs: text(1000),
  check_in_en: text(1000),
});

export async function saveLodging(lodgingId: string | null, _: FormState, formData: FormData): Promise<FormState> {
  const wedding = await requireWedding();
  const parsed = lodgingSchema.safeParse(Object.fromEntries(["name", "address", "url", "check_in_cs", "check_in_en"].map((k) => [k, String(formData.get(k) ?? "")])));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const v = parsed.data;
  const row = {
    name: v.name,
    address: v.address,
    url: v.url,
    check_in_info: { ...(v.check_in_cs ? { cs: v.check_in_cs } : {}), ...(v.check_in_en ? { en: v.check_in_en } : {}) },
  };
  const supabase = await createClient();
  const { error } = lodgingId
    ? await supabase.from("lodgings").update(row).eq("id", lodgingId).eq("wedding_id", wedding.id)
    : await supabase.from("lodgings").insert({ ...row, wedding_id: wedding.id, sort: Date.now() % 1_000_000 });
  if (error) return { error: "Ubytování se nepodařilo uložit." };
  revalidatePath("/app/ubytovani");
  return { ok: true };
}

export async function deleteLodging(lodgingId: string) {
  const wedding = await requireWedding();
  const supabase = await createClient();
  await supabase.from("lodgings").delete().eq("id", uuid.parse(lodgingId)).eq("wedding_id", wedding.id);
  revalidatePath("/app/ubytovani");
}

const roomSchema = z.object({
  name: z.string().trim().min(1, "Zadejte název pokoje.").max(60),
  capacity: z.coerce.number().int().min(1, "Pokoj musí mít aspoň 1 lůžko.").max(50),
  price: z
    .string()
    .trim()
    .transform((v) => (v ? Number(v.replace(",", ".").replace(/\s/g, "")) : null))
    .refine((v) => v === null || (Number.isFinite(v) && v >= 0), "Cena musí být číslo."),
  currency: z.enum(["CZK", "EUR"]),
  paid_by: z.enum(["guest", "couple"]),
  notes: text(300),
});

export async function saveRoom(lodgingId: string, roomId: string | null, _: FormState, formData: FormData): Promise<FormState> {
  const wedding = await requireWedding();
  const parsed = roomSchema.safeParse(Object.fromEntries(["name", "capacity", "price", "currency", "paid_by", "notes"].map((k) => [k, String(formData.get(k) ?? "")])));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const supabase = await createClient();
  const { error } = roomId
    ? await supabase.from("rooms").update(parsed.data).eq("id", roomId).eq("wedding_id", wedding.id)
    : await supabase.from("rooms").insert({ ...parsed.data, lodging_id: uuid.parse(lodgingId), wedding_id: wedding.id, sort: Date.now() % 1_000_000 });
  if (error) return { error: "Pokoj se nepodařilo uložit." };
  revalidatePath("/app/ubytovani");
  return { ok: true };
}

export async function deleteRoom(roomId: string) {
  const wedding = await requireWedding();
  const supabase = await createClient();
  await supabase.from("rooms").delete().eq("id", uuid.parse(roomId)).eq("wedding_id", wedding.id);
  revalidatePath("/app/ubytovani");
}

/** Ubytuje hosty v pokoji (host může mít jen jeden pokoj). */
export async function assignRoom(roomId: string, guestIds: string[]): Promise<{ error?: string }> {
  const wedding = await requireWedding();
  const ids = z.array(uuid).min(1).max(50).parse(guestIds);
  const supabase = await createClient();
  const { error } = await supabase
    .from("room_assignments")
    .upsert(ids.map((guest_id) => ({ guest_id, room_id: uuid.parse(roomId), wedding_id: wedding.id })), { onConflict: "guest_id" });
  if (error) return { error: "Hosty se nepodařilo ubytovat." };
  revalidatePath("/app/ubytovani");
  return {};
}

export async function unassignRoom(guestIds: string[]) {
  const wedding = await requireWedding();
  const supabase = await createClient();
  await supabase.from("room_assignments").delete().eq("wedding_id", wedding.id).in("guest_id", z.array(uuid).parse(guestIds));
  revalidatePath("/app/ubytovani");
}
