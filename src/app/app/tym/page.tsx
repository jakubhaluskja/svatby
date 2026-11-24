import { linkDomain } from "@/lib/domain";
import { appOrigin } from "@/lib/email/guest-mail";
import { emailEnabled } from "@/lib/email/send";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { Permissions } from "@/lib/team";
import { requireUser, requireWedding } from "@/lib/wedding";
import { TeamView, type Member } from "./team-view";

export const metadata = { title: "Tým svatby" };

export default async function TeamPage() {
  const [wedding, user] = await Promise.all([requireWedding(), requireUser()]);
  const manage = wedding.role !== "coorganizer" && !wedding.suspended_at;
  const supabase = await createClient();
  const [{ data: rows }, { data: contributors }] = await Promise.all([
    supabase
      .from("wedding_members")
      .select("id, user_id, role, permissions, contributor_id, display_name, invited_email, invite_token, invited_at, accepted_at")
      .eq("wedding_id", wedding.id)
      .order("invited_at"),
    supabase.from("contributors").select("id, name").eq("wedding_id", wedding.id).order("sort"),
  ]);

  // E-maily přijatých členů (auth.users čte jen server).
  const db = createAdminClient();
  const emails = new Map<string, string>();
  const names = new Map<string, string>();
  const ids = (rows ?? []).map((r) => r.user_id).filter(Boolean) as string[];
  await Promise.all(
    ids.map(async (id) => {
      const [{ data: u }, { data: p }] = await Promise.all([db.auth.admin.getUserById(id), db.from("profiles").select("full_name").eq("id", id).maybeSingle()]);
      if (u.user?.email) emails.set(id, u.user.email);
      if (p?.full_name) names.set(id, p.full_name);
    }),
  );
  const origin = appOrigin(await linkDomain());
  const expiry = Date.now() - 30 * 86_400_000;

  const members: Member[] = (rows ?? []).map((r) => ({
    id: r.id,
    role: r.role as Member["role"],
    name: r.display_name || (r.user_id ? names.get(r.user_id) : null) || null,
    email: (r.user_id ? emails.get(r.user_id) : null) ?? r.invited_email ?? null,
    me: r.user_id === user.id,
    accepted: !!r.accepted_at,
    expired: !r.accepted_at && Date.parse(r.invited_at) < expiry,
    permissions: (r.permissions ?? {}) as Permissions,
    contributorId: r.contributor_id,
    link: manage && !r.accepted_at && r.invite_token ? `${origin}/pozvanka/${r.invite_token}` : null,
  }));

  return (
    <div className="flex max-w-4xl flex-col gap-8 px-6 py-8 sm:px-10 lg:py-10">
      <div className="flex flex-col gap-2">
        <h1 className="font-serif text-4xl tracking-tight">Tým svatby</h1>
        <p className="max-w-2xl text-ink-soft">
          Pozvěte partnera nebo partnerku a lidi, kteří vám s přípravami pomáhají – svědky, rodiče, koordinátora. U každého určíte, co uvidí a co může
          upravovat.
        </p>
      </div>
      <TeamView members={members} contributors={contributors ?? []} manage={manage} emailOn={emailEnabled()} />
    </div>
  );
}
