"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { zonedToUtcIso } from "@/lib/time";
import { requireWedding } from "@/lib/wedding";

export type EventFormState = { error?: string };

const optional = z
  .string()
  .trim()
  .transform((v) => v || null)
  .nullable();

const schema = z
  .object({
    name_cs: z.string().trim().min(1, "Zadejte název události.").max(80),
    name_en: optional,
    date: optional,
    start: optional,
    end: optional,
    location_name: optional,
    address: optional,
    description_cs: optional,
    description_en: optional,
    plan_b_location_name: optional,
    plan_b_address: optional,
    plan_b_note_cs: optional,
    plan_b_note_en: optional,
    visibility: z.enum(["public", "invited"]),
    is_seated: z.boolean(),
  })
  .refine((v) => !v.start || !!v.date, { message: "K času doplňte i datum.", path: ["date"] });

function read(formData: FormData) {
  const get = (k: string) => (formData.get(k) as string | null) ?? null;
  return schema.safeParse({
    name_cs: get("name_cs") ?? "",
    name_en: get("name_en"),
    date: get("date"),
    start: get("start"),
    end: get("end"),
    location_name: get("location_name"),
    address: get("address"),
    description_cs: get("description_cs"),
    description_en: get("description_en"),
    plan_b_location_name: get("plan_b_location_name"),
    plan_b_address: get("plan_b_address"),
    plan_b_note_cs: get("plan_b_note_cs"),
    plan_b_note_en: get("plan_b_note_en"),
    visibility: get("visibility") ?? "public",
    is_seated: formData.get("is_seated") === "on",
  });
}

export async function saveEvent(eventId: string | null, _: EventFormState, formData: FormData): Promise<EventFormState> {
  const wedding = await requireWedding();
  const parsed = read(formData);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const v = parsed.data;

  const starts_at = v.date ? zonedToUtcIso(v.date, v.start ?? "00:00") : null;
  const ends_at = v.date && v.end ? zonedToUtcIso(v.date, v.end) : null;
  if (starts_at && ends_at && ends_at <= starts_at) return { error: "Konec musí být po začátku." };

  const row = {
    name: { cs: v.name_cs, ...(v.name_en ? { en: v.name_en } : {}) },
    description: {
      ...(v.description_cs ? { cs: v.description_cs } : {}),
      ...(v.description_en ? { en: v.description_en } : {}),
    },
    starts_at,
    ends_at,
    location_name: v.location_name,
    address: v.address,
    visibility: v.visibility,
    is_seated: v.is_seated,
    plan_b_location_name: v.plan_b_location_name,
    plan_b_address: v.plan_b_address,
    plan_b_note: {
      ...(v.plan_b_note_cs ? { cs: v.plan_b_note_cs } : {}),
      ...(v.plan_b_note_en ? { en: v.plan_b_note_en } : {}),
    },
    // bez náhradního místa nemůže být plán B aktivní
    ...(v.plan_b_location_name || v.plan_b_address ? {} : { plan_b_active: false }),
  };

  const supabase = await createClient();
  if (eventId) {
    const { error } = await supabase.from("events").update(row).eq("id", eventId).eq("wedding_id", wedding.id);
    if (error) return { error: "Událost se nepodařilo uložit." };
  } else {
    const { count } = await supabase.from("events").select("id", { count: "exact", head: true }).eq("wedding_id", wedding.id);
    const { error } = await supabase.from("events").insert({ ...row, wedding_id: wedding.id, sort: count ?? 0 });
    if (error) return { error: "Událost se nepodařilo uložit." };
  }

  revalidatePath("/app/udalosti");
  redirect("/app/udalosti");
}

export async function deleteEvent(eventId: string) {
  const wedding = await requireWedding();
  const supabase = await createClient();
  await supabase.from("events").delete().eq("id", eventId).eq("wedding_id", wedding.id);
  revalidatePath("/app/udalosti");
  redirect("/app/udalosti");
}

/** Přepnutí na náhradní místo (plán B) a zpět. */
export async function setPlanB(eventId: string, active: boolean) {
  const wedding = await requireWedding();
  const supabase = await createClient();
  await supabase
    .from("events")
    .update({ plan_b_active: active, plan_b_activated_at: active ? new Date().toISOString() : null })
    .eq("id", eventId)
    .eq("wedding_id", wedding.id)
    .or("plan_b_location_name.not.is.null,plan_b_address.not.is.null");
  revalidatePath("/app/web");
  revalidatePath("/app/udalosti");
}
