"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireWedding } from "@/lib/wedding";

export type Result = { ok?: boolean; error?: string };

const uuid = z.string().uuid();
const money = z
  .union([z.literal(""), z.null(), z.number(), z.string()])
  .transform((v) => (v === "" || v === null ? null : typeof v === "number" ? v : Number(String(v).replace(/\s/g, "").replace(",", "."))))
  .refine((v) => v === null || (Number.isFinite(v) && v > 0 && v < 1e9), "Částka není platné číslo.");
const lt = z.object({ cs: z.string().trim().max(400).default(""), en: z.string().trim().max(400).default("") });

function done(): Result {
  revalidatePath("/app/dary");
  return { ok: true };
}
function fail(e: { message?: string } | null, text: string): Result {
  if (e?.message?.includes("row-level")) return { error: "K darům nemáte oprávnění." };
  return { error: text };
}

const giftSchema = z
  .object({
    kind: z.enum(["item", "fund", "group"]),
    title: lt,
    description: lt,
    url: z
      .string()
      .trim()
      .max(500)
      .transform((v) => (v ? (/^https?:\/\//i.test(v) ? v : `https://${v}`) : null)),
    price: money,
    target_amount: money,
    image_key: z.string().max(200).nullable(),
    show_contributors: z.boolean(),
    show_amounts: z.boolean(),
  })
  .refine((g) => g.title.cs || g.title.en, { message: "Zadejte název daru." })
  .refine((g) => g.kind !== "group" || g.target_amount, { message: "Skupinový dar potřebuje cílovou částku." });

export async function saveGift(id: string | null, input: unknown): Promise<Result> {
  const wedding = await requireWedding();
  const parsed = giftSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const g = parsed.data;
  if (g.image_key && !g.image_key.startsWith(`${wedding.id}/`)) return { error: "Neplatná fotka." };
  const row = { ...g, price: g.kind === "item" ? g.price : null, target_amount: g.kind === "item" ? null : g.target_amount };
  const supabase = await createClient();
  const { error } = id
    ? await supabase.from("gifts").update(row).eq("id", uuid.parse(id)).eq("wedding_id", wedding.id)
    : await supabase.from("gifts").insert({ ...row, wedding_id: wedding.id, sort: Date.now() % 1_000_000_000 });
  return error ? fail(error, "Dar se nepodařilo uložit.") : done();
}

export async function deleteGift(id: string): Promise<Result> {
  const wedding = await requireWedding();
  const supabase = await createClient();
  const { error } = await supabase.from("gifts").delete().eq("id", uuid.parse(id)).eq("wedding_id", wedding.id);
  return error ? fail(error, "Dar se nepodařilo smazat.") : done();
}

/** Nové pořadí darů (seznam id shora dolů). */
export async function reorderGifts(ids: string[]): Promise<Result> {
  const wedding = await requireWedding();
  const list = z.array(uuid).max(500).parse(ids);
  const supabase = await createClient();
  const results = await Promise.all(list.map((id, i) => supabase.from("gifts").update({ sort: i }).eq("id", id).eq("wedding_id", wedding.id)));
  const e = results.find((r) => r.error)?.error ?? null;
  return e ? fail(e, "Pořadí se nepodařilo uložit.") : done();
}

export async function setReveal(reveal: boolean): Promise<Result> {
  const wedding = await requireWedding();
  const supabase = await createClient();
  const { error } = await supabase.from("gift_settings").update({ reveal_reservations: reveal }).eq("wedding_id", wedding.id);
  return error ? fail(error, "Nastavení se nepodařilo uložit.") : done();
}

export async function confirmContribution(id: string, confirmed: boolean): Promise<Result> {
  const wedding = await requireWedding();
  const supabase = await createClient();
  const { error } = await supabase
    .from("gift_contributions")
    .update({ confirmed_at: confirmed ? new Date().toISOString() : null })
    .eq("id", uuid.parse(id))
    .eq("wedding_id", wedding.id);
  return error ? fail(error, "Příspěvek se nepodařilo uložit.") : done();
}

export async function deleteContribution(id: string): Promise<Result> {
  const wedding = await requireWedding();
  const supabase = await createClient();
  const { error } = await supabase.from("gift_contributions").delete().eq("id", uuid.parse(id)).eq("wedding_id", wedding.id);
  return error ? fail(error, "Příspěvek se nepodařilo smazat.") : done();
}

export async function cancelReservation(id: string): Promise<Result> {
  const wedding = await requireWedding();
  const supabase = await createClient();
  const { error } = await supabase.from("gift_reservations").delete().eq("id", uuid.parse(id)).eq("wedding_id", wedding.id);
  return error ? fail(error, "Rezervaci se nepodařilo zrušit.") : done();
}

/** Rezervovaný dar dorazil → obdržený dar (pro poděkování). */
export async function reservationReceived(id: string, received: boolean): Promise<Result> {
  const wedding = await requireWedding();
  const supabase = await createClient();
  const rid = uuid.parse(id);
  if (!received) {
    const { error } = await supabase.from("received_gifts").delete().eq("source", "reservation").eq("source_id", rid).eq("wedding_id", wedding.id);
    return error ? fail(error, "Nepodařilo se uložit.") : done();
  }
  const { data: r } = await supabase.from("gift_reservations").select("household_id, gifts(title)").eq("id", rid).eq("wedding_id", wedding.id).maybeSingle();
  if (!r) return { error: "Rezervace nenalezena." };
  const title = (r.gifts as unknown as { title: Record<string, string> } | null)?.title;
  const { error } = await supabase.from("received_gifts").insert({
    wedding_id: wedding.id,
    household_id: r.household_id,
    description: title?.cs || title?.en || "Dar",
    source: "reservation",
    source_id: rid,
  });
  return error ? fail(error, "Nepodařilo se uložit.") : done();
}

const receivedSchema = z.object({
  household_id: uuid,
  description: z.string().trim().min(1, "Popište dar.").max(200),
  amount: money,
});

export async function addReceived(input: unknown): Promise<Result> {
  const wedding = await requireWedding();
  const parsed = receivedSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const supabase = await createClient();
  const { error } = await supabase.from("received_gifts").insert({ ...parsed.data, wedding_id: wedding.id, source: "manual" });
  return error ? fail(error, "Dar se nepodařilo uložit.") : done();
}

export async function deleteReceived(id: string): Promise<Result> {
  const wedding = await requireWedding();
  const supabase = await createClient();
  const { error } = await supabase.from("received_gifts").delete().eq("id", uuid.parse(id)).eq("wedding_id", wedding.id).eq("source", "manual");
  return error ? fail(error, "Dar se nepodařilo smazat.") : done();
}
