import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeNext } from "@/lib/origin";

/** Návrat z odkazu v e-mailu (potvrzení registrace, obnova hesla). */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = safeNext(url.searchParams.get("next"));

  if (code) {
    try {
      const supabase = await createClient();
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error) return NextResponse.redirect(new URL(next, url.origin));
    } catch {
      // chybí ověřovací cookie (odkaz otevřený v jiném prohlížeči) – pokračujeme na přihlášení
    }
  }
  return NextResponse.redirect(new URL("/prihlaseni?chyba=odkaz", url.origin));
}
