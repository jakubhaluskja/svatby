import { appOrigin } from "@/lib/email/guest-mail";
import { appDomain } from "@/lib/env";
import { buildIcs, type IcsItem } from "@/lib/ics";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type Level = "none" | "read" | "write" | "own";

/** Odběr kalendáře člena týmu: události svatby, úkoly s termínem, platby. */
export async function GET(_: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token: raw } = await params;
  const token = raw.replace(/\.ics$/, "");
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(token)) return new Response("Not found", { status: 404 });
  const db = createAdminClient();
  const { data: m } = await db
    .from("wedding_members")
    .select("wedding_id, role, permissions, accepted_at, weddings!inner(partner1_name, partner2_name, wedding_date, status, suspended_at)")
    .eq("calendar_token", token)
    .maybeSingle();
  const w = m?.weddings as unknown as { partner1_name: string; partner2_name: string; wedding_date: string | null; status: string; suspended_at: string | null } | undefined;
  if (!m || !m.accepted_at || !w || w.status === "deleted") return new Response("Not found", { status: 404 });

  const perm = (mod: string): Level => (m.role === "coorganizer" ? (((m.permissions ?? {}) as Record<string, Level>)[mod] ?? "none") : "write");
  const origin = appOrigin(appDomain());
  const couple = `${w.partner1_name} a ${w.partner2_name}`;
  const items: IcsItem[] = [];

  if (w.wedding_date) items.push({ uid: `svatba-${m.wedding_id}@svatby`, title: `Svatba ${couple}`, start: w.wedding_date, allDay: true, url: `${origin}/app` });

  const [events, tasks, payments] = await Promise.all([
    perm("guests") !== "none" || perm("checklist") !== "none"
      ? db.from("events").select("id, name, starts_at, ends_at, location_name, address").eq("wedding_id", m.wedding_id).not("starts_at", "is", null)
      : Promise.resolve({ data: [] }),
    perm("checklist") !== "none"
      ? db.from("tasks").select("id, title, description, due_date, budget_payment_id").eq("wedding_id", m.wedding_id).is("done_at", null).not("due_date", "is", null).is("budget_payment_id", null)
      : Promise.resolve({ data: [] }),
    perm("budget") === "read" || perm("budget") === "write"
      ? db.from("budget_payments").select("id, label, amount, currency, due_date, budget_items(name)").eq("wedding_id", m.wedding_id).is("paid_at", null).not("due_date", "is", null)
      : Promise.resolve({ data: [] }),
  ]);

  for (const e of (events.data ?? []) as { id: string; name: Record<string, string>; starts_at: string; ends_at: string | null; location_name: string | null; address: string | null }[]) {
    items.push({
      uid: `event-${e.id}@svatby`,
      title: e.name.cs || e.name.en || "Událost",
      start: e.starts_at,
      end: e.ends_at,
      location: [e.location_name, e.address].filter(Boolean).join(", ") || undefined,
      alarmMinutes: 120,
    });
  }
  for (const t of (tasks.data ?? []) as { id: string; title: string; description: string | null; due_date: string }[]) {
    items.push({ uid: `task-${t.id}@svatby`, title: `☐ ${t.title}`, description: t.description ?? undefined, start: t.due_date, allDay: true, url: `${origin}/app/checklist`, alarmMinutes: 540 });
  }
  const fmt = (n: number, c: string) => new Intl.NumberFormat("cs-CZ", { style: "currency", currency: c, maximumFractionDigits: 0 }).format(n);
  for (const p of (payments.data ?? []) as unknown as { id: string; label: string | null; amount: number; currency: string; due_date: string; budget_items: { name: string } | null }[]) {
    items.push({
      uid: `payment-${p.id}@svatby`,
      title: `Zaplatit: ${p.label || "platba"} – ${p.budget_items?.name ?? ""} (${fmt(Number(p.amount), p.currency)})`,
      start: p.due_date,
      allDay: true,
      url: `${origin}/app/rozpocet?tab=platby`,
      alarmMinutes: 540,
    });
  }

  return new Response(buildIcs(`Svatba ${couple}`, items), {
    headers: { "Content-Type": "text/calendar; charset=utf-8", "Cache-Control": "private, max-age=900", "Content-Disposition": 'inline; filename="svatba.ics"' },
  });
}
