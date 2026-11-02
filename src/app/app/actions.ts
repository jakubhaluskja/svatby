"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

/** Odškrtnutí úkolu z přehledu. Oprávnění hlídá RLS (modul checklist). */
export async function toggleTask(taskId: string, done: boolean) {
  const id = z.string().uuid().parse(taskId);
  const supabase = await createClient();
  const { error } = await supabase
    .from("tasks")
    .update({ done_at: done ? new Date().toISOString() : null })
    .eq("id", id);
  if (error) throw new Error("Úkol se nepodařilo uložit.");
  revalidatePath("/app");
  revalidatePath("/app/checklist");
}
