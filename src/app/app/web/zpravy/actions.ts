"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { zonedToUtcIso } from "@/lib/time";
import { requireUser, requireWedding } from "@/lib/wedding";

export type MessageState = { ok?: boolean; error?: string };

const schema = z.object({
  body_cs: z.string().trim().min(1, "Napište text zprávy.").max(500),
  body_en: z.string().trim().max(500),
  audience: z.string(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/).or(z.literal("")),
  until: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/).or(z.literal("")),
});

const toUtc = (local: string) => (local ? zonedToUtcIso(local.slice(0, 10), local.slice(11, 16)) : null);

export async function createMessage(_: MessageState, formData: FormData): Promise<MessageState> {
  const wedding = await requireWedding();
  const user = await requireUser();
  const parsed = schema.safeParse(Object.fromEntries(["body_cs", "body_en", "audience", "from", "until"].map((k) => [k, String(formData.get(k) ?? "")])));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const v = parsed.data;
  const eventId = v.audience.startsWith("event:") ? v.audience.slice(6) : null;
  const from = toUtc(v.from);
  const until = toUtc(v.until);
  if (from && until && until <= from) return { error: "Konec zobrazení musí být po začátku." };

  const supabase = await createClient();
  const { error } = await supabase.from("broadcasts").insert({
    wedding_id: wedding.id,
    kind: "message",
    audience: eventId ? "event" : "all",
    event_id: eventId,
    body: { cs: v.body_cs, ...(v.body_en ? { en: v.body_en } : {}) },
    show_banner: true,
    send_email: false,
    scheduled_at: from ?? new Date().toISOString(),
    banner_until: until,
    created_by: user.id,
  });
  if (error) return { error: "Zprávu se nepodařilo uložit." };
  revalidatePath("/app/web/zpravy");
  return { ok: true };
}

export async function endMessage(id: string) {
  const wedding = await requireWedding();
  const supabase = await createClient();
  await supabase.from("broadcasts").update({ banner_until: new Date().toISOString() }).eq("id", id).eq("wedding_id", wedding.id);
  revalidatePath("/app/web/zpravy");
}

export async function deleteMessage(id: string) {
  const wedding = await requireWedding();
  const supabase = await createClient();
  await supabase.from("broadcasts").delete().eq("id", id).eq("wedding_id", wedding.id);
  revalidatePath("/app/web/zpravy");
}
