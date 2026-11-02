"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { normalizeSections, parseSectionContent, SECTION_TYPES, type Section, type SectionType } from "@/lib/site-sections";
import { createClient } from "@/lib/supabase/server";
import { isTemplateId } from "@/lib/templates";
import { requireUser, requireWedding } from "@/lib/wedding";
import { zonedToUtcIso } from "@/lib/time";
import { toIban } from "@/lib/payment-qr";

async function loadDraft() {
  const wedding = await requireWedding();
  const supabase = await createClient();
  const { data } = await supabase.from("site_pages").select("sections, template").eq("wedding_id", wedding.id).eq("state", "draft").maybeSingle();
  return { wedding, supabase, sections: normalizeSections(data?.sections), template: data?.template ?? wedding.template };
}

async function saveDraft(sections: Section[], extra: Record<string, unknown> = {}) {
  const { wedding, supabase } = await loadDraft();
  const user = await requireUser();
  const { error } = await supabase.from("site_pages").upsert(
    { wedding_id: wedding.id, state: "draft", sections, updated_at: new Date().toISOString(), updated_by: user.id, ...extra },
    { onConflict: "wedding_id,state" },
  );
  if (error) throw new Error("Změny se nepodařilo uložit.");
  revalidatePath("/app/web");
}

const typeSchema = z.enum(SECTION_TYPES as [SectionType, ...SectionType[]]);

export async function toggleSection(type: string, enabled: boolean) {
  const t = typeSchema.parse(type);
  const { sections } = await loadDraft();
  await saveDraft(sections.map((s) => (s.type === t && t !== "hero" ? { ...s, enabled } : s)) as Section[]);
}

export async function moveSection(type: string, direction: -1 | 1) {
  const t = typeSchema.parse(type);
  const { sections } = await loadDraft();
  const i = sections.findIndex((s) => s.type === t);
  const j = i + direction;
  // Úvod zůstává vždy první.
  if (i <= 0 || j <= 0 || j >= sections.length) return;
  const next = [...sections];
  [next[i], next[j]] = [next[j], next[i]];
  await saveDraft(next);
}

export type SectionSaveResult = { ok?: boolean; error?: string };

export async function saveSection(type: string, content: unknown): Promise<SectionSaveResult> {
  const t = typeSchema.safeParse(type);
  if (!t.success) return { error: "Neznámá sekce." };
  let parsed;
  try {
    parsed = parseSectionContent(t.data, content);
  } catch {
    return { error: "Obsah sekce není platný. Zkontrolujte délku textů." };
  }
  const { sections } = await loadDraft();
  await saveDraft(sections.map((s) => (s.type === t.data ? { ...s, content: parsed } : s)) as Section[]);
  revalidatePath(`/app/web/${t.data}`);
  return { ok: true };
}

export type SettingsState = { ok?: boolean; error?: string };

export async function saveSettings(_: SettingsState, formData: FormData): Promise<SettingsState> {
  const wedding = await requireWedding();
  if (wedding.role === "coorganizer") return { error: "Nastavení webu mění jen novomanželé." };
  const supabase = await createClient();

  const template = String(formData.get("template") ?? "");
  if (!isTemplateId(template)) return { error: "Vyberte šablonu." };
  const english = formData.get("english") === "on";
  const deadline = String(formData.get("rsvp_deadline") ?? "").trim();
  if (deadline && !/^\d{4}-\d{2}-\d{2}$/.test(deadline)) return { error: "Uzávěrka není platné datum." };

  const locales = Array.from(new Set([wedding.default_locale, ...(english ? ["en"] : [])]));
  const { error } = await supabase
    .from("weddings")
    .update({
      locales,
      rsvp_deadline: deadline ? zonedToUtcIso(deadline, "23:59") : null,
    })
    .eq("id", wedding.id);
  if (error) return { error: "Nastavení se nepodařilo uložit." };

  const { sections } = await loadDraft();
  await saveDraft(sections, { template });
  return { ok: true };
}

export type PublishResult = { ok?: boolean; error?: string };

export async function publishChanges(): Promise<PublishResult> {
  const wedding = await requireWedding();
  const supabase = await createClient();
  const { error } = await supabase.rpc("publish_site", { p_wedding_id: wedding.id });
  if (error) {
    if (error.message.includes("not_paid")) return { error: "Web zveřejníte po zaplacení balíčku." };
    return { error: "Změny se nepodařilo zveřejnit." };
  }
  revalidatePath("/app/web");
  return { ok: true };
}

export type GiftAccountState = { ok?: boolean; error?: string };

export async function saveGiftAccount(_: GiftAccountState, formData: FormData): Promise<GiftAccountState> {
  const wedding = await requireWedding();
  const account = String(formData.get("account") ?? "").trim();
  const holder = String(formData.get("holder") ?? "").trim().slice(0, 80);
  const iban = account ? toIban(account) : null;
  if (account && !iban) return { error: "Číslo účtu není platné. Zadejte ho ve tvaru 123456789/0800 nebo jako IBAN." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("gift_settings")
    .upsert({ wedding_id: wedding.id, account_number: account || null, iban, account_holder: holder || null }, { onConflict: "wedding_id" });
  if (error) return { error: "Účet se nepodařilo uložit." };
  revalidatePath("/app/web/gifts");
  return { ok: true };
}

export type PasswordState = { ok?: string; error?: string };

const PROTECTABLE = ["location", "accommodation", "story", "gifts", "contacts", "faq", "dresscode"];

export async function savePassword(_: PasswordState, formData: FormData): Promise<PasswordState> {
  const wedding = await requireWedding();
  if (wedding.role === "coorganizer") return { error: "Heslo webu mění jen novomanželé." };
  const { hashSitePassword } = await import("@/lib/site-password");
  const scope = String(formData.get("scope") ?? "none");
  const password = String(formData.get("password") ?? "").trim();
  const sections = formData.getAll("sections").map(String).filter((s) => PROTECTABLE.includes(s));
  const supabase = await createClient();

  if (scope === "none") {
    await supabase.from("weddings").update({ password_scope: "none", password_hash: null, protected_sections: [] }).eq("id", wedding.id);
    revalidatePath("/app/web");
    return { ok: "Web je bez hesla." };
  }
  if (scope !== "site" && scope !== "sections") return { error: "Vyberte, co chránit." };
  if (scope === "sections" && sections.length === 0) return { error: "Vyberte aspoň jednu sekci." };

  const { data: current } = await supabase.from("weddings").select("password_hash").eq("id", wedding.id).single();
  if (!password && !current?.password_hash) return { error: "Zadejte heslo." };
  if (password && password.length < 4) return { error: "Heslo musí mít aspoň 4 znaky." };

  const { error } = await supabase
    .from("weddings")
    .update({
      password_scope: scope,
      protected_sections: scope === "sections" ? sections : [],
      ...(password ? { password_hash: hashSitePassword(password) } : {}),
    })
    .eq("id", wedding.id);
  if (error) return { error: "Heslo se nepodařilo uložit." };
  revalidatePath("/app/web");
  return { ok: password ? "Heslo je nastavené. Hosté s osobním odkazem ho zadávat nemusí." : "Nastavení je uložené." };
}
