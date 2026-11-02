"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { matchCategory, parseGuestImport } from "@/lib/guest-import";
import { tr } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/server";
import { requireUser, requireWedding } from "@/lib/wedding";

const guestSchema = z.object({
  id: z.string().uuid().nullable(),
  first_name: z.string().trim().max(60),
  last_name: z.string().trim().max(60),
  age_category_id: z.string().uuid().nullable(),
  needs_high_chair: z.boolean(),
  email: z.string().trim().max(120),
  notes: z.string().trim().max(500),
  tags: z.array(z.string().trim().max(40)).max(20),
});

const householdSchema = z.object({
  id: z.string().uuid().nullable(),
  name: z.string().trim().min(1, "Pojmenujte domácnost, třeba „Novákovi“.").max(80),
  locale: z.enum(["cs", "en"]),
  email: z.union([z.literal(""), z.string().trim().email("E-mail domácnosti není platný.")]),
  plus_ones_allowed: z.number().int().min(0).max(10),
  notes: z.string().trim().max(1000),
  event_ids: z.array(z.string().uuid()),
  guests: z.array(guestSchema).max(30),
});

export type HouseholdInput = z.infer<typeof householdSchema>;
export type SaveResult = { error?: string };

export async function saveHousehold(input: HouseholdInput): Promise<SaveResult> {
  const wedding = await requireWedding();
  const parsed = householdSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const data = { ...parsed.data, guests: parsed.data.guests.filter((g) => g.first_name) };
  if (data.guests.length === 0) return { error: "Přidejte do domácnosti aspoň jednoho hosta." };

  const supabase = await createClient();
  const { data: id, error } = await supabase.rpc("save_household", { p_wedding_id: wedding.id, p_data: data });
  if (error) {
    if (error.message.includes("forbidden")) return { error: "K úpravě hostů nemáte oprávnění." };
    console.error("save_household", error);
    return { error: "Domácnost se nepodařilo uložit. Zkuste to znovu." };
  }

  revalidatePath("/app/hoste");
  redirect(input.id ? `/app/hoste/${id}?ulozeno=1` : `/app/hoste?pridano=${id}`);
}

export async function deleteHousehold(householdId: string) {
  const wedding = await requireWedding();
  const supabase = await createClient();
  await supabase.from("households").delete().eq("id", householdId).eq("wedding_id", wedding.id);
  revalidatePath("/app/hoste");
  redirect("/app/hoste");
}

export async function regenerateLink(householdId: string) {
  await requireWedding();
  const supabase = await createClient();
  const { error } = await supabase.rpc("regenerate_household_link", { p_household_id: householdId });
  if (error) throw new Error("Odkaz se nepodařilo vytvořit.");
  revalidatePath(`/app/hoste/${householdId}`);
}

/** Pár vyplní nebo změní odpověď za hosta (např. po telefonu s babičkou). */
export async function setResponse(householdId: string, guestId: string, eventId: string, status: "pending" | "yes" | "no") {
  const wedding = await requireWedding();
  const user = await requireUser();
  const supabase = await createClient();

  const { error } = await supabase.from("rsvp_responses").upsert(
    { guest_id: guestId, event_id: eventId, wedding_id: wedding.id, status, updated_by: "member", updated_at: new Date().toISOString() },
    { onConflict: "guest_id,event_id" },
  );
  if (error) throw new Error("Odpověď se nepodařilo uložit.");

  await supabase.from("rsvp_log").insert({
    wedding_id: wedding.id,
    household_id: householdId,
    actor_kind: "member",
    actor_user_id: user.id,
    payload: { guest_id: guestId, event_id: eventId, status },
  });
  revalidatePath(`/app/hoste/${householdId}`);
  revalidatePath("/app/hoste");
}

/** Pár upraví údaje z RSVP za domácnost (diety, ubytování…). */
export async function saveRsvpDetails(householdId: string, formData: FormData) {
  const wedding = await requireWedding();
  const supabase = await createClient();
  const lodging = formData.get("needs_lodging");
  await supabase
    .from("households")
    .update({
      needs_lodging: lodging === "yes" ? true : lodging === "no" ? false : null,
      lodging_note: String(formData.get("lodging_note") ?? "").trim() || null,
      song_wish: String(formData.get("song_wish") ?? "").trim() || null,
    })
    .eq("id", householdId)
    .eq("wedding_id", wedding.id);

  for (const [key, value] of formData.entries()) {
    const m = key.match(/^(diet|allergies):(.+)$/);
    if (!m) continue;
    await supabase
      .from("guests")
      .update({ [m[1]]: String(value).trim() || null })
      .eq("id", m[2])
      .eq("household_id", householdId);
  }
  revalidatePath(`/app/hoste/${householdId}`);
}

export type ImportState = { error?: string; created?: number; guests?: number; skipped?: number[] };

export async function importGuests(_: ImportState, formData: FormData): Promise<ImportState> {
  const wedding = await requireWedding();
  const text = String(formData.get("data") ?? "");
  if (!text.trim()) return { error: "Vložte řádky s hosty." };
  const eventIds = formData.getAll("event_ids").map(String);

  const { households, skipped } = parseGuestImport(text);
  if (households.length === 0) return { error: "Nenašli jsme žádné hosty. Zkontrolujte, že druhý sloupec obsahuje jméno.", skipped };
  if (households.length > 500) return { error: "Najednou jde vložit nejvýš 500 domácností." };

  const supabase = await createClient();
  const { data: cats } = await supabase
    .from("age_categories")
    .select("id, name, is_adult, min_age, max_age")
    .eq("wedding_id", wedding.id)
    .order("sort");
  const categories = (cats ?? []).map((c) => ({ ...c, label: tr(c.name) }));

  let guests = 0;
  for (const h of households) {
    const { error } = await supabase.rpc("save_household", {
      p_wedding_id: wedding.id,
      p_data: {
        id: null,
        name: h.name,
        locale: "cs",
        email: h.guests.find((g) => g.email)?.email ?? "",
        plus_ones_allowed: 0,
        notes: "",
        event_ids: eventIds,
        guests: h.guests.map((g) => ({
          id: null,
          first_name: g.first_name,
          last_name: g.last_name ?? "",
          age_category_id: matchCategory(g.category, categories),
          needs_high_chair: false,
          email: g.email ?? "",
          notes: "",
          tags: [],
        })),
      },
    });
    if (error) return { error: `Import se zastavil u domácnosti „${h.name}“. Předchozí domácnosti jsou uložené.` };
    guests += h.guests.length;
  }

  revalidatePath("/app/hoste");
  return { created: households.length, guests, skipped };
}
