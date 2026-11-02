import { loadLodging } from "@/lib/lodging-data";
import { createClient } from "@/lib/supabase/server";
import { moduleLevel, requireWedding } from "@/lib/wedding";
import { LodgingBoard } from "./lodging-board";

export const metadata = { title: "Ubytování" };

export default async function LodgingPage() {
  const wedding = await requireWedding();
  const supabase = await createClient();
  const [data, level] = await Promise.all([loadLodging(supabase, wedding.id), moduleLevel(wedding.id, "lodging")]);

  return (
    <div className="mx-auto flex max-w-[90rem] flex-col gap-6 px-6 py-10 sm:px-10">
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-4xl font-semibold tracking-tight">Ubytování</h1>
        <p className="max-w-2xl text-ink-soft">
          Zadejte, kde hosté přespí, a rozdělte je do pokojů. Hosté pak na své stránce uvidí svůj pokoj, cenu a informace k příjezdu.
        </p>
      </div>
      <LodgingBoard data={data} canEdit={level === "write"} />
    </div>
  );
}
