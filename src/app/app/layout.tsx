import { Sidebar } from "@/components/app-nav";
import { daysUntil, formatWeddingDate } from "@/components/site/site-hero";
import { createClient } from "@/lib/supabase/server";
import { utcToZonedParts } from "@/lib/time";
import { getCurrentWedding, requireUser } from "@/lib/wedding";
import { signOut } from "../(auth)/actions";

export const dynamic = "force-dynamic";

const ROLE = { owner: "Vlastník svatby", partner: "Partner/ka", coorganizer: "Spoluorganizátor" } as const;

function daysWord(n: number) {
  return n === 1 ? "den" : n >= 2 && n <= 4 ? "dny" : "dní";
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const [user, wedding] = await Promise.all([requireUser(), getCurrentWedding()]);
  if (!wedding) return <div className="min-h-svh">{children}</div>;

  const supabase = await createClient();
  const today = utcToZonedParts(new Date().toISOString()).date;
  const inWeek = new Date(Date.parse(`${today}T00:00:00Z`) + 7 * 86_400_000).toISOString().slice(0, 10);
  const [{ data: profile }, { count: tasks }, { count: guests }] = await Promise.all([
    supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle(),
    supabase
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .eq("wedding_id", wedding.id)
      .is("parent_id", null)
      .is("done_at", null)
      .lte("due_date", inWeek),
    supabase.from("guests").select("id", { count: "exact", head: true }).eq("wedding_id", wedding.id),
  ]);

  const days = wedding.wedding_date ? daysUntil(wedding.wedding_date) : null;
  const dateLine = wedding.wedding_date
    ? `${formatWeddingDate(wedding.wedding_date)}${days !== null && days > 0 ? ` · za ${days} ${daysWord(days)}` : days === 0 ? " · dnes" : ""}`
    : null;

  return (
    <div className="flex min-h-svh flex-col lg:flex-row">
      <Sidebar
        couple={`${wedding.partner1_name} & ${wedding.partner2_name}`}
        dateLine={dateLine}
        userName={profile?.full_name || user.email || "Účet"}
        userRole={ROLE[wedding.role]}
        badges={{ tasks: tasks ?? 0, guests: guests ?? 0 }}
        signOut={signOut}
      />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
