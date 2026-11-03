import Link from "next/link";
import { tr } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/server";
import { formatEventTime } from "@/lib/time";
import { requireWedding } from "@/lib/wedding";
import { deleteMessage, endMessage } from "./actions";
import { MessageForm } from "./message-form";

export const metadata = { title: "Zprávy hostům" };

export default async function MessagesPage() {
  const wedding = await requireWedding();
  const supabase = await createClient();
  const [{ data: messages }, { data: events }, { data: w }] = await Promise.all([
    supabase.from("broadcasts").select("id, body, audience, event_id, scheduled_at, banner_until").eq("wedding_id", wedding.id).eq("kind", "message").order("scheduled_at", { ascending: false }),
    supabase.from("events").select("id, name").eq("wedding_id", wedding.id).order("starts_at", { ascending: true, nullsFirst: false }),
    supabase.from("weddings").select("locales").eq("id", wedding.id).single(),
  ]);
  const eventName = new Map((events ?? []).map((e) => [e.id, tr(e.name)]));
  const now = new Date();
  const status = (m: { scheduled_at: string | null; banner_until: string | null }) =>
    m.banner_until && new Date(m.banner_until) <= now ? "Skončila" : m.scheduled_at && new Date(m.scheduled_at) > now ? "Naplánovaná" : "Zobrazuje se";

  return (
    <div className="flex max-w-3xl flex-col gap-10 px-6 py-8 sm:px-10 lg:py-10">
      <div className="flex flex-col gap-2">
        <Link href="/app/web" className="text-sm text-ink-soft hover:text-ink">Zpět na web</Link>
        <h1 className="font-serif text-4xl tracking-tight">Zprávy hostům</h1>
        <p className="text-ink-soft">
          Krátké zprávy, které se hostům v daný čas ukážou nahoře na webu. Třeba „Obřad začíná za 30 minut“ nebo „Autobus odjíždí od kostela v 17:00“.
          Můžete si je připravit dopředu.
        </p>
      </div>

      <MessageForm
        events={(events ?? []).map((e) => ({ id: e.id, name: tr(e.name) }))}
        english={(w?.locales ?? []).includes("en")}
        defaultUntil={wedding.wedding_date ? `${wedding.wedding_date}T23:59` : ""}
      />

      {messages && messages.length > 0 ? (
        <ul className="divide-y divide-line border-y border-line">
          {messages.map((m) => (
            <li key={m.id} className="flex flex-col gap-2 py-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex flex-col gap-1">
                <span>{tr(m.body)}</span>
                <span className="text-sm text-ink-soft">
                  {status(m)}
                  {m.scheduled_at ? `, od ${formatEventTime(m.scheduled_at)}` : ""}
                  {m.banner_until ? `, do ${formatEventTime(m.banner_until)}` : ""}
                  {m.audience === "event" && m.event_id ? `, pro pozvané na ${eventName.get(m.event_id) ?? "událost"}` : ", pro všechny"}
                </span>
              </div>
              <div className="flex shrink-0 gap-3 text-sm">
                {status(m) !== "Skončila" ? (
                  <form action={endMessage.bind(null, m.id)}>
                    <button type="submit" className="text-ink-soft hover:text-ink">Ukončit</button>
                  </form>
                ) : null}
                <form action={deleteMessage.bind(null, m.id)}>
                  <button type="submit" className="text-ink-soft hover:text-danger">Smazat</button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
