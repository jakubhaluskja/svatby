import Link from "next/link";
import { tr } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/server";
import { formatEventTime, formatTime } from "@/lib/time";
import { requireWedding } from "@/lib/wedding";

export const metadata = { title: "Události" };

export default async function EventsPage() {
  const wedding = await requireWedding();
  const supabase = await createClient();
  const [{ data: events }, { data: invites }] = await Promise.all([
    supabase
      .from("events")
      .select("id, name, starts_at, ends_at, location_name, visibility, is_seated")
      .eq("wedding_id", wedding.id)
      .order("starts_at", { ascending: true, nullsFirst: false })
      .order("sort"),
    supabase.from("household_events").select("event_id").eq("wedding_id", wedding.id),
  ]);

  const invitedCount = new Map<string, number>();
  for (const i of invites ?? []) invitedCount.set(i.event_id, (invitedCount.get(i.event_id) ?? 0) + 1);

  return (
    <div className="flex max-w-4xl flex-col gap-8 px-6 py-8 sm:px-10 lg:py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="font-serif text-4xl tracking-tight">Události</h1>
          <p className="max-w-xl text-ink-soft">
            Části svatebního dne, na které zvete hosty. Z nich se skládá harmonogram na webu a hosté u nich potvrzují účast.
          </p>
        </div>
        <Link href="/app/udalosti/nova" className="inline-flex h-11 items-center rounded-full bg-eucalyptus px-6 font-medium text-white hover:bg-eucalyptus-deep">
          Přidat událost
        </Link>
      </div>

      {events && events.length > 0 ? (
        <ul className="divide-y divide-line border-y border-line">
          {events.map((e) => (
            <li key={e.id}>
              <Link href={`/app/udalosti/${e.id}`} className="flex flex-col gap-1 py-4 hover:bg-surface sm:flex-row sm:items-center sm:gap-6 sm:px-2">
                <span className="w-56 shrink-0 text-sm tabular-nums text-ink-soft">
                  {e.starts_at
                    ? `${formatEventTime(e.starts_at)}${e.ends_at ? `–${formatTime(e.ends_at)}` : ""}`
                    : "Čas zatím není"}
                </span>
                <span className="flex-1">
                  <span className="font-medium">{tr(e.name)}</span>
                  {e.location_name ? <span className="text-ink-soft">, {e.location_name}</span> : null}
                </span>
                <span className="text-sm text-ink-soft">
                  {e.visibility === "invited" ? "Jen pozvaní" : "Veřejná"}
                  {e.is_seated ? ", u stolů" : ""}
                  {`, pozváno ${invitedCount.get(e.id) ?? 0} domácností`}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-ink-soft">Zatím tu nejsou žádné události. Přidejte třeba obřad, hostinu a večerní zábavu.</p>
      )}
    </div>
  );
}
