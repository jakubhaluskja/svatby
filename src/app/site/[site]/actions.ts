"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { linkDomain } from "@/lib/domain";
import { sendRsvpConfirmation } from "@/lib/email/guest-mail";
import { formatEventTime } from "@/lib/time";
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

  // Potvrzení e-mailem až po odeslání odpovědi (host nečeká).
  const domain = await linkDomain();
  after(async () => {
    try {
      const fresh = await householdByToken(wedding.id, token);
      const to = fresh?.email;
      if (!fresh || !to) return;
      const locale = fresh.locale;
      await sendRsvpConfirmation({
        weddingId: wedding.id,
        to,
        domain,
        householdId: fresh.id,
        token,
        summary: {
          locale,
          household: fresh.name,
          events: fresh.events
            .filter((e) => e.invited)
            .map((e) => ({
              name: e.name,
              when: e.starts_at ? formatEventTime(e.starts_at, locale, wedding.timezone) : null,
              guests: fresh.guests.map((g) => ({
                name: [g.first_name, g.last_name].filter(Boolean).join(" ") || (locale === "en" ? "Guest" : "Host"),
                status: g.responses[e.id] ?? "pending",
              })),
            })),
        },
      });
    } catch (e) {
      console.error("rsvp_confirmation", e);
    }
  });
  return { ok: true };
}

export type UnlockState = { error?: boolean };

/** Odemčení webu chráněného heslem. */
export async function unlockSite(site: string, _: UnlockState, formData: FormData): Promise<UnlockState> {
  const { cookies } = await import("next/headers");
  const { unlockCookieName, unlockToken, verifySitePassword } = await import("@/lib/site-password");
  const wedding = await resolveWedding(site);
  if (!wedding) return { error: true };
  const db = createAdminClient();
  const { data } = await db.from("weddings").select("password_hash").eq("id", wedding.id).single();
  const password = String(formData.get("password") ?? "");
  if (!data?.password_hash || !verifySitePassword(password, data.password_hash)) return { error: true };

  const jar = await cookies();
  jar.set(unlockCookieName(wedding.id), unlockToken(wedding.id, data.password_hash), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 180,
  });
  redirect(`${await siteBase(site)}/`);
}

// -----------------------------------------------------------------------------
// Dary (rezervace a příspěvky přes osobní odkaz domácnosti)
// -----------------------------------------------------------------------------
export type GiftResult = { ok?: boolean; error?: "taken" | "closed" | "failed" | "preview"; qrSvg?: string | null; amount?: number; message?: string };

async function giftContext(site: string, token: string, giftId: string) {
  const wedding = await resolveWedding(site);
  if (!wedding) return { error: "closed" as const };
  if (wedding.preview) return { error: "preview" as const };
  if (!z.string().uuid().safeParse(giftId).success) return { error: "failed" as const };
  const household = await householdByToken(wedding.id, token);
  if (!household) return { error: "closed" as const };
  const db = createAdminClient();
  const { data: gift } = await db.from("gifts").select("id, kind, title").eq("id", giftId).eq("wedding_id", wedding.id).maybeSingle();
  if (!gift) return { error: "failed" as const };
  return { wedding, household, gift, db };
}

function revalidateGuest(site: string, token: string) {
  revalidatePath(`/site/${site}/p/${token}`);
}

export async function reserveGift(site: string, token: string, giftId: string): Promise<GiftResult> {
  const ctx = await giftContext(site, token, giftId);
  if ("error" in ctx) return { error: ctx.error };
  if (ctx.gift.kind !== "item") return { error: "failed" };
  const { error } = await ctx.db.from("gift_reservations").insert({ wedding_id: ctx.wedding.id, gift_id: ctx.gift.id, household_id: ctx.household.id });
  if (error) return { error: error.code === "23505" ? "taken" : "failed" };
  revalidateGuest(site, token);
  return { ok: true };
}

export async function cancelGift(site: string, token: string, giftId: string): Promise<GiftResult> {
  const ctx = await giftContext(site, token, giftId);
  if ("error" in ctx) return { error: ctx.error };
  await ctx.db.from("gift_reservations").delete().eq("gift_id", ctx.gift.id).eq("household_id", ctx.household.id).is("cancelled_at", null);
  revalidateGuest(site, token);
  return { ok: true };
}

/** Příslib příspěvku: zapíše ho a vrátí QR platbu s částkou na účet páru. */
export async function pledgeGift(site: string, token: string, giftId: string, rawAmount: number): Promise<GiftResult> {
  const amount = Math.round(Number(rawAmount));
  if (!Number.isFinite(amount) || amount < 1 || amount > 1_000_000) return { error: "failed" };
  const ctx = await giftContext(site, token, giftId);
  if ("error" in ctx) return { error: ctx.error };
  if (ctx.gift.kind === "item") return { error: "failed" };
  const { error } = await ctx.db.from("gift_contributions").insert({ wedding_id: ctx.wedding.id, gift_id: ctx.gift.id, household_id: ctx.household.id, display_name: ctx.household.name, amount });
  if (error) return { error: "failed" };

  const { data: settings } = await ctx.db.from("gift_settings").select("iban").eq("wedding_id", ctx.wedding.id).maybeSingle();
  const title = ((ctx.gift.title ?? {}) as Record<string, string>).cs ?? "";
  const message = `${title} - ${ctx.household.name}`.slice(0, 60);
  let qrSvg: string | null = null;
  if (settings?.iban) {
    const [{ default: QRCode }, { spayd }] = await Promise.all([import("qrcode"), import("@/lib/payment-qr")]);
    qrSvg = await QRCode.toString(spayd({ iban: settings.iban, amount, message }), { type: "svg", margin: 0, errorCorrectionLevel: "M" });
  }
  revalidateGuest(site, token);
  return { ok: true, qrSvg, amount, message };
}
