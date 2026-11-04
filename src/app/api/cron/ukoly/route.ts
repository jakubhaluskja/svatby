import { NextResponse, type NextRequest } from "next/server";
import { appOrigin } from "@/lib/email/guest-mail";
import { emailEnabled, sendEmail } from "@/lib/email/send";
import { taskReminder } from "@/lib/email/templates";
import { appDomain } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { utcToZonedParts } from "@/lib/time";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const addDays = (date: string, n: number) => new Date(Date.parse(`${date}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

/**
 * Denní upozornění na úkoly (Vercel Cron). Každý úkol se připomene jednou – 3 dny před termínem,
 * nebo hned, pokud je termín blíž. Úkol bez přiřazení dostane pár.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "CRON_SECRET není nastavený" }, { status: 503 });
  if (request.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!emailEnabled()) return NextResponse.json({ skipped: "e-maily nejsou zapnuté" });

  const db = createAdminClient();
  const today = utcToZonedParts(new Date().toISOString()).date;
  const { data: tasks, error } = await db
    .from("tasks")
    .select("id, wedding_id, title, due_date, assignee_member_id, assignee_email, assignee_name, weddings!inner(partner1_name, partner2_name, status, suspended_at)")
    .is("done_at", null)
    .is("reminded_at", null)
    .gte("due_date", addDays(today, -14))
    .lte("due_date", addDays(today, 3))
    .is("weddings.suspended_at", null)
    .neq("weddings.status", "deleted")
    .limit(5000);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!tasks?.length) return NextResponse.json({ sent: 0 });

  const weddingIds = [...new Set(tasks.map((t) => t.wedding_id))];
  const { data: members } = await db
    .from("wedding_members")
    .select("id, wedding_id, user_id, role, display_name")
    .in("wedding_id", weddingIds)
    .not("accepted_at", "is", null);

  const emails = new Map<string, { email: string; name: string | null }>();
  for (const uid of new Set((members ?? []).map((m) => m.user_id).filter(Boolean) as string[])) {
    const [{ data: u }, { data: p }] = await Promise.all([
      db.auth.admin.getUserById(uid),
      db.from("profiles").select("full_name").eq("id", uid).maybeSingle(),
    ]);
    if (u.user?.email) emails.set(uid, { email: u.user.email, name: p?.full_name ?? null });
  }
  const memberById = new Map((members ?? []).map((m) => [m.id, m]));

  // příjemce → úkoly
  type Digest = { weddingId: string; couple: string; email: string; name: string | null; tasks: typeof tasks };
  const digests = new Map<string, Digest>();
  const push = (weddingId: string, couple: string, email: string, name: string | null, task: (typeof tasks)[number]) => {
    const key = `${weddingId}|${email.toLowerCase()}`;
    const d = digests.get(key) ?? { weddingId, couple, email, name, tasks: [] };
    d.tasks.push(task);
    digests.set(key, d);
  };

  for (const t of tasks) {
    const w = t.weddings as unknown as { partner1_name: string; partner2_name: string };
    const couple = `${w.partner1_name} a ${w.partner2_name}`;
    if (t.assignee_email) {
      push(t.wedding_id, couple, t.assignee_email, t.assignee_name, t);
    } else if (t.assignee_member_id) {
      const m = memberById.get(t.assignee_member_id);
      const u = m?.user_id ? emails.get(m.user_id) : null;
      if (u) push(t.wedding_id, couple, u.email, m?.display_name ?? u.name, t);
    } else {
      for (const m of members ?? []) {
        if (m.wedding_id !== t.wedding_id || (m.role !== "owner" && m.role !== "partner") || !m.user_id) continue;
        const u = emails.get(m.user_id);
        if (u) push(t.wedding_id, couple, u.email, m.display_name ?? u.name, t);
      }
    }
  }

  const origin = appOrigin(appDomain());
  const reminded = new Set<string>();
  let sent = 0;
  for (const d of digests.values()) {
    const sorted = [...d.tasks].sort((a, b) => (a.due_date! < b.due_date! ? -1 : 1));
    const e = taskReminder({
      name: d.name?.split(" ")[0] ?? null,
      couple: d.couple,
      appUrl: origin,
      tasks: sorted.map((t) => ({ title: t.title, due: t.due_date!, overdue: t.due_date! < today })),
    });
    const r = await sendEmail({ to: d.email, ...e });
    await db.from("email_log").insert({
      wedding_id: d.weddingId,
      template: "task_reminder",
      to_email: d.email,
      provider_id: "id" in r ? r.id : null,
      status: "id" in r ? "sent" : "failed",
      error: "error" in r ? r.error.slice(0, 500) : null,
    });
    if ("id" in r) {
      sent++;
      for (const t of d.tasks) reminded.add(t.id);
    }
  }
  // Úkoly bez příjemce (přiřazené členovi bez e-mailu) neopakujeme každý den.
  for (const t of tasks) if (![...digests.values()].some((d) => d.tasks.includes(t))) reminded.add(t.id);
  if (reminded.size) await db.from("tasks").update({ reminded_at: new Date().toISOString() }).in("id", [...reminded]);

  return NextResponse.json({ sent, tasks: reminded.size });
}
