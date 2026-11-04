import Link from "next/link";
import { notFound } from "next/navigation";
import { Icon } from "@/components/icons";
import { Card, Eyebrow } from "@/components/ui";
import { PACKAGE_LABEL, REASON_LABEL, STATUS_LABEL, requireAdmin } from "@/lib/admin";
import { linkDomain } from "@/lib/domain";
import { siteUrl } from "@/lib/hosts";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { ClientRow } from "../../page";
import { ImpersonateButton, OwnerEmailForm, SuspensionPanel, WeddingForm } from "./forms";

export const metadata = { title: "Klient" };

const dt = new Intl.DateTimeFormat("cs-CZ", { day: "numeric", month: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Prague" });
const fmt = (v: string | null) => (v ? dt.format(new Date(v)) : "–");

const ACTION: Record<string, string> = {
  "admin.update_wedding": "Úprava údajů",
  "admin.suspend": "Pozastavení služby",
  "admin.unsuspend": "Obnovení služby",
  "admin.impersonate": "Přihlášení za klienta",
  "admin.change_owner_email": "Změna e-mailu vlastníka",
};
const ROLE: Record<string, string> = { owner: "Vlastník", partner: "Partner/ka", coorganizer: "Spoluorganizátor" };

type Props = { params: Promise<{ id: string }> };

export default async function AdminClient({ params }: Props) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const admin = await requireAdmin();
  const supabase = await createClient();
  const [{ data: clients }, { data: w }, { data: members }, { data: audit }, { count: mailCount }] = await Promise.all([
    supabase.rpc("admin_clients"),
    supabase
      .from("weddings")
      .select("id, slug, partner1_name, partner2_name, wedding_date, default_locale, status, package, web_expires_at, suspended_at, suspended_reason, suspended_note, admin_note")
      .eq("id", id)
      .maybeSingle(),
    supabase.from("wedding_members").select("id, user_id, role, invited_email, accepted_at").eq("wedding_id", id).order("invited_at"),
    supabase.from("audit_log").select("id, actor_user_id, action, payload, created_at").eq("wedding_id", id).like("action", "admin.%").order("created_at", { ascending: false }).limit(20),
    supabase.from("email_log").select("id", { count: "exact", head: true }).eq("wedding_id", id),
  ]);
  const domain = await linkDomain();
  const client = ((clients ?? []) as ClientRow[]).find((c) => c.id === id);
  if (!w || !client) notFound();

  // E-maily členů a autorů záznamů (auth.users čte jen server s tajným klíčem).
  const db = createAdminClient();
  const ids = [...new Set([...(members ?? []).map((m) => m.user_id), ...(audit ?? []).map((a) => a.actor_user_id)].filter(Boolean) as string[])];
  const users = new Map<string, string>();
  await Promise.all(
    ids.map(async (uid) => {
      const { data } = await db.auth.admin.getUserById(uid);
      if (data.user?.email) users.set(uid, data.user.email);
    }),
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <Link href="/admin" className="text-sm text-ink-soft hover:text-ink">
            ← Klienti
          </Link>
          <h1 className="mt-1 font-serif text-3xl">
            {w.partner1_name} & {w.partner2_name}
          </h1>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-ink-soft">
            <a href={siteUrl(w.slug, domain)} target="_blank" rel="noreferrer" className="underline decoration-line underline-offset-2 hover:text-ink">
              {siteUrl(w.slug, domain).replace(/^https?:\/\//, "")}
            </a>
            <span>·</span>
            <span>{STATUS_LABEL[w.status]}</span>
            <span>·</span>
            <span>{PACKAGE_LABEL[w.package]}</span>
            {w.suspended_at ? (
              <span className="rounded-full bg-danger/10 px-2.5 py-0.5 text-xs font-medium text-danger">Pozastaveno – {REASON_LABEL[w.suspended_reason ?? "other"]}</span>
            ) : null}
          </p>
        </div>
        <div className="ml-auto">
          <ImpersonateButton id={w.id} disabled={!client.owner_email || client.owner_id === admin.id} />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex flex-col gap-6">
          <Card className="p-6">
            <h2 className="font-serif text-xl">Údaje svatby</h2>
            <WeddingForm
              id={w.id}
              superadmin={admin.role === "superadmin"}
              initial={{
                partner1_name: w.partner1_name,
                partner2_name: w.partner2_name,
                slug: w.slug,
                wedding_date: w.wedding_date ?? "",
                default_locale: w.default_locale,
                package: w.package,
                status: w.status === "deleted" ? "draft" : w.status,
                web_expires_at: w.web_expires_at ? w.web_expires_at.slice(0, 10) : "",
                admin_note: w.admin_note ?? "",
              }}
            />
          </Card>

          <Card className="p-6">
            <h2 className="font-serif text-xl">Historie zásahů správce</h2>
            {audit?.length ? (
              <ul className="mt-4 divide-y divide-line/70 text-sm">
                {audit.map((a) => (
                  <li key={a.id} className="flex flex-wrap gap-x-3 py-2.5">
                    <span className="w-36 shrink-0 tabular-nums text-ink-soft">{fmt(a.created_at)}</span>
                    <span className="font-medium">{ACTION[a.action] ?? a.action}</span>
                    {a.action === "admin.suspend" ? <span className="text-ink-soft">{REASON_LABEL[(a.payload as { reason?: string }).reason ?? "other"]}</span> : null}
                    <span className="ml-auto text-ink-soft">{a.actor_user_id ? (users.get(a.actor_user_id) ?? "správce") : "systém"}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-ink-soft">Zatím žádné zásahy.</p>
            )}
          </Card>
        </div>

        <div className="flex flex-col gap-6">
          <Card className="p-6">
            <h2 className="font-serif text-xl">Služba</h2>
            <SuspensionPanel id={w.id} suspended={w.suspended_at ? { at: fmt(w.suspended_at), reason: REASON_LABEL[w.suspended_reason ?? "other"], note: w.suspended_note } : null} />
          </Card>

          <Card className="p-6">
            <h2 className="font-serif text-xl">Vlastník účtu</h2>
            <p className="mt-1 text-sm text-ink-soft">
              {client.owner_name || "Bez jména"} · naposledy přihlášen {fmt(client.last_sign_in_at)}
            </p>
            {client.owner_email ? <OwnerEmailForm id={w.id} email={client.owner_email} /> : <p className="mt-3 text-sm">Svatba nemá vlastníka.</p>}
          </Card>

          <Card className="p-6">
            <h2 className="font-serif text-xl">Přehled</h2>
            <dl className="mt-3 grid grid-cols-2 gap-y-2 text-sm">
              <dt className="text-ink-soft">Domácností</dt>
              <dd className="text-right tabular-nums">{client.households}</dd>
              <dt className="text-ink-soft">Hostů</dt>
              <dd className="text-right tabular-nums">{client.guests}</dd>
              <dt className="text-ink-soft">Odeslaných e-mailů</dt>
              <dd className="text-right tabular-nums">{mailCount ?? "–"}</dd>
              <dt className="text-ink-soft">Založeno</dt>
              <dd className="text-right tabular-nums">{fmt(client.created_at)}</dd>
            </dl>
            <Eyebrow className="mt-5">Tým svatby</Eyebrow>
            <ul className="mt-2 flex flex-col gap-1.5 text-sm">
              {(members ?? []).map((m) => (
                <li key={m.id} className="flex items-center gap-2">
                  <Icon n="user" className="size-4 text-ink-soft" />
                  <span className="min-w-0 truncate">{(m.user_id && users.get(m.user_id)) || m.invited_email || "–"}</span>
                  <span className="ml-auto shrink-0 text-ink-soft">
                    {ROLE[m.role] ?? m.role}
                    {m.accepted_at ? "" : " · pozván"}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}
