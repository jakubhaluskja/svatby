"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireWedding } from "@/lib/wedding";

export type Result = { ok?: boolean; error?: string };
const uuid = z.string().uuid();
const lt = z.object({ cs: z.string().trim().max(200).default(""), en: z.string().trim().max(200).default("") });

const schema = z
  .object({
    label: lt,
    help: lt,
    kind: z.enum(["text", "choice", "yesno"]),
    options: z.array(z.object({ id: z.string().regex(/^[a-z0-9]{1,12}$/), cs: z.string().trim().max(80).default(""), en: z.string().trim().max(80).default("") })).max(12),
    scope: z.enum(["household", "guest"]),
    required: z.boolean(),
    only_coming: z.boolean(),
    event_id: z.union([z.literal(""), z.null(), uuid]).transform((v) => v || null),
  })
  .refine((q) => q.label.cs || q.label.en, { message: "Napište otázku." })
  .transform((q) => ({ ...q, options: q.kind === "choice" ? q.options.filter((o) => o.cs || o.en) : [] }))
  .refine((q) => q.kind !== "choice" || q.options.length >= 2, { message: "Výběr potřebuje aspoň dvě možnosti." });

function fail(e: { message?: string } | null, text: string): Result {
  if (e?.message?.includes("row-level")) return { error: "K hostům nemáte oprávnění." };
  return { error: text };
}
function done(): Result {
  revalidatePath("/app/hoste/otazky");
  return { ok: true };
}

export async function saveQuestion(id: string | null, input: unknown): Promise<Result> {
  const wedding = await requireWedding();
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const supabase = await createClient();
  const { error } = id
    ? await supabase.from("rsvp_questions").update(parsed.data).eq("id", uuid.parse(id)).eq("wedding_id", wedding.id)
    : await supabase.from("rsvp_questions").insert({ ...parsed.data, wedding_id: wedding.id, sort: Date.now() % 1_000_000_000 });
  return error ? fail(error, "Otázku se nepodařilo uložit.") : done();
}

export async function deleteQuestion(id: string): Promise<Result> {
  const wedding = await requireWedding();
  const supabase = await createClient();
  const { error } = await supabase.from("rsvp_questions").delete().eq("id", uuid.parse(id)).eq("wedding_id", wedding.id);
  return error ? fail(error, "Otázku se nepodařilo smazat.") : done();
}

export async function reorderQuestions(ids: string[]): Promise<Result> {
  const wedding = await requireWedding();
  const list = z.array(uuid).max(100).parse(ids);
  const supabase = await createClient();
  const res = await Promise.all(list.map((id, i) => supabase.from("rsvp_questions").update({ sort: i }).eq("id", id).eq("wedding_id", wedding.id)));
  const e = res.find((r) => r.error)?.error ?? null;
  return e ? fail(e, "Pořadí se nepodařilo uložit.") : done();
}
