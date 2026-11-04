import "server-only";
import { householdUrl, siteUrl } from "@/lib/hosts";
import { createAdminClient } from "@/lib/supabase/admin";
import { emailEnabled, sendBatch, sendEmail, type OutgoingEmail } from "./send";
import { guestEmail, rsvpConfirmation, type Locale, type RsvpSummary, type WeddingInfo } from "./templates";

export type GuestKind = "invitation" | "reminder" | "message" | "thank_you";
export type SendSummary = { sent: number; skipped: number; failed: number; error?: string };

/** Adresa aplikace s protokolem (pro odkazy v e-mailech). */
export function appOrigin(domain: string): string {
  return `${domain.startsWith("localhost") || domain.startsWith("127.") ? "http" : "https"}://${domain}`;
}

export const unsubscribeUrl = (domain: string, token: string) => `${appOrigin(domain)}/odhlaseni/${token}`;

type WeddingRow = {
  id: string;
  slug: string;
  partner1_name: string;
  partner2_name: string;
  wedding_date: string | null;
  rsvp_deadline: string | null;
  suspended_at: string | null;
};

/** Údaje svatby pro e-maily (jméno páru, datum, místo prvního obřadu, kontakt pro odpovědi). */
export async function weddingInfo(weddingId: string, domain: string): Promise<{ info: WeddingInfo; row: WeddingRow; replyTo: string | null } | null> {
  const db = createAdminClient();
  const [{ data: w }, { data: ev }, { data: owner }] = await Promise.all([
    db.from("weddings").select("id, slug, partner1_name, partner2_name, wedding_date, rsvp_deadline, suspended_at").eq("id", weddingId).maybeSingle(),
    db.from("events").select("location_name").eq("wedding_id", weddingId).not("location_name", "is", null).order("starts_at", { ascending: true, nullsFirst: false }).limit(1).maybeSingle(),
    db.from("wedding_members").select("user_id").eq("wedding_id", weddingId).eq("role", "owner").not("accepted_at", "is", null).limit(1).maybeSingle(),
  ]);
  if (!w) return null;
  let replyTo: string | null = null;
  if (owner?.user_id) replyTo = (await db.auth.admin.getUserById(owner.user_id)).data.user?.email ?? null;
  return {
    row: w as WeddingRow,
    replyTo,
    info: {
      partner1: w.partner1_name,
      partner2: w.partner2_name,
      date: w.wedding_date,
      place: ev?.location_name ?? null,
      deadline: w.rsvp_deadline,
      siteUrl: siteUrl(w.slug, domain),
    },
  };
}

const unsubHeaders = (url: string) => ({
  "List-Unsubscribe": `<${url.replace("/odhlaseni/", "/api/odhlaseni/")}>`,
  "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
});

/**
 * Rozešle e-mail vybraným domácnostem. Oprávnění musí ověřit volající.
 * Přeskočí domácnosti bez e-mailu, odhlášené a u připomínky ty, kdo už odpověděli.
 */
export async function sendGuestEmails(opts: {
  weddingId: string;
  householdIds: string[];
  kind: GuestKind;
  domain: string;
  note?: string;
  subject?: string;
  subjectEn?: string;
  noteEn?: string;
  template?: string;
}): Promise<SendSummary> {
  if (!emailEnabled()) return { sent: 0, skipped: 0, failed: 0, error: "disabled" };
  const ids = [...new Set(opts.householdIds)];
  if (!ids.length) return { sent: 0, skipped: 0, failed: 0 };
  const wi = await weddingInfo(opts.weddingId, opts.domain);
  if (!wi || wi.row.suspended_at) return { sent: 0, skipped: ids.length, failed: 0, error: "unavailable" };

  const db = createAdminClient();
  const { data: households } = await db
    .from("households")
    .select("id, name, token, short_code, locale, email, unsubscribed_at, rsvp_submitted_at")
    .eq("wedding_id", opts.weddingId)
    .in("id", ids);

  const targets = (households ?? []).filter(
    (h) => h.email && !h.unsubscribed_at && !(opts.kind === "reminder" && h.rsvp_submitted_at),
  );
  const skipped = ids.length - targets.length;
  if (!targets.length) return { sent: 0, skipped, failed: 0 };

  const messages: OutgoingEmail[] = targets.map((h) => {
    const locale = (h.locale as Locale) ?? "cs";
    const unsub = unsubscribeUrl(opts.domain, h.token);
    const e = guestEmail({
      kind: opts.kind,
      locale,
      wedding: wi.info,
      household: h.name,
      personalUrl: householdUrl(wi.row.slug, h.token, opts.domain),
      shortCode: h.short_code,
      unsubscribeUrl: unsub,
      note: locale === "en" && opts.noteEn ? opts.noteEn : opts.note,
      subject: locale === "en" && opts.subjectEn ? opts.subjectEn : opts.subject,
    });
    return { to: h.email as string, ...e, replyTo: wi.replyTo, headers: unsubHeaders(unsub) };
  });

  const results = await sendBatch(messages, `${wi.info.partner1} & ${wi.info.partner2}`);
  const now = new Date().toISOString();
  await db.from("email_log").insert(
    targets.map((h, i) => {
      const r = results[i];
      return {
        wedding_id: opts.weddingId,
        household_id: h.id,
        template: opts.template ?? opts.kind,
        to_email: h.email,
        provider_id: "id" in r ? r.id : null,
        status: "id" in r ? "sent" : "failed",
        error: "error" in r ? r.error.slice(0, 500) : null,
      };
    }),
  );

  const okIds = targets.filter((_, i) => "id" in results[i]).map((h) => h.id);
  if (okIds.length && opts.kind === "invitation") {
    await db.from("households").update({ invited_at: now }).in("id", okIds).is("invited_at", null);
  }
  if (okIds.length && opts.kind === "thank_you") {
    await db.from("households").update({ thanked_at: now }).in("id", okIds);
  }
  return { sent: okIds.length, skipped, failed: targets.length - okIds.length };
}

/** Potvrzení odpovědi hostovi (transakční e-mail, posílá se i odhlášeným). */
export async function sendRsvpConfirmation(opts: {
  weddingId: string;
  to: string;
  domain: string;
  householdId: string;
  token: string;
  summary: Omit<RsvpSummary, "wedding" | "personalUrl" | "unsubscribeUrl">;
}): Promise<void> {
  if (!emailEnabled()) return;
  const wi = await weddingInfo(opts.weddingId, opts.domain);
  if (!wi) return;
  const unsub = unsubscribeUrl(opts.domain, opts.token);
  const e = rsvpConfirmation({
    ...opts.summary,
    wedding: wi.info,
    personalUrl: householdUrl(wi.row.slug, opts.token, opts.domain),
    unsubscribeUrl: unsub,
  });
  const r = await sendEmail({ to: opts.to, ...e, replyTo: wi.replyTo }, `${wi.info.partner1} & ${wi.info.partner2}`);
  await createAdminClient()
    .from("email_log")
    .insert({
      wedding_id: opts.weddingId,
      household_id: opts.householdId,
      template: "rsvp_confirmation",
      to_email: opts.to,
      provider_id: "id" in r ? r.id : null,
      status: "id" in r ? "sent" : "failed",
      error: "error" in r ? r.error.slice(0, 500) : null,
    });
}
