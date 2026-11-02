import { loadGuestBook } from "@/lib/guest-data";
import { createClient } from "@/lib/supabase/server";
import { formatEventTime } from "@/lib/time";
import { requireWedding } from "@/lib/wedding";
import { HouseholdForm } from "../household-form";

export const metadata = { title: "Nová domácnost" };

export default async function NewHouseholdPage() {
  const wedding = await requireWedding();
  const supabase = await createClient();
  const book = await loadGuestBook(supabase, wedding.id, "00000000-0000-0000-0000-000000000000");

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8 px-6 py-10 sm:px-10">
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-4xl font-semibold tracking-tight">Nová domácnost</h1>
        <p className="text-ink-soft">Lidé, kteří dostanou jednu pozvánku a odpovědí společně. Třeba manželé s dětmi.</p>
      </div>
      <HouseholdForm
        categories={book.categories}
        knownTags={book.tags}
        events={book.events.map((e) => ({ id: e.id, name: e.name, when: e.starts_at ? formatEventTime(e.starts_at) : null }))}
        initial={{
          id: null,
          name: "",
          locale: wedding.default_locale,
          email: "",
          plus_ones_allowed: 0,
          notes: "",
          event_ids: book.events.map((e) => e.id),
          guests: [],
        }}
      />
    </div>
  );
}
