"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireWedding } from "@/lib/wedding";

export type Result = { ok?: boolean; error?: string };
const uuid = z.string().uuid();
const opt = (max: number) => z.string().trim().max(max).transform((v) => v || null);
const num = z
  .union([z.literal(""), z.null(), z.number(), z.string()])
  .transform((v) => (v === "" || v === null ? null : typeof v === "number" ? v : Number(String(v).replace(/\s/g, "").replace(",", "."))))
  .refine((v) => v === null || (Number.isFinite(v) && v >= 0 && v < 1e9), "Neplatné číslo.");

const schema = z.object({
  name: z.string().trim().min(1, "Zadejte název místa.").max(120),
  location: opt(200),
  url: z
    .string()
    .trim()
    .max(300)
    .transform((v) => (v ? (/^https?:\/\//i.test(v) ? v : `https://${v}`) : null)),
  contact: opt(200),
  price: num,
  price_note: opt(200),
  capacity: num.transform((v) => (v === null ? null : Math.round(v))),
  dates: opt(300),
  pros: opt(1000),
  cons: opt(1000),
  notes: opt(2000),
  rating: z.union([z.null(), z.number().int().min(1).max(5)]),
  status: z.enum(["considering", "visited", "booked", "rejected"]),
  visit_at: z.union([z.literal(""), z.null(), z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)]).transform((v) => (v ? new Date(`${v}:00+01:00`).toISOString() : null)),
});

function done(): Result {
  revalidatePath("/app/mista");
  return { ok: true };
}
function fail(e: { message?: string } | null, text: string): Result {
  if (e?.message?.includes("row-level")) return { error: "K plánování nemáte oprávnění." };
  return { error: text };
}

export async function saveVenue(id: string | null, input: unknown): Promise<Result> {
  const wedding = await requireWedding();
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const supabase = await createClient();
  const { error } = id
    ? await supabase.from("venue_options").update(parsed.data).eq("id", uuid.parse(id)).eq("wedding_id", wedding.id)
    : await supabase.from("venue_options").insert({ ...parsed.data, wedding_id: wedding.id, sort: Date.now() % 1_000_000_000 });
  return error ? fail(error, "Místo se nepodařilo uložit.") : done();
}

export async function setVenueStatus(id: string, status: "considering" | "visited" | "booked" | "rejected"): Promise<Result> {
  const wedding = await requireWedding();
  const supabase = await createClient();
  const s = z.enum(["considering", "visited", "booked", "rejected"]).parse(status);
  // Zarezervované může být jen jedno místo.
  if (s === "booked") await supabase.from("venue_options").update({ status: "visited" }).eq("wedding_id", wedding.id).eq("status", "booked");
  const { error } = await supabase.from("venue_options").update({ status: s }).eq("id", uuid.parse(id)).eq("wedding_id", wedding.id);
  return error ? fail(error, "Nepodařilo se uložit.") : done();
}

export async function rateVenue(id: string, rating: number | null): Promise<Result> {
  const wedding = await requireWedding();
  const supabase = await createClient();
  const { error } = await supabase.from("venue_options").update({ rating: rating === null ? null : z.number().int().min(1).max(5).parse(rating) }).eq("id", uuid.parse(id)).eq("wedding_id", wedding.id);
  return error ? fail(error, "Nepodařilo se uložit.") : done();
}

export async function deleteVenue(id: string): Promise<Result> {
  const wedding = await requireWedding();
  const supabase = await createClient();
  const { error } = await supabase.from("venue_options").delete().eq("id", uuid.parse(id)).eq("wedding_id", wedding.id);
  return error ? fail(error, "Místo se nepodařilo smazat.") : done();
}
