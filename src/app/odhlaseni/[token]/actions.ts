"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";

const valid = (t: string) => /^[A-Za-z0-9_-]{20,64}$/.test(t);

export async function unsubscribe(token: string) {
  if (!valid(token)) return;
  await createAdminClient().from("households").update({ unsubscribed_at: new Date().toISOString() }).eq("token", token).is("unsubscribed_at", null);
  revalidatePath(`/odhlaseni/${token}`);
}

export async function resubscribe(token: string) {
  if (!valid(token)) return;
  await createAdminClient().from("households").update({ unsubscribed_at: null }).eq("token", token);
  revalidatePath(`/odhlaseni/${token}`);
}
