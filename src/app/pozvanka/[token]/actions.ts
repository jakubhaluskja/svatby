"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/wedding";

const MESSAGES: Record<string, string> = {
  invite_not_found: "Pozvánka už neplatí – možná ji novomanželé poslali znovu. Požádejte je o nový odkaz.",
  invite_used: "Tuto pozvánku už přijal někdo jiný.",
  invite_expired: "Pozvánka vypršela. Požádejte novomanžele, ať vám ji pošlou znovu.",
  already_member: "Váš účet už patří k jiné svatbě. Přihlaste se jiným e-mailem, nebo si založte nový účet.",
};

export async function acceptInvite(token: string): Promise<{ error?: string }> {
  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.rpc("accept_invite", { p_token: token });
  if (error) {
    const key = Object.keys(MESSAGES).find((k) => error.message.includes(k));
    return { error: key ? MESSAGES[key] : "Pozvánku se nepodařilo přijmout." };
  }
  redirect("/app?vitejte=1");
}
