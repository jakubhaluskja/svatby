import { tr } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/server";
import { requireWedding } from "@/lib/wedding";
import { ImportForm } from "./import-form";

export const metadata = { title: "Vložit hosty z Excelu" };

export default async function ImportPage() {
  const wedding = await requireWedding();
  const supabase = await createClient();
  const { data: events } = await supabase
    .from("events")
    .select("id, name")
    .eq("wedding_id", wedding.id)
    .order("starts_at", { ascending: true, nullsFirst: false });

  return (
    <div className="flex max-w-3xl flex-col gap-8 px-6 py-8 sm:px-10 lg:py-10">
      <div className="flex flex-col gap-2">
        <h1 className="font-serif text-4xl tracking-tight">Vložit hosty z Excelu</h1>
        <p className="text-ink-soft">V Excelu nebo Tabulkách Google označte řádky s hosty, zkopírujte je a vložte sem.</p>
      </div>
      <ImportForm events={(events ?? []).map((e) => ({ id: e.id, name: tr(e.name) }))} />
    </div>
  );
}
