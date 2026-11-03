"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireWedding } from "@/lib/wedding";

const uuid = z.string().uuid();

export type TaskFormState = { ok?: boolean; error?: string };

const schema = z.object({
  title: z.string().trim().min(1, "Napište, co je potřeba udělat.").max(200),
  description: z.string().trim().max(2000),
  due_date: z.union([z.literal(""), z.string().regex(/^\d{4}-\d{2}-\d{2}$/)]),
  assignee: z.string(),
  assignee_name: z.string().trim().max(80),
  assignee_email: z.union([z.literal(""), z.string().trim().email("E-mail odpovědné osoby není platný.")]),
  category: z.union([z.literal(""), z.enum(["planning", "guests", "vendors", "attire", "ceremony", "web", "day"])]),
});

export async function saveTask(taskId: string | null, parentId: string | null, _: TaskFormState, formData: FormData): Promise<TaskFormState> {
  const wedding = await requireWedding();
  const parsed = schema.safeParse(Object.fromEntries(["title", "description", "due_date", "assignee", "assignee_name", "assignee_email", "category"].map((k) => [k, String(formData.get(k) ?? "")])));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const v = parsed.data;
  const member = v.assignee.startsWith("member:") ? uuid.safeParse(v.assignee.slice(7)) : null;

  const row = {
    title: v.title,
    description: v.description || null,
    due_date: v.due_date || null,
    // Ručně zadaný termín se už neposouvá se změnou data svatby.
    offset_days: null,
    assignee_member_id: member?.success ? member.data : null,
    assignee_name: v.assignee === "external" ? v.assignee_name || null : null,
    assignee_email: v.assignee === "external" ? v.assignee_email || null : null,
    category: v.category || null,
  };

  const supabase = await createClient();
  if (taskId) {
    const { data: current } = await supabase.from("tasks").select("due_date, offset_days").eq("id", taskId).single();
    // Termín z šablony se nadále posouvá s datem svatby, pokud ho pár nezměnil.
    const keepOffset = current && current.due_date === row.due_date ? { offset_days: current.offset_days } : {};
    const { error } = await supabase.from("tasks").update({ ...row, ...keepOffset }).eq("id", taskId).eq("wedding_id", wedding.id);
    if (error) return { error: "Úkol se nepodařilo uložit." };
  } else {
    const { error } = await supabase.from("tasks").insert({ ...row, wedding_id: wedding.id, parent_id: parentId, source: "custom", sort: 1000 });
    if (error) return { error: "Úkol se nepodařilo uložit." };
  }
  revalidatePath("/app/checklist");
  revalidatePath("/app");
  return { ok: true };
}

export async function deleteTask(taskId: string) {
  const wedding = await requireWedding();
  const supabase = await createClient();
  await supabase.from("tasks").delete().eq("id", uuid.parse(taskId)).eq("wedding_id", wedding.id);
  revalidatePath("/app/checklist");
  revalidatePath("/app");
}
