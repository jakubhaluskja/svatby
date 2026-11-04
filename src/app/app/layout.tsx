import { Sidebar } from "@/components/app-nav";
import { daysUntil, formatWeddingDate } from "@/components/site/site-hero";
import { createClient } from "@/lib/supabase/server";
import { utcToZonedParts } from "@/lib/time";
import { REASON_LABEL, impersonatedBy } from "@/lib/admin";
import { getCurrentWedding, requireUser } from "@/lib/wedding";
import { signOut } from "../(auth)/actions";
import { endImpersonation } from "../admin/actions";

export const dynamic = "force-dynamic";

const ROLE = { owner: "Vlastník svatby", partner: "Partner/ka", coorganizer: "Spoluorganizátor" } as const;

function daysWord(n: number) {
  return n === 1 ? "den" : n >= 2 && n <= 4 ? "dny" : "dní";
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const [user, wedding, adminEmail] = await Promise.all([requireUser(), getCurrentWedding(), impersonatedBy()]);
  const impersonation = adminEmail ? (
    <div className="sticky top-0 z-50 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 bg-plum px-4 py-2 text-sm text-white print:hidden">
      <span>
        Jste přihlášeni za klienta <strong>{user.email}</strong> (správce {adminEmail}).
      </span>
      <form action={endImpersonation}>
        <button type="submit" className="rounded-full bg-white/15 px-3 py-1 font-medium hover:bg-white/25">
          Zpět do administrace
        </button>
      </form>
    </div>
  ) : null;
  if (!wedding)
    return (
      <div className="min-h-svh">
        {impersonation}
        {children}
      </div>
    );

  const supabase = await createClient();
  const today = utcToZonedParts(new Date().toISOString()).date;
  const inWeek = new Date(Date.parse(`${today}T00:00:00Z`) + 7 * 86_400_000).toISOString().slice(0, 10);
  const [{ data: profile }, { count: tasks }, { count: guests }, { data: adminRow }, { data: suspension }] = await Promise.all([
    supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle(),
    supabase
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .eq("wedding_id", wedding.id)
      .is("parent_id", null)
      .is("done_at", null)
      .lte("due_date", inWeek),
    supabase.from("guests").select("id", { count: "exact", head: true }).eq("wedding_id", wedding.id),
    supabase.from("platform_admins").select("role").eq("user_id", user.id).maybeSingle(),
    wedding.suspended_at
      ? supabase.from("weddings").select("suspended_note").eq("id", wedding.id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const days = wedding.wedding_date ? daysUntil(wedding.wedding_date) : null;
  const dateLine = wedding.wedding_date
    ? `${formatWeddingDate(wedding.wedding_date)}${days !== null && days > 0 ? ` · za ${days} ${daysWord(days)}` : days === 0 ? " · dnes" : ""}`
    : null;

  return (
    <>
    {impersonation}
    <div className="flex min-h-svh flex-col lg:flex-row">
      <Sidebar
        couple={`${wedding.partner1_name} & ${wedding.partner2_name}`}
        dateLine={dateLine}
        userName={profile?.full_name || user.email || "Účet"}
        userRole={ROLE[wedding.role]}
        badges={{ tasks: tasks ?? 0, guests: guests ?? 0 }}
        isAdmin={!!adminRow}
        signOut={signOut}
      />
      <div className="min-w-0 flex-1">
        {wedding.suspended_at ? (
          <div role="alert" className="border-b border-danger/20 bg-danger/8 px-6 py-4 text-sm text-danger lg:px-10">
            <p className="font-semibold">Služba je pozastavená ({REASON_LABEL[wedding.suspended_reason ?? "other"].toLowerCase()}).</p>
            <p className="mt-0.5 text-ink">
              {suspension?.suspended_note ? `${suspension.suspended_note} ` : ""}
              Svatební web a odkazy pro hosty jsou nedostupné, data můžete jen prohlížet. Pro obnovení nás kontaktujte na{" "}
              <a href="mailto:info@jakubhaluska.cz" className="underline">
                info@jakubhaluska.cz
              </a>
              .
            </p>
          </div>
        ) : null}
        {children}
      </div>
    </div>
    </>
  );
}
