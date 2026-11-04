"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { eurRate } from "@/lib/cnb";
import { createClient } from "@/lib/supabase/server";
import { requireWedding } from "@/lib/wedding";

export type Result = { ok?: boolean; error?: string; id?: string };

const uuid = z.string().uuid();
const optUuid = z.union([z.literal(""), z.null(), uuid]).transform((v) => v || null);
const money = z
  .union([z.literal(""), z.null(), z.number(), z.string()])
  .transform((v) => (v === "" || v === null ? null : typeof v === "number" ? v : Number(String(v).replace(/\s/g, "").replace(",", "."))))
  .refine((v) => v === null || (Number.isFinite(v) && v >= 0 && v < 1e10), "Částka není platné číslo.");
const date = z.union([z.literal(""), z.null(), z.string().regex(/^\d{4}-\d{2}-\d{2}$/)]).transform((v) => v || null);
const currency = z.enum(["CZK", "EUR"]);

function done(): Result {
  revalidatePath("/app/rozpocet");
  revalidatePath("/app/checklist");
  revalidatePath("/app");
  return { ok: true };
}

function fail(e: { message?: string } | null, text: string): Result {
  if (e?.message?.includes("row-level")) return { error: "K rozpočtu nemáte oprávnění." };
  return { error: text };
}

export async function saveBudgetTotal(value: string): Promise<Result> {
  const wedding = await requireWedding();
  const parsed = money.safeParse(value);
  if (!parsed.success) return { error: "Zadejte částku." };
  const supabase = await createClient();
  const { error } = await supabase.from("weddings").update({ budget_total: parsed.data }).eq("id", wedding.id);
  return error ? fail(error, "Rozpočet se nepodařilo uložit.") : done();
}

const categorySchema = z.object({ name: z.string().trim().min(1, "Zadejte název kategorie.").max(80), planned_amount: money });

export async function saveCategory(id: string | null, input: unknown): Promise<Result> {
  const wedding = await requireWedding();
  const parsed = categorySchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const supabase = await createClient();
  const { error } = id
    ? await supabase.from("budget_categories").update(parsed.data).eq("id", uuid.parse(id)).eq("wedding_id", wedding.id)
    : await supabase.from("budget_categories").insert({ ...parsed.data, wedding_id: wedding.id, sort: 900 });
  return error ? fail(error, "Kategorii se nepodařilo uložit.") : done();
}

export async function deleteCategory(id: string): Promise<Result> {
  const wedding = await requireWedding();
  const supabase = await createClient();
  const { error } = await supabase.from("budget_categories").delete().eq("id", uuid.parse(id)).eq("wedding_id", wedding.id);
  return error ? fail(error, "Kategorii se nepodařilo smazat.") : done();
}

const itemSchema = z.object({
  name: z.string().trim().min(1, "Zadejte název položky.").max(120),
  category_id: optUuid,
  vendor_id: optUuid,
  contributor_id: optUuid,
  currency,
  estimate_amount: money,
  actual_amount: money,
  per_person: z.boolean(),
  per_person_event_id: optUuid,
  notes: z.string().trim().max(2000).transform((v) => v || null),
  rates: z.array(z.object({ age_category_id: uuid, price: money })).max(20),
});

export async function saveItem(id: string | null, input: unknown): Promise<Result> {
  const wedding = await requireWedding();
  const parsed = itemSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { rates, ...row } = parsed.data;
  if (row.per_person && !row.per_person_event_id) return { error: "Vyberte událost, podle které se počítají hosté." };
  const supabase = await createClient();
  let itemId = id;
  if (id) {
    const { error } = await supabase.from("budget_items").update(row).eq("id", uuid.parse(id)).eq("wedding_id", wedding.id);
    if (error) return fail(error, "Položku se nepodařilo uložit.");
  } else {
    const { data, error } = await supabase.from("budget_items").insert({ ...row, wedding_id: wedding.id, sort: 900 }).select("id").single();
    if (error || !data) return fail(error, "Položku se nepodařilo uložit.");
    itemId = data.id;
  }
  await supabase.from("budget_item_rates").delete().eq("item_id", itemId!);
  const toSave = row.per_person ? rates.filter((r) => r.price !== null) : [];
  if (toSave.length) {
    const { error } = await supabase.from("budget_item_rates").insert(toSave.map((r) => ({ item_id: itemId!, age_category_id: r.age_category_id, price: r.price!, wedding_id: wedding.id })));
    if (error) return fail(error, "Ceny za osobu se nepodařilo uložit.");
  }
  return { ...done(), id: itemId! };
}

export async function deleteItem(id: string): Promise<Result> {
  const wedding = await requireWedding();
  const supabase = await createClient();
  const { error } = await supabase.from("budget_items").delete().eq("id", uuid.parse(id)).eq("wedding_id", wedding.id);
  return error ? fail(error, "Položku se nepodařilo smazat.") : done();
}

const paymentSchema = z.object({
  item_id: uuid,
  label: z.string().trim().max(80).transform((v) => v || null),
  amount: money.refine((v) => v !== null && v > 0, "Zadejte částku platby."),
  currency,
  due_date: date,
  paid_at: date,
  contributor_id: optUuid,
});

async function paidCzk(amount: number, cur: "CZK" | "EUR", paidAt: string | null) {
  if (!paidAt) return { paid_amount_default_currency: null, exchange_rate: null };
  if (cur === "CZK") return { paid_amount_default_currency: amount, exchange_rate: null };
  const { rate } = await eurRate();
  return { paid_amount_default_currency: Math.round(amount * rate * 100) / 100, exchange_rate: rate };
}

export async function savePayment(id: string | null, input: unknown): Promise<Result> {
  const wedding = await requireWedding();
  const parsed = paymentSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const row = { ...parsed.data, amount: parsed.data.amount!, ...(await paidCzk(parsed.data.amount!, parsed.data.currency, parsed.data.paid_at)) };
  const supabase = await createClient();
  const { error } = id
    ? await supabase.from("budget_payments").update(row).eq("id", uuid.parse(id)).eq("wedding_id", wedding.id)
    : await supabase.from("budget_payments").insert({ ...row, wedding_id: wedding.id });
  return error ? fail(error, "Platbu se nepodařilo uložit.") : done();
}

export async function setPaid(id: string, paid: boolean): Promise<Result> {
  const wedding = await requireWedding();
  const supabase = await createClient();
  const { data: p } = await supabase.from("budget_payments").select("amount, currency").eq("id", uuid.parse(id)).eq("wedding_id", wedding.id).single();
  if (!p) return { error: "Platba nenalezena." };
  const today = new Date().toISOString().slice(0, 10);
  const paidAt = paid ? today : null;
  const { error } = await supabase
    .from("budget_payments")
    .update({ paid_at: paidAt, ...(await paidCzk(Number(p.amount), p.currency, paidAt)) })
    .eq("id", id)
    .eq("wedding_id", wedding.id);
  return error ? fail(error, "Platbu se nepodařilo uložit.") : done();
}

export async function deletePayment(id: string): Promise<Result> {
  const wedding = await requireWedding();
  const supabase = await createClient();
  const { error } = await supabase.from("budget_payments").delete().eq("id", uuid.parse(id)).eq("wedding_id", wedding.id);
  return error ? fail(error, "Platbu se nepodařilo smazat.") : done();
}

const contributorSchema = z.object({ name: z.string().trim().min(1, "Zadejte jméno.").max(80), pledged_amount: money });

export async function saveContributor(id: string | null, input: unknown): Promise<Result> {
  const wedding = await requireWedding();
  const parsed = contributorSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const supabase = await createClient();
  const { error } = id
    ? await supabase.from("contributors").update(parsed.data).eq("id", uuid.parse(id)).eq("wedding_id", wedding.id)
    : await supabase.from("contributors").insert({ ...parsed.data, wedding_id: wedding.id });
  return error ? fail(error, "Přispěvatele se nepodařilo uložit.") : done();
}

export async function deleteContributor(id: string): Promise<Result> {
  const wedding = await requireWedding();
  const supabase = await createClient();
  const { error } = await supabase.from("contributors").delete().eq("id", uuid.parse(id)).eq("wedding_id", wedding.id);
  return error ? fail(error, "Přispěvatele se nepodařilo smazat.") : done();
}

const vendorSchema = z.object({
  name: z.string().trim().min(1, "Zadejte název dodavatele.").max(100),
  category: z.string().trim().max(60).transform((v) => v || null),
  contact_name: z.string().trim().max(80).transform((v) => v || null),
  phone: z.string().trim().max(40).transform((v) => v || null),
  email: z.union([z.literal(""), z.string().trim().email("E-mail dodavatele není platný.")]).transform((v) => v || null),
  website: z
    .string()
    .trim()
    .max(200)
    .transform((v) => (v ? (/^https?:\/\//i.test(v) ? v : `https://${v}`) : null)),
  notes: z.string().trim().max(2000).transform((v) => v || null),
});

export async function saveVendor(id: string | null, input: unknown): Promise<Result> {
  const wedding = await requireWedding();
  const parsed = vendorSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const supabase = await createClient();
  const { error } = id
    ? await supabase.from("vendors").update(parsed.data).eq("id", uuid.parse(id)).eq("wedding_id", wedding.id)
    : await supabase.from("vendors").insert({ ...parsed.data, wedding_id: wedding.id });
  revalidatePath("/app/harmonogram");
  return error ? fail(error, "Dodavatele se nepodařilo uložit.") : done();
}

export async function deleteVendor(id: string): Promise<Result> {
  const wedding = await requireWedding();
  const supabase = await createClient();
  const { data: files } = await supabase.from("vendor_files").select("storage_key").eq("vendor_id", uuid.parse(id));
  if (files?.length) await supabase.storage.from("vendor-files").remove(files.map((f) => f.storage_key));
  const { error } = await supabase.from("vendors").delete().eq("id", id).eq("wedding_id", wedding.id);
  revalidatePath("/app/harmonogram");
  return error ? fail(error, "Dodavatele se nepodařilo smazat.") : done();
}

/** Zapíše soubor nahraný do úložiště (smlouva, faktura). */
export async function addVendorFile(vendorId: string, name: string, key: string, bytes: number): Promise<Result> {
  const wedding = await requireWedding();
  const v = uuid.parse(vendorId);
  if (!key.startsWith(`${wedding.id}/${v}/`)) return { error: "Neplatný soubor." };
  const supabase = await createClient();
  const { error } = await supabase.from("vendor_files").insert({ wedding_id: wedding.id, vendor_id: v, name: name.slice(0, 160), storage_key: key, bytes });
  return error ? fail(error, "Soubor se nepodařilo uložit.") : done();
}

export async function deleteVendorFile(id: string): Promise<Result> {
  const wedding = await requireWedding();
  const supabase = await createClient();
  const { data: f } = await supabase.from("vendor_files").select("storage_key").eq("id", uuid.parse(id)).eq("wedding_id", wedding.id).single();
  if (f) await supabase.storage.from("vendor-files").remove([f.storage_key]);
  const { error } = await supabase.from("vendor_files").delete().eq("id", id).eq("wedding_id", wedding.id);
  return error ? fail(error, "Soubor se nepodařilo smazat.") : done();
}
