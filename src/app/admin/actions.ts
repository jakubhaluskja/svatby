"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { IMPERSONATION_COOKIE, requireAdmin } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type AdminState = { ok?: boolean; error?: string };

const uuid = z.string().uuid();

function message(e: { message?: string; code?: string } | null, fallback: string): string {
  if (!e) return fallback;
  if (e.message?.includes("forbidden")) return "Na tuto akci nemáte oprávnění (jen hlavní správce).";
  if (e.code === "23505" || e.message?.includes("duplicate")) return "Tato adresa webu je už obsazená.";
  if (e.message?.includes("weddings_slug_check")) return "Adresa webu smí obsahovat jen malá písmena, číslice a pomlčky.";
  return fallback;
}

const weddingSchema = z.object({
  partner1_name: z.string().trim().min(1, "Vyplňte obě jména.").max(60),
  partner2_name: z.string().trim().min(1, "Vyplňte obě jména.").max(60),
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9](?:[a-z0-9-]{1,46}[a-z0-9])$/, "Adresa webu smí obsahovat jen malá písmena, číslice a pomlčky (3–48 znaků)."),
  wedding_date: z.union([z.literal(""), z.string().regex(/^\d{4}-\d{2}-\d{2}$/)]).transform((v) => v || null),
  default_locale: z.enum(["cs", "en"]),
  package: z.enum(["none", "web", "web_gallery"]),
  status: z.enum(["draft", "published", "expired"]),
  web_expires_at: z.union([z.literal(""), z.string().regex(/^\d{4}-\d{2}-\d{2}$/)]).transform((v) => (v ? `${v}T23:59:59+01:00` : null)),
  admin_note: z.string().trim().max(2000),
});

export async function updateWedding(id: string, _: AdminState, formData: FormData): Promise<AdminState> {
  const admin = await requireAdmin();
  const parsed = weddingSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  // Platební údaje mění jen hlavní správce; podpora upravuje jména, adresu a poznámku.
  const { package: pkg, status, web_expires_at, ...basic } = parsed.data;
  const data = admin.role === "superadmin" ? { ...basic, package: pkg, status, web_expires_at } : basic;
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_update_wedding", { p_wedding_id: uuid.parse(id), p_data: data });
  if (error) return { error: message(error, "Údaje se nepodařilo uložit.") };
  revalidatePath("/admin", "layout");
  return { ok: true };
}

const suspendSchema = z.object({
  reason: z.enum(["nonpayment", "violation", "other"], { message: "Vyberte důvod pozastavení." }),
  note: z.string().trim().max(500),
});

export async function suspendWedding(id: string, _: AdminState, formData: FormData): Promise<AdminState> {
  await requireAdmin();
  const parsed = suspendSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_suspension", { p_wedding_id: uuid.parse(id), p_reason: parsed.data.reason, p_note: parsed.data.note });
  if (error) return { error: message(error, "Službu se nepodařilo pozastavit.") };
  revalidatePath("/admin", "layout");
  return { ok: true };
}

export async function resumeWedding(id: string): Promise<AdminState> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_suspension", { p_wedding_id: uuid.parse(id), p_reason: null });
  if (error) return { error: message(error, "Službu se nepodařilo obnovit.") };
  revalidatePath("/admin", "layout");
  return { ok: true };
}

async function ownerOf(weddingId: string) {
  const db = createAdminClient();
  const { data: member } = await db
    .from("wedding_members")
    .select("user_id")
    .eq("wedding_id", weddingId)
    .eq("role", "owner")
    .not("accepted_at", "is", null)
    .order("invited_at")
    .limit(1)
    .maybeSingle();
  if (!member?.user_id) return null;
  const { data } = await db.auth.admin.getUserById(member.user_id);
  return data.user ? { id: data.user.id, email: data.user.email ?? null } : null;
}

const emailSchema = z.object({ email: z.string().trim().toLowerCase().email("Zadejte platný e-mail.") });

/** Změna přihlašovacího e-mailu vlastníka (bez potvrzovacího e-mailu). */
export async function changeOwnerEmail(id: string, _: AdminState, formData: FormData): Promise<AdminState> {
  await requireAdmin();
  const weddingId = uuid.parse(id);
  const parsed = emailSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const owner = await ownerOf(weddingId);
  if (!owner) return { error: "Svatba nemá vlastníka." };
  if (owner.email === parsed.data.email) return { ok: true };
  const { error } = await createAdminClient().auth.admin.updateUserById(owner.id, { email: parsed.data.email, email_confirm: true });
  if (error) return { error: error.message.includes("already") ? "Tento e-mail už používá jiný účet." : "E-mail se nepodařilo změnit." };
  const supabase = await createClient();
  await supabase.rpc("admin_log", { p_action: "admin.change_owner_email", p_wedding_id: weddingId, p_payload: { from: owner.email, to: parsed.data.email } });
  revalidatePath("/admin", "layout");
  return { ok: true };
}

/**
 * Přihlášení za klienta: jednorázový odkaz pro vlastníka svatby se ověří rovnou tady,
 * přihlášení správce se uloží do httpOnly cookie, aby se k němu dalo vrátit.
 */
export async function impersonate(id: string): Promise<AdminState> {
  const admin = await requireAdmin();
  const weddingId = uuid.parse(id);
  const owner = await ownerOf(weddingId);
  if (!owner?.email) return { error: "Svatba nemá vlastníka s e-mailem." };
  if (owner.id === admin.id) return { error: "Tohle je váš vlastní účet." };

  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return { error: "Vaše přihlášení vypršelo. Přihlaste se znovu." };

  const { data: link, error } = await createAdminClient().auth.admin.generateLink({ type: "magiclink", email: owner.email });
  if (error || !link.properties?.hashed_token) return { error: "Přihlašovací odkaz se nepodařilo vytvořit." };

  await supabase.rpc("admin_log", { p_action: "admin.impersonate", p_wedding_id: weddingId, p_payload: { owner: owner.email } });

  const store = await cookies();
  store.set(IMPERSONATION_COOKIE, JSON.stringify({ rt: session.refresh_token, email: admin.email }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 8,
  });

  const { error: verifyError } = await supabase.auth.verifyOtp({ type: "magiclink", token_hash: link.properties.hashed_token });
  if (verifyError) {
    store.delete(IMPERSONATION_COOKIE);
    return { error: "Přihlášení za klienta se nepodařilo." };
  }
  redirect("/app");
}

/** Konec přihlášení za klienta: odhlásí klienta a obnoví přihlášení správce. */
export async function endImpersonation() {
  const store = await cookies();
  const raw = store.get(IMPERSONATION_COOKIE)?.value;
  store.delete(IMPERSONATION_COOKIE);
  const supabase = await createClient();
  await supabase.auth.signOut({ scope: "local" });
  let back = false;
  if (raw) {
    try {
      const { rt } = JSON.parse(raw) as { rt?: string };
      if (rt) back = !(await supabase.auth.refreshSession({ refresh_token: rt })).error;
    } catch {
      back = false;
    }
  }
  redirect(back ? "/admin" : "/prihlaseni?next=/admin");
}
