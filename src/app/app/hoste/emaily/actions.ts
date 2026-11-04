"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { linkDomain } from "@/lib/domain";
import { sendGuestEmails, weddingInfo, type SendSummary } from "@/lib/email/guest-mail";
import { guestEmail } from "@/lib/email/templates";
import { createClient } from "@/lib/supabase/server";
import { moduleLevel, requireUser, requireWedding } from "@/lib/wedding";

const input = z.object({
  kind: z.enum(["invitation", "reminder", "message", "thank_you"]),
  ids: z.array(z.string().uuid()).max(1000),
  subject: z.string().trim().max(150).default(""),
  note: z.string().trim().max(5000).default(""),
  subjectEn: z.string().trim().max(150).default(""),
  noteEn: z.string().trim().max(5000).default(""),
});
export type ComposeInput = z.input<typeof input>;
export type SendState = SendSummary & { error?: string };

export async function sendEmails(raw: ComposeInput): Promise<SendState> {
  const wedding = await requireWedding();
  const parsed = input.safeParse(raw);
  if (!parsed.success) return { sent: 0, skipped: 0, failed: 0, error: "Neplatný požadavek." };
  const v = parsed.data;
  if (wedding.suspended_at) return { sent: 0, skipped: 0, failed: 0, error: "Služba je pozastavená." };
  if ((await moduleLevel(wedding.id, "guests")) !== "write") return { sent: 0, skipped: 0, failed: 0, error: "K hostům nemáte oprávnění." };
  if (!v.ids.length) return { sent: 0, skipped: 0, failed: 0, error: "Vyberte aspoň jednu domácnost." };
  if (v.kind === "message" && (!v.subject || !v.note)) return { sent: 0, skipped: 0, failed: 0, error: "Vyplňte předmět i text zprávy." };

  const supabase = await createClient();
  // Ověření, že domácnosti patří ke svatbě (přes RLS).
  const { data: own } = await supabase.from("households").select("id").eq("wedding_id", wedding.id).in("id", v.ids);
  let ids = (own ?? []).map((h) => h.id);

  // Připomínku stejné domácnosti nejvýš jednou za 24 hodin.
  if (v.kind === "reminder" && ids.length) {
    const since = new Date(Date.now() - 86_400_000).toISOString();
    const { data: recent } = await supabase.from("email_log").select("household_id").eq("wedding_id", wedding.id).eq("template", "reminder").gte("created_at", since).in("household_id", ids);
    const recentIds = new Set((recent ?? []).map((r) => r.household_id));
    ids = ids.filter((id) => !recentIds.has(id));
  }

  const result = await sendGuestEmails({
    weddingId: wedding.id,
    householdIds: ids,
    kind: v.kind,
    domain: await linkDomain(),
    note: v.note || undefined,
    subject: v.subject || undefined,
    noteEn: v.noteEn || undefined,
    subjectEn: v.subjectEn || undefined,
  });
  if (result.error === "disabled") return { ...result, error: "Odesílání e-mailů zatím není zapnuté." };

  if (v.kind === "message" && result.sent > 0) {
    const user = await requireUser();
    await supabase.from("broadcasts").insert({
      wedding_id: wedding.id,
      kind: "message",
      audience: "households",
      household_ids: ids,
      subject: { cs: v.subject, ...(v.subjectEn ? { en: v.subjectEn } : {}) },
      body: { cs: v.note, ...(v.noteEn ? { en: v.noteEn } : {}) },
      send_email: true,
      show_banner: false,
      sent_at: new Date().toISOString(),
      created_by: user.id,
    });
  }
  revalidatePath("/app/hoste", "layout");
  return { ...result, skipped: result.skipped + (v.ids.length - ids.length) };
}

/** Náhled e-mailu tak, jak ho uvidí první vybraná domácnost. */
export async function previewEmail(raw: ComposeInput & { locale?: "cs" | "en" }): Promise<{ subject: string; html: string } | null> {
  const wedding = await requireWedding();
  const parsed = input.safeParse(raw);
  if (!parsed.success) return null;
  const v = parsed.data;
  const domain = await linkDomain();
  const wi = await weddingInfo(wedding.id, domain);
  if (!wi) return null;
  const supabase = await createClient();
  const first = v.ids[0]
    ? (await supabase.from("households").select("name, token, short_code, locale").eq("wedding_id", wedding.id).eq("id", v.ids[0]).maybeSingle()).data
    : null;
  const locale = raw.locale ?? (first?.locale as "cs" | "en" | undefined) ?? "cs";
  const token = first?.token ?? "ukazka";
  const e = guestEmail({
    kind: v.kind,
    locale,
    wedding: wi.info,
    household: first?.name ?? (locale === "en" ? "Smith family" : "Novákovi"),
    personalUrl: `${wi.info.siteUrl}/p/${token}`,
    shortCode: first?.short_code ?? "ABC123",
    unsubscribeUrl: "#",
    note: (locale === "en" ? v.noteEn : v.note) || v.note || undefined,
    subject: (locale === "en" ? v.subjectEn : v.subject) || v.subject || undefined,
  });
  return { subject: e.subject, html: e.html };
}
