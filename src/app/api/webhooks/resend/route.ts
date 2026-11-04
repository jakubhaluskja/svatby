import { NextResponse, type NextRequest } from "next/server";
import { verifyWebhook } from "@/lib/email/send";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const STATUS: Record<string, string> = {
  "email.sent": "sent",
  "email.delivered": "delivered",
  "email.opened": "opened",
  "email.bounced": "bounced",
  "email.complained": "complained",
  "email.failed": "failed",
};
// Stav se posouvá jen dopředu (otevření nepřepíše odražení apod.).
const RANK: Record<string, number> = { queued: 0, sent: 1, delivered: 2, opened: 3, failed: 4, bounced: 4, complained: 5 };

/** Stav doručení z Resend (webhook podepsaný Svixem). */
export async function POST(request: NextRequest) {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: "not configured" }, { status: 503 });
  const payload = await request.text();
  const ok = await verifyWebhook(
    secret,
    request.headers.get("svix-id") ?? "",
    request.headers.get("svix-timestamp") ?? "",
    payload,
    request.headers.get("svix-signature") ?? "",
  );
  if (!ok) return NextResponse.json({ error: "invalid signature" }, { status: 401 });

  let event: { type?: string; data?: { email_id?: string; bounce?: { message?: string } } };
  try {
    event = JSON.parse(payload);
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const status = event.type ? STATUS[event.type] : undefined;
  const id = event.data?.email_id;
  if (!status || !id) return NextResponse.json({ ignored: true });

  const db = createAdminClient();
  const { data: row } = await db.from("email_log").select("id, status, household_id").eq("provider_id", id).maybeSingle();
  if (!row) return NextResponse.json({ ignored: true });
  if ((RANK[status] ?? 0) > (RANK[row.status] ?? 0)) {
    await db
      .from("email_log")
      .update({ status, updated_at: new Date().toISOString(), ...(status === "bounced" ? { error: event.data?.bounce?.message?.slice(0, 500) ?? "bounced" } : {}) })
      .eq("id", row.id);
  }
  // Stížnost na spam = host už nechce další e-maily.
  if (status === "complained" && row.household_id) {
    await db.from("households").update({ unsubscribed_at: new Date().toISOString() }).eq("id", row.household_id).is("unsubscribed_at", null);
  }
  return NextResponse.json({ ok: true });
}
