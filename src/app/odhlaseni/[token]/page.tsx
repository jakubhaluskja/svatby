import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { resubscribe, unsubscribe } from "./actions";

export const metadata = { title: "Odhlášení e-mailů", robots: { index: false } };
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ token: string }>; searchParams: Promise<{ hotovo?: string }> };

/** Odhlášení hosta z e-mailů ke svatbě (odkaz v patičce e-mailu). */
export default async function Unsubscribe({ params }: Props) {
  const { token } = await params;
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) notFound();
  const db = createAdminClient();
  const { data: h } = await db
    .from("households")
    .select("locale, unsubscribed_at, weddings!inner(partner1_name, partner2_name)")
    .eq("token", token)
    .maybeSingle();
  if (!h) notFound();
  const w = h.weddings as unknown as { partner1_name: string; partner2_name: string };
  const en = h.locale === "en";
  const couple = en ? `${w.partner1_name} & ${w.partner2_name}` : `${w.partner1_name} a ${w.partner2_name}`;

  return (
    <main className="grid min-h-svh place-items-center bg-paper px-6">
      <div className="w-full max-w-md rounded-3xl bg-surface p-8 text-center shadow-card ring-1 ring-line/70">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-eucalyptus">{couple}</p>
        {h.unsubscribed_at ? (
          <>
            <h1 className="mt-3 font-serif text-3xl">{en ? "You're unsubscribed" : "Odhlášeno"}</h1>
            <p className="mt-3 text-ink-soft">
              {en ? "You won't receive any more e-mails about this wedding." : "Další e-maily k této svatbě už vám nepřijdou."}
            </p>
            <form action={resubscribe.bind(null, token)} className="mt-6">
              <button type="submit" className="text-sm text-ink-soft underline underline-offset-2 hover:text-ink">
                {en ? "Changed your mind? Subscribe again" : "Rozmysleli jste si to? Přihlásit zpět"}
              </button>
            </form>
          </>
        ) : (
          <>
            <h1 className="mt-3 font-serif text-3xl">{en ? "Unsubscribe from wedding e-mails?" : "Nechcete další e-maily ke svatbě?"}</h1>
            <p className="mt-3 text-ink-soft">
              {en
                ? "You will stop receiving invitations, reminders and messages from the couple. Your personal link keeps working."
                : "Přestanou vám chodit pozvánky, připomínky a zprávy od novomanželů. Váš osobní odkaz na web bude fungovat dál."}
            </p>
            <form action={unsubscribe.bind(null, token)} className="mt-6">
              <button type="submit" className="h-11 rounded-full bg-ink px-6 text-[15px] font-medium text-white hover:bg-ink/85">
                {en ? "Unsubscribe" : "Odhlásit e-maily"}
              </button>
            </form>
          </>
        )}
      </div>
    </main>
  );
}
