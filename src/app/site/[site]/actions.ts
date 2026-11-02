"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { householdByToken, resolveWedding, siteBase, tokenByShortCode } from "@/lib/site";
import { createAdminClient } from "@/lib/supabase/admin";

export type CodeState = { error?: boolean };

/** Kód z pozvánky → přesměrování na osobní stránku domácnosti. */
export async function openByCode(site: string, _: CodeState, formData: FormData): Promise<CodeState> {
  const wedding = await resolveWedding(site);
  if (!wedding) return { error: true };
  const token = await tokenByShortCode(wedding.id, String(formData.get("code") ?? ""));
  if (!token) return { error: true };
  redirect(`${await siteBase(site)}/p/${token}`);
}

const statusSchema = z.enum(["yes", "no"]);
const text = (max: number) => z.string().trim().max(max).optional().default("");

const payloadSchema = z.object({
  guests: z
    .array(
      z.object({
        id: z.string().uuid(),
        first_name: text(60),
        last_name: text(60),
        diet: text(200),
        allergies: text(200),
        events: z.record(z.string().uuid(), statusSchema),
      }),
    )
    .max(30),
  plus_ones: z
    .array(
      z.object({
        first_name: z.string().trim().min(1).max(60),
        last_name: text(60),
        age_category_id: z.string().uuid().nullable(),
        diet: text(200),
        allergies: text(200),
        events: z.record(z.string().uuid(), statusSchema),
      }),
    )
    .max(10),
  needs_lodging: z.boolean().nullable(),
  lodging_note: text(300),
  song_wish: text(200),
  message: text(2000),
  email: z.union([z.literal(""), z.string().trim().email()]),
});

export type RsvpPayload = z.infer<typeof payloadSchema>;
export type RsvpResult = { ok?: boolean; error?: "closed" | "plus_ones" | "invalid" | "failed" | "preview" };

export async function submitRsvp(site: string, token: string, payload: RsvpPayload): Promise<RsvpResult> {
  const wedding = await resolveWedding(site);
  if (!wedding) return { error: "failed" };
  if (wedding.preview) return { error: "preview" };

  const parsed = payloadSchema.safeParse(payload);
  if (!parsed.success) return { error: "invalid" };

  const household = await householdByToken(wedding.id, token);
  if (!household) return { error: "failed" };

  // Každý pozvaný musí mít u každé pozvané události odpověď.
  const invited = household.events.filter((e) => e.invited).map((e) => e.id);
  const complete = parsed.data.guests.every((g) => invited.every((id) => g.events[id]));
  if (!complete) return { error: "invalid" };

  const db = createAdminClient();
  const { error } = await db.rpc("submit_household_rsvp", {
    p_token: token,
    p_payload: {
      ...parsed.data,
      guests: parsed.data.guests.map((g) => ({ ...g, diet: g.diet, allergies: g.allergies })),
    },
  });

  if (error) {
    if (error.message.includes("rsvp_closed")) return { error: "closed" };
    if (error.message.includes("too_many_plus_ones")) return { error: "plus_ones" };
    console.error("submit_household_rsvp", error);
    return { error: "failed" };
  }
  return { ok: true };
}
