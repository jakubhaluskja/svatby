import Link from "next/link";
import { notFound } from "next/navigation";
import { Wordmark } from "@/components/ui";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { summarize, type Permissions } from "@/lib/team";
import { AcceptForm } from "./accept-form";

export const metadata = { title: "Pozvánka do týmu svatby", robots: { index: false } };
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ token: string }> };

/** Přijetí pozvánky do týmu svatby (partner, spoluorganizátor). */
export default async function InvitePage({ params }: Props) {
  const { token } = await params;
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) notFound();

  const { data: m } = await createAdminClient()
    .from("wedding_members")
    .select("role, permissions, display_name, invited_email, invited_at, accepted_at, weddings!inner(partner1_name, partner2_name, status)")
    .eq("invite_token", token)
    .maybeSingle();
  const w = m?.weddings as unknown as { partner1_name: string; partner2_name: string; status: string } | undefined;

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const email = (claims?.claims?.email as string | undefined) ?? null;
  const next = `/pozvanka/${token}`;

  const valid = m && w && w.status !== "deleted" && !m.accepted_at && Date.parse(m.invited_at) > Date.now() - 30 * 86_400_000;

  return (
    <main className="grid min-h-svh place-items-center bg-paper px-5 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex justify-center">
          <Wordmark />
        </div>
        <div className="rounded-3xl bg-surface p-7 shadow-card ring-1 ring-line/70 sm:p-8">
          {!valid ? (
            <>
              <h1 className="font-serif text-3xl">Pozvánka neplatí</h1>
              <p className="mt-3 text-ink-soft">
                Odkaz už byl použitý, vypršel, nebo ho novomanželé poslali znovu. Požádejte je o nový. Pokud jste pozvánku už přijali, stačí se přihlásit.
              </p>
              <Link href="/prihlaseni" className="mt-6 inline-flex h-11 items-center rounded-full bg-ink px-6 font-medium text-white">
                Přihlásit se
              </Link>
            </>
          ) : (
            <>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-eucalyptus">Pozvánka do týmu</p>
              <h1 className="mt-2 font-serif text-3xl leading-tight">
                {w.partner1_name} & {w.partner2_name}
              </h1>
              <p className="mt-3 text-ink-soft">
                {m.role === "partner"
                  ? "Zvou vás, abyste spolu plánovali svatbu. Budete mít přístup ke všemu."
                  : `Zvou vás k přípravám svatby. Budete mít přístup k: ${summarize((m.permissions ?? {}) as Permissions)}.`}
              </p>

              {email ? (
                <div className="mt-6 flex flex-col gap-3">
                  <p className="text-sm text-ink-soft">
                    Přihlášeni jako <strong className="text-ink">{email}</strong>
                    {m.invited_email && m.invited_email.toLowerCase() !== email.toLowerCase() ? ` (pozvánka byla pro ${m.invited_email})` : ""}.
                  </p>
                  <AcceptForm token={token} />
                </div>
              ) : (
                <div className="mt-6 flex flex-col gap-3">
                  <Link
                    href={`/registrace?next=${encodeURIComponent(next)}${m.invited_email ? `&email=${encodeURIComponent(m.invited_email)}` : ""}`}
                    className="inline-flex h-11 items-center justify-center rounded-full bg-eucalyptus px-6 font-medium text-white hover:bg-eucalyptus-deep"
                  >
                    Založit účet a přijmout
                  </Link>
                  <Link
                    href={`/prihlaseni?next=${encodeURIComponent(next)}`}
                    className="inline-flex h-11 items-center justify-center rounded-full border border-line px-6 font-medium hover:border-eucalyptus"
                  >
                    Už mám účet – přihlásit se
                  </Link>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </main>
  );
}
