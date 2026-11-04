import Link from "next/link";
import { emailEnabled } from "@/lib/email/send";
import { createClient } from "@/lib/supabase/server";
import { moduleLevel, requireWedding } from "@/lib/wedding";
import { Composer, type Recipient } from "./composer";

export const metadata = { title: "E-maily hostům" };

const TABS = [
  { key: "pozvanky", kind: "invitation", label: "Pozvánky" },
  { key: "pripominky", kind: "reminder", label: "Připomínky" },
  { key: "zprava", kind: "message", label: "Zpráva" },
  { key: "podekovani", kind: "thank_you", label: "Poděkování" },
  { key: "historie", kind: null, label: "Odeslané" },
] as const;

const TEMPLATE: Record<string, string> = {
  invitation: "Pozvánka",
  reminder: "Připomínka",
  message: "Zpráva",
  thank_you: "Poděkování",
  rsvp_confirmation: "Potvrzení odpovědi",
  task_reminder: "Upozornění na úkoly",
};
const STATUS: Record<string, { label: string; cls: string }> = {
  queued: { label: "Ve frontě", cls: "bg-paper text-ink-soft" },
  sent: { label: "Odesláno", cls: "bg-paper text-ink-soft" },
  delivered: { label: "Doručeno", cls: "bg-eucalyptus-mist text-eucalyptus-deep" },
  opened: { label: "Otevřeno", cls: "bg-eucalyptus text-white" },
  bounced: { label: "Nedoručeno", cls: "bg-danger/10 text-danger" },
  complained: { label: "Označeno jako spam", cls: "bg-danger/10 text-danger" },
  failed: { label: "Chyba", cls: "bg-danger/10 text-danger" },
};

const dt = new Intl.DateTimeFormat("cs-CZ", { day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Prague" });

type Props = { searchParams: Promise<{ druh?: string; domacnost?: string }> };

export default async function GuestEmails({ searchParams }: Props) {
  const { druh, domacnost } = await searchParams;
  const tab = TABS.find((t) => t.key === druh) ?? TABS[0];
  const wedding = await requireWedding();
  const supabase = await createClient();
  const [{ data: households }, { data: log }, { data: w }, level] = await Promise.all([
    supabase
      .from("households")
      .select("id, name, email, locale, invited_at, unsubscribed_at, rsvp_submitted_at, thanked_at")
      .eq("wedding_id", wedding.id)
      .order("sort")
      .order("name"),
    supabase.from("email_log").select("id, household_id, template, to_email, status, error, created_at").eq("wedding_id", wedding.id).order("created_at", { ascending: false }).limit(200),
    supabase.from("weddings").select("locales").eq("id", wedding.id).single(),
    moduleLevel(wedding.id, "guests"),
  ]);
  const names = new Map((households ?? []).map((h) => [h.id, h.name]));
  const lastSent = new Map<string, Map<string, string>>();
  for (const l of [...(log ?? [])].reverse()) {
    if (!l.household_id || l.status === "failed") continue;
    const m = lastSent.get(l.template) ?? new Map<string, string>();
    m.set(l.household_id, l.created_at);
    lastSent.set(l.template, m);
  }

  const recipients: Recipient[] = (households ?? []).map((h) => ({
    id: h.id,
    name: h.name,
    email: h.email,
    locale: h.locale as "cs" | "en",
    unsubscribed: !!h.unsubscribed_at,
    invited: !!h.invited_at,
    responded: !!h.rsvp_submitted_at,
    thanked: !!h.thanked_at,
    lastSent: tab.kind ? (lastSent.get(tab.kind)?.get(h.id) ? dt.format(new Date(lastSent.get(tab.kind)!.get(h.id)!)) : null) : null,
  }));

  return (
    <div className="flex max-w-5xl flex-col gap-8 px-6 py-8 sm:px-10 lg:py-10">
      <div className="flex flex-col gap-2">
        <Link href="/app/hoste" className="text-sm text-ink-soft hover:text-ink">
          Zpět na hosty
        </Link>
        <h1 className="font-serif text-4xl tracking-tight">E-maily hostům</h1>
        <p className="max-w-2xl text-ink-soft">
          Pozvánky s osobním odkazem, připomínky těm, kdo ještě neodpověděli, zprávy a poděkování. Hosté, kteří odpoví na webu, dostanou potvrzení
          automaticky. Odpovědi na e-maily vám přijdou do vaší schránky.
        </p>
      </div>

      {!emailEnabled() ? (
        <p className="rounded-2xl bg-plum/8 px-5 py-4 text-sm text-plum">
          Odesílání e-mailů se právě zapíná. Zprávy si můžete připravit a prohlédnout, odeslat půjdou za chvíli.
        </p>
      ) : null}

      <nav className="flex flex-wrap gap-1 rounded-full bg-surface p-1 ring-1 ring-line/70 sm:self-start" aria-label="Druh e-mailu">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/app/hoste/emaily?druh=${t.key}`}
            aria-current={t.key === tab.key ? "page" : undefined}
            className={`rounded-full px-4 py-1.5 text-sm ${t.key === tab.key ? "bg-ink text-white" : "text-ink-soft hover:text-ink"}`}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      {tab.kind ? (
        <Composer
          key={tab.kind}
          kind={tab.kind}
          recipients={recipients}
          only={domacnost && /^[0-9a-f-]{36}$/.test(domacnost) ? domacnost : null}
          english={(w?.locales ?? []).includes("en") || recipients.some((r) => r.locale === "en")}
          canSend={level === "write" && emailEnabled()}
        />
      ) : (
        <section className="overflow-x-auto rounded-2xl bg-surface shadow-card ring-1 ring-line/70">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-line text-ink-soft">
              <tr>
                <th className="px-5 py-3 font-normal">Kdy</th>
                <th className="px-3 py-3 font-normal">Co</th>
                <th className="px-3 py-3 font-normal">Komu</th>
                <th className="px-5 py-3 font-normal">Stav</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line/70">
              {(log ?? []).map((l) => (
                <tr key={l.id}>
                  <td className="px-5 py-2.5 tabular-nums text-ink-soft">{dt.format(new Date(l.created_at))}</td>
                  <td className="px-3 py-2.5">{TEMPLATE[l.template] ?? l.template}</td>
                  <td className="px-3 py-2.5">
                    {l.household_id ? <span className="font-medium">{names.get(l.household_id) ?? "—"} </span> : null}
                    <span className="text-ink-soft">{l.to_email}</span>
                  </td>
                  <td className="px-5 py-2.5">
                    <span title={l.error ?? undefined} className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS[l.status]?.cls ?? ""}`}>
                      {STATUS[l.status]?.label ?? l.status}
                    </span>
                  </td>
                </tr>
              ))}
              {!log?.length ? (
                <tr>
                  <td colSpan={4} className="px-5 py-10 text-center text-ink-soft">
                    Zatím jste neposlali žádný e-mail.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}
