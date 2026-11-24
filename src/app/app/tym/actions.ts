"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { linkDomain } from "@/lib/domain";
import { appOrigin } from "@/lib/email/guest-mail";
import { emailEnabled, sendEmail } from "@/lib/email/send";
import { memberInvite } from "@/lib/email/templates";
import { createClient } from "@/lib/supabase/server";
import { summarize, TEAM_MODULES, type Permissions } from "@/lib/team";
import { requireUser, requireWedding } from "@/lib/wedding";

export type TeamResult = { ok?: boolean; error?: string; link?: string; emailed?: boolean };

const uuid = z.string().uuid();
const level = z.enum(["none", "read", "write", "own"]);
const permissions = z
  .object(Object.fromEntries(TEAM_MODULES.map((m) => [m.key, level.optional()])) as Record<string, z.ZodOptional<typeof level>>)
  .refine((p) => Object.entries(p).every(([k, v]) => v !== "own" || k === "budget"), "Neplatná oprávnění.");

const inviteSchema = z.object({
  email: z.string().trim().toLowerCase().email("Zadejte platný e-mail."),
  name: z.string().trim().max(80).transform((v) => v || null),
  role: z.enum(["partner", "coorganizer"]),
  permissions,
  contributor_id: z.union([z.literal(""), z.null(), uuid]).transform((v) => v || null),
});

async function couple() {
  const wedding = await requireWedding();
  if (wedding.role === "coorganizer") return { wedding, error: "Tým spravují jen novomanželé." };
  if (wedding.suspended_at) return { wedding, error: "Služba je pozastavená." };
  return { wedding, error: null };
}

function fail(e: { message?: string; code?: string } | null, text: string): TeamResult {
  if (e?.code === "23505" || e?.message?.includes("duplicate")) return { error: "Tento e-mail už v týmu je." };
  if (e?.message?.includes("row-level")) return { error: "Tým spravují jen novomanželé." };
  return { error: text };
}

const token = () => randomBytes(24).toString("base64url");

async function sendInvite(member: { invite_token: string; invited_email: string; display_name: string | null; role: string; permissions: Permissions }, wedding: { partner1_name: string; partner2_name: string }) {
  const link = `${appOrigin(await linkDomain())}/pozvanka/${member.invite_token}`;
  if (!emailEnabled()) return { link, emailed: false };
  const user = await requireUser();
  const supabase = await createClient();
  const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle();
  const inviter = profile?.full_name || user.email || "Novomanželé";
  const e = memberInvite({
    inviter,
    couple: `${wedding.partner1_name} a ${wedding.partner2_name}`,
    name: member.display_name?.split(" ")[0] ?? null,
    role: member.role === "partner" ? "partner" : "coorganizer",
    access: summarize(member.permissions),
    url: link,
  });
  const r = await sendEmail({ to: member.invited_email, ...e, replyTo: user.email });
  return { link, emailed: "id" in r };
}

export async function inviteMember(input: unknown): Promise<TeamResult> {
  const { wedding, error } = await couple();
  if (error) return { error };
  const parsed = inviteSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const v = parsed.data;
  if (v.role === "coorganizer" && v.permissions.budget === "own" && !v.contributor_id) return { error: "Vyberte přispěvatele, jehož část rozpočtu uvidí." };
  const user = await requireUser();
  if (user.email?.toLowerCase() === v.email) return { error: "Sami sebe pozvat nemůžete." };

  const supabase = await createClient();
  const row = {
    wedding_id: wedding.id,
    role: v.role,
    invited_email: v.email,
    display_name: v.name,
    permissions: v.role === "partner" ? {} : v.permissions,
    contributor_id: v.role === "partner" ? null : v.permissions.budget === "own" ? v.contributor_id : null,
    invite_token: token(),
  };
  const { data, error: e } = await supabase.from("wedding_members").insert(row).select("invite_token, invited_email, display_name, role, permissions").single();
  if (e || !data) return fail(e, "Pozvánku se nepodařilo vytvořit.");
  const sent = await sendInvite(data as Parameters<typeof sendInvite>[0], wedding);
  revalidatePath("/app/tym");
  return { ok: true, ...sent };
}

const updateSchema = z.object({
  name: z.string().trim().max(80).transform((v) => v || null),
  permissions,
  contributor_id: z.union([z.literal(""), z.null(), uuid]).transform((v) => v || null),
});

export async function updateMember(id: string, input: unknown): Promise<TeamResult> {
  const { wedding, error } = await couple();
  if (error) return { error };
  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const v = parsed.data;
  if (v.permissions.budget === "own" && !v.contributor_id) return { error: "Vyberte přispěvatele, jehož část rozpočtu uvidí." };
  const supabase = await createClient();
  const { error: e } = await supabase
    .from("wedding_members")
    .update({ display_name: v.name, permissions: v.permissions, contributor_id: v.permissions.budget === "own" ? v.contributor_id : null })
    .eq("id", uuid.parse(id))
    .eq("wedding_id", wedding.id)
    .eq("role", "coorganizer");
  if (e) return fail(e, "Změny se nepodařilo uložit.");
  revalidatePath("/app", "layout");
  return { ok: true };
}

export async function removeMember(id: string): Promise<TeamResult> {
  const { wedding, error } = await couple();
  if (error) return { error };
  const supabase = await createClient();
  const { data, error: e } = await supabase.from("wedding_members").delete().eq("id", uuid.parse(id)).eq("wedding_id", wedding.id).neq("role", "owner").select("id");
  if (e) return fail(e, "Člena se nepodařilo odebrat.");
  if (!data?.length) return { error: "Tohoto člena odebrat nemůžete." };
  revalidatePath("/app/tym");
  return { ok: true };
}

/** Nový odkaz (starý přestane platit) a znovu e-mail. */
export async function resendInvite(id: string): Promise<TeamResult> {
  const { wedding, error } = await couple();
  if (error) return { error };
  const supabase = await createClient();
  const { data, error: e } = await supabase
    .from("wedding_members")
    .update({ invite_token: token(), invited_at: new Date().toISOString() })
    .eq("id", uuid.parse(id))
    .eq("wedding_id", wedding.id)
    .is("accepted_at", null)
    .select("invite_token, invited_email, display_name, role, permissions")
    .single();
  if (e || !data?.invited_email) return fail(e, "Pozvánku se nepodařilo obnovit.");
  const sent = await sendInvite(data as Parameters<typeof sendInvite>[0], wedding);
  revalidatePath("/app/tym");
  return { ok: true, ...sent };
}
