"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requestOrigin, safeNext } from "@/lib/origin";

export type AuthState = { error?: string; info?: string; fields?: Record<string, string> };

const credentials = z.object({
  email: z.string().trim().toLowerCase().email("Zadejte platný e-mail."),
  password: z.string().min(8, "Heslo musí mít aspoň 8 znaků."),
});

/** Převod chyb Supabase Auth na srozumitelnou češtinu. */
function authMessage(code: string | undefined, fallback: string): string {
  switch (code) {
    case "invalid_credentials":
      return "E-mail nebo heslo nesedí. Zkontrolujte je a zkuste to znovu.";
    case "email_not_confirmed":
      return "E-mail ještě není potvrzený. Otevřete odkaz, který jsme vám poslali.";
    case "user_already_exists":
    case "email_exists":
      return "Účet s tímto e-mailem už existuje. Přihlaste se.";
    case "weak_password":
      return "Heslo je příliš slabé. Použijte aspoň 8 znaků včetně čísla.";
    case "over_email_send_rate_limit":
    case "over_request_rate_limit":
      return "Příliš mnoho pokusů. Zkuste to za pár minut.";
    default:
      return fallback;
  }
}

export async function signUp(_: AuthState, formData: FormData): Promise<AuthState> {
  const fullName = String(formData.get("full_name") ?? "").trim();
  const parsed = credentials.safeParse({ email: formData.get("email"), password: formData.get("password") });
  const fields = { email: String(formData.get("email") ?? ""), full_name: fullName };
  if (!parsed.success) return { error: parsed.error.issues[0].message, fields };
  if (formData.get("terms") !== "on") {
    return { error: "Pro registraci je potřeba souhlasit s obchodními podmínkami.", fields };
  }

  const supabase = await createClient();
  const origin = await requestOrigin();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { full_name: fullName || null },
      emailRedirectTo: `${origin}/auth/callback?next=/app/zalozit`,
    },
  });
  if (error) return { error: authMessage(error.code, "Registrace se nepovedla. Zkuste to znovu."), fields };

  // Je-li potvrzení e-mailu vypnuté, uživatel je rovnou přihlášený.
  if (data.session) redirect("/app/zalozit");

  return {
    info: `Poslali jsme vám e-mail na ${parsed.data.email}. Kliknutím na odkaz v něm registraci dokončíte.`,
  };
}

export async function signIn(_: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = credentials.safeParse({ email: formData.get("email"), password: formData.get("password") });
  const fields = { email: String(formData.get("email") ?? "") };
  if (!parsed.success) return { error: parsed.error.issues[0].message, fields };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { error: authMessage(error.code, "Přihlášení se nepovedlo. Zkuste to znovu."), fields };

  redirect(safeNext(formData.get("next")));
}

export async function requestPasswordReset(_: AuthState, formData: FormData): Promise<AuthState> {
  const email = z.string().trim().toLowerCase().email().safeParse(formData.get("email"));
  if (!email.success) return { error: "Zadejte platný e-mail." };

  const supabase = await createClient();
  const origin = await requestOrigin();
  await supabase.auth.resetPasswordForEmail(email.data, {
    redirectTo: `${origin}/auth/callback?next=/nove-heslo`,
  });
  // Neprozrazujeme, zda účet existuje.
  return { info: "Pokud k e-mailu existuje účet, poslali jsme na něj odkaz pro nastavení nového hesla." };
}

export async function updatePassword(_: AuthState, formData: FormData): Promise<AuthState> {
  const password = z.string().min(8).safeParse(formData.get("password"));
  if (!password.success) return { error: "Heslo musí mít aspoň 8 znaků." };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: password.data });
  if (error) return { error: authMessage(error.code, "Heslo se nepodařilo změnit. Otevřete odkaz z e-mailu znovu.") };
  redirect("/app");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/prihlaseni");
}
