import { createClient } from "@/lib/supabase/server";
import { moduleLevel, requireWedding } from "@/lib/wedding";
import { VenuesView, type Venue } from "./venues-view";

export const metadata = { title: "Výběr místa" };

export default async function VenuesPage() {
  const wedding = await requireWedding();
  const supabase = await createClient();
  const [{ data }, level, { count: guests }] = await Promise.all([
    supabase.from("venue_options").select("*").eq("wedding_id", wedding.id).order("sort").order("created_at"),
    moduleLevel(wedding.id, "checklist"),
    supabase.from("guests").select("id", { count: "exact", head: true }).eq("wedding_id", wedding.id),
  ]);
  return (
    <div className="flex max-w-6xl flex-col gap-8 px-6 py-8 sm:px-10 lg:py-10">
      <div className="flex max-w-3xl flex-col gap-2">
        <h1 className="font-serif text-4xl tracking-tight">Výběr místa</h1>
        <p className="text-ink-soft">
          Zapisujte si místa, která zvažujete – cenu, kapacitu, volné termíny, plusy a minusy. Porovnáte je vedle sebe a vybrané si označíte jako zarezervované.
        </p>
      </div>
      <VenuesView
        canEdit={level === "write"}
        guestCount={guests ?? 0}
        venues={(data ?? []).map((v) => ({ ...v, price: v.price === null ? null : Number(v.price) })) as Venue[]}
      />
    </div>
  );
}
