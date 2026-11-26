"use server";

import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/wedding";

/** Průvodce dokončen nebo přeskočen – příště se sám nespustí. */
export async function markTourDone() {
  const user = await requireUser();
  const supabase = await createClient();
  await supabase.from("profiles").update({ tour_done_at: new Date().toISOString() }).eq("id", user.id).is("tour_done_at", null);
}
