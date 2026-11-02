"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { zonedToUtcIso } from "@/lib/time";
import { requireWedding } from "@/lib/wedding";

const uuid = z.string().uuid();
const text = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => v || null);

export type FormState = { ok?: boolean; error?: string };

const itemSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Zadejte datum."),
  start: z.string().regex(/^\d{2}:\d{2}$/, "Zadejte čas začátku."),
  end: z.union([z.literal(""), z.string().regex(/^\d{2}:\d{2}$/)]),
  title: z.string().trim().min(1, "Napište, co se děje.").max(160),
  location: text(160),
  responsible_name: text(80),
  vendor_id: z.union([z.literal(""), uuid]).transform((v) => v || null),
  contact: text(120),
  notes: text(1000),
});

export async function saveItem(itemId: string | null, _: FormState, formData: FormData): Promise<FormState> {
  const wedding = await requireWedding();
  const parsed = itemSchema.safeParse(
    Object.fromEntries(["date", "start", "end", "title", "location", "responsible_name", "vendor_id", "contact", "notes"].map((k) => [k, String(formData.get(k) ?? "")])),
  );
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const v = parsed.data;
  const starts_at = zonedToUtcIso(v.date, v.start);
  let ends_at = v.end ? zonedToUtcIso(v.date, v.end) : null;
  // Konec po půlnoci (např. 22:00–02:00) patří do dalšího dne
  if (ends_at && ends_at <= starts_at) ends_at = new Date(Date.parse(ends_at) + 86_400_000).toISOString();

  const row = { starts_at, ends_at, title: v.title, location: v.location, responsible_name: v.responsible_name, vendor_id: v.vendor_id, contact: v.contact, notes: v.notes };
  const supabase = await createClient();
  const { error } = itemId
    ? await supabase.from("schedule_items").update(row).eq("id", itemId).eq("wedding_id", wedding.id)
    : await supabase.from("schedule_items").insert({ ...row, wedding_id: wedding.id });
  if (error) return { error: "Položku se nepodařilo uložit." };
  revalidatePath("/app/harmonogram");
  return { ok: true };
}

export async function deleteItem(itemId: string) {
  const wedding = await requireWedding();
  const supabase = await createClient();
  await supabase.from("schedule_items").delete().eq("id", uuid.parse(itemId)).eq("wedding_id", wedding.id);
  revalidatePath("/app/harmonogram");
}

const vendorSchema = z.object({
  name: z.string().trim().min(1, "Zadejte název dodavatele.").max(100),
  category: text(60),
  contact_name: text(80),
  phone: text(40),
  email: z.union([z.literal(""), z.string().trim().email("E-mail dodavatele není platný.")]).transform((v) => v || null),
});

export async function saveVendor(vendorId: string | null, _: FormState, formData: FormData): Promise<FormState> {
  const wedding = await requireWedding();
  const parsed = vendorSchema.safeParse(Object.fromEntries(["name", "category", "contact_name", "phone", "email"].map((k) => [k, String(formData.get(k) ?? "")])));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const supabase = await createClient();
  const { error } = vendorId
    ? await supabase.from("vendors").update(parsed.data).eq("id", vendorId).eq("wedding_id", wedding.id)
    : await supabase.from("vendors").insert({ ...parsed.data, wedding_id: wedding.id });
  if (error) return { error: error.message.includes("row-level") ? "K dodavatelům nemáte oprávnění (patří k rozpočtu)." : "Dodavatele se nepodařilo uložit." };
  revalidatePath("/app/harmonogram");
  return { ok: true };
}

/** Vytvoří sdílený odkaz (hlavní nebo pro dodavatele). Starý odkaz přestane platit. */
export async function createShareLink(vendorId: string | null) {
  const wedding = await requireWedding();
  const supabase = await createClient();
  let revoke = supabase.from("schedule_links").update({ revoked_at: new Date().toISOString() }).eq("wedding_id", wedding.id).is("revoked_at", null);
  revoke = vendorId ? revoke.eq("vendor_id", uuid.parse(vendorId)) : revoke.is("vendor_id", null);
  await revoke;
  await supabase.from("schedule_links").insert({ wedding_id: wedding.id, vendor_id: vendorId, token: randomBytes(24).toString("base64url") });
  revalidatePath("/app/harmonogram");
}

export async function revokeShareLink(linkId: string) {
  const wedding = await requireWedding();
  const supabase = await createClient();
  await supabase.from("schedule_links").update({ revoked_at: new Date().toISOString() }).eq("id", uuid.parse(linkId)).eq("wedding_id", wedding.id);
  revalidatePath("/app/harmonogram");
}
