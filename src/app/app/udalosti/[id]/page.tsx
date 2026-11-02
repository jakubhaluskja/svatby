import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { utcToZonedParts } from "@/lib/time";
import { requireWedding } from "@/lib/wedding";
import { deleteEvent } from "../actions";
import { EventForm } from "../event-form";

export const metadata = { title: "Úprava události" };

type Props = { params: Promise<{ id: string }> };

export default async function EditEventPage({ params }: Props) {
  const { id } = await params;
  const wedding = await requireWedding();
  const supabase = await createClient();
  const { data: e } = await supabase
    .from("events")
    .select("id, name, description, starts_at, ends_at, location_name, address, visibility, is_seated")
    .eq("id", id)
    .eq("wedding_id", wedding.id)
    .maybeSingle();
  if (!e) notFound();

  const start = e.starts_at ? utcToZonedParts(e.starts_at) : null;
  const end = e.ends_at ? utcToZonedParts(e.ends_at) : null;
  const name = (e.name ?? {}) as Record<string, string>;
  const description = (e.description ?? {}) as Record<string, string>;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8 px-6 py-10 sm:px-10">
      <h1 className="font-display text-4xl font-semibold tracking-tight">{name.cs || "Událost"}</h1>
      <EventForm
        eventId={e.id}
        showEnglish
        defaults={{
          name_cs: name.cs,
          name_en: name.en,
          date: start?.date,
          start: start && start.time !== "00:00" ? start.time : undefined,
          end: end?.time,
          location_name: e.location_name ?? undefined,
          address: e.address ?? undefined,
          description_cs: description.cs,
          description_en: description.en,
          visibility: e.visibility as "public" | "invited",
          is_seated: e.is_seated,
        }}
      />
      <details className="border-t border-line pt-6">
        <summary className="cursor-pointer text-sm text-ink-soft hover:text-ink">Smazat událost</summary>
        <form action={deleteEvent.bind(null, e.id)} className="mt-4 flex flex-col items-start gap-3">
          <p className="text-sm text-ink-soft">Smažou se i odpovědi hostů a zasedací pořádek této události. Nejde to vrátit.</p>
          <button type="submit" className="rounded-full border border-danger px-5 py-2 text-sm font-medium text-danger hover:bg-danger hover:text-white">
            Smazat natrvalo
          </button>
        </form>
      </details>
    </div>
  );
}
