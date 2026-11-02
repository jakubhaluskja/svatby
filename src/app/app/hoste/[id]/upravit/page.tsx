import { notFound } from "next/navigation";
import { loadGuestBook } from "@/lib/guest-data";
import { createClient } from "@/lib/supabase/server";
import { formatEventTime } from "@/lib/time";
import { requireWedding } from "@/lib/wedding";
import { HouseholdForm } from "../../household-form";

export const metadata = { title: "Úprava domácnosti" };

type Props = { params: Promise<{ id: string }> };

export default async function EditHouseholdPage({ params }: Props) {
  const { id } = await params;
  const wedding = await requireWedding();
  const supabase = await createClient();
  const book = await loadGuestBook(supabase, wedding.id, id);
  const h = book.households[0];
  if (!h) notFound();

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8 px-6 py-10 sm:px-10">
      <h1 className="font-display text-4xl font-semibold tracking-tight">{h.name}</h1>
      <HouseholdForm
        categories={book.categories}
        knownTags={book.tags}
        events={book.events.map((e) => ({ id: e.id, name: e.name, when: e.starts_at ? formatEventTime(e.starts_at) : null }))}
        initial={{
          id: h.id,
          name: h.name,
          locale: h.locale,
          email: h.email ?? "",
          plus_ones_allowed: h.plus_ones_allowed,
          notes: h.notes ?? "",
          event_ids: h.event_ids,
          guests: h.guests.map((g) => ({
            id: g.id,
            first_name: g.first_name,
            last_name: g.last_name ?? "",
            age_category_id: g.age_category_id,
            needs_high_chair: g.needs_high_chair,
            email: g.email ?? "",
            notes: g.notes ?? "",
            tags: g.tags,
          })),
        }}
      />
    </div>
  );
}
