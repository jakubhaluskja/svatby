"use server";

import { z } from "zod";
import { aiEnabled, generateText } from "@/lib/ai";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireUser, requireWedding } from "@/lib/wedding";

export type AiKind = "invitation" | "reminder" | "message" | "thank_you" | "welcome" | "story";
export type AiResult = { text?: string; error?: string };

const TASK: Record<AiKind, string> = {
  invitation: "krátký úvodní text e-mailové pozvánky na svatbu (oslovení, datum, místo a tlačítko doplní systém sám – nepiš je)",
  reminder: "krátkou laskavou připomínku hostům, kteří ještě nepotvrdili účast (oslovení a odkaz doplní systém – nepiš je)",
  message: "zprávu hostům svatby podle zadání (oslovení a podpis doplní systém – nepiš je)",
  thank_you: "poděkování hostům po svatbě (oslovení, podpis a seznam darů doplní systém – nepiš je)",
  welcome: "úvodní uvítací text na svatební web (2–3 krátké odstavce)",
  story: "příběh páru na svatební web – jak se poznali a jak došlo k žádosti o ruku (3–4 krátké odstavce)",
};

const TONE: Record<string, string> = {
  warm: "vřelý a osobní",
  fun: "vtipný a lehký, ale ne trapný",
  formal: "slavnostní a formální",
  short: "co nejstručnější",
};

const input = z.object({
  kind: z.enum(["invitation", "reminder", "message", "thank_you", "welcome", "story"]),
  tone: z.enum(["warm", "fun", "formal", "short"]),
  notes: z.string().trim().max(1000),
  locale: z.enum(["cs", "en"]),
});

const DAILY_LIMIT = 40;

/** Napíše návrh textu; pár ho pak upraví. */
export async function aiWrite(raw: unknown): Promise<AiResult> {
  if (!aiEnabled()) return { error: "Pomoc s texty zatím není zapnutá." };
  const wedding = await requireWedding();
  const user = await requireUser();
  const parsed = input.safeParse(raw);
  if (!parsed.success) return { error: "Neplatný požadavek." };
  const v = parsed.data;

  const db = createAdminClient();
  const since = new Date(Date.now() - 86_400_000).toISOString();
  const { count } = await db.from("audit_log").select("id", { count: "exact", head: true }).eq("wedding_id", wedding.id).eq("action", "ai.write").gte("created_at", since);
  if ((count ?? 0) >= DAILY_LIMIT) return { error: "Dnešní limit návrhů je vyčerpaný, zkuste to zítra." };

  const { data: ev } = await db.from("events").select("location_name").eq("wedding_id", wedding.id).not("location_name", "is", null).order("starts_at", { nullsFirst: false }).limit(1).maybeSingle();
  const date = wedding.wedding_date
    ? new Intl.DateTimeFormat(v.locale === "cs" ? "cs-CZ" : "en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${wedding.wedding_date}T12:00:00Z`))
    : null;

  const system =
    v.locale === "cs"
      ? "Jsi zkušený copywriter, který pomáhá snoubencům s texty ke svatbě. Píšeš přirozenou, moderní češtinou, bez klišé, bez emoji a bez nadpisů. Píšeš jménem páru v 1. osobě množného čísla (my). Hosty oslovuješ vykáním v množném čísle. Vracíš jen samotný text, odstavce odděluješ prázdným řádkem. Nevymýšlíš si fakta, která nejsou v zadání (jména, místa, časy)."
      : "You are an experienced copywriter helping couples with wedding texts. Write natural, modern English, no clichés, no emoji, no headings. Write as the couple (we). Return only the text, paragraphs separated by a blank line. Do not invent facts not given (names, places, times).";
  const prompt = [
    `Napiš ${TASK[v.kind]}.`,
    `Pár: ${wedding.partner1_name} a ${wedding.partner2_name}.`,
    date ? `Datum svatby: ${date}.` : null,
    ev?.location_name ? `Místo: ${ev.location_name}.` : null,
    `Tón: ${TONE[v.tone]}.`,
    v.notes ? `Co chce pár zmínit: ${v.notes}` : null,
    v.locale === "en" ? "Write it in English." : "Piš česky.",
  ]
    .filter(Boolean)
    .join("\n");

  const text = await generateText(system, prompt, v.kind === "story" ? 900 : 600);
  await db.from("audit_log").insert({ actor_user_id: user.id, action: "ai.write", target_type: "wedding", target_id: wedding.id, wedding_id: wedding.id, payload: { kind: v.kind, ok: !!text } });
  return text ? { text } : { error: "Návrh se nepodařilo vytvořit. Zkuste to prosím znovu." };
}

export async function aiAvailable(): Promise<boolean> {
  return aiEnabled();
}
