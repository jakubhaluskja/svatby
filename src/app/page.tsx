import Link from "next/link";
import { Icon, type IconName } from "@/components/icons";
import { Wordmark } from "@/components/ui";
import { PLANS, formatCzk } from "@/lib/pricing";

const FEATURES: { icon: IconName; title: string; text: string }[] = [
  { icon: "globe", title: "Svatební web", text: "Pět šablon, úpravy přímo na stránce, čeština i angličtina." },
  { icon: "users", title: "Hosté a RSVP", text: "Každá domácnost má osobní odkaz. Nic se neinstaluje, zvládne to i babička." },
  { icon: "check", title: "Checklist a harmonogram", text: "Úkoly s termíny, upozornění e-mailem, program dne pro dodavatele." },
  { icon: "wallet", title: "Rozpočet", text: "Platby a zálohy hlídané v checklistu, eura přepočtená kurzem ČNB." },
  { icon: "seat", title: "Zasedací pořádek", text: "Stoly a židle, automatické rozsazení podle pravidel, tisk pro místo konání." },
  { icon: "camera", title: "Fotky od hostů", text: "QR kód na stoly, fotky a videa na jednom místě, živá prezentace večer." },
  { icon: "gift", title: "Dary", text: "Seznam přání a příspěvky přímo na váš účet – bez poplatků za platby." },
  { icon: "user", title: "Plánujete spolu", text: "Pozvěte partnera, svědky i rodiče. Každý vidí jen to, co mu povolíte." },
];

const FAQ = [
  ["Opravdu je plánovač zdarma?", "Ano. Checklist, rozpočet, hosty, zasedací pořádek i náhled webu používáte zdarma, bez časového omezení. Platíte jen jednou, až chcete web zveřejnit hostům."],
  ["Je to předplatné?", "Ne. Platba je jednorázová, nic se automaticky neobnovuje."],
  ["Musí si hosté něco instalovat?", "Ne. Hosté odpovídají přes osobní odkaz nebo kód z pozvánky, fotky nahrávají přes QR kód v prohlížeči."],
  ["Co se stane s daty po svatbě?", "Web běží 12 měsíců od svatby. Citlivé údaje hostů (strava, alergie) půl roku po svatbě automaticky anonymizujeme."],
] as const;

export default function Home() {
  return (
    <main className="min-h-svh bg-paper">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <Wordmark />
        <Link href="/prihlaseni" className="rounded-full px-4 py-2 text-sm font-medium text-ink-soft hover:bg-surface hover:text-ink">
          Přihlásit se
        </Link>
      </header>

      <section className="mx-auto flex max-w-6xl flex-col items-start gap-7 px-6 pt-10 pb-20 sm:pt-16">
        <p className="rounded-full bg-eucalyptus-mist px-3 py-1 text-sm font-medium text-eucalyptus-deep">Plánovač zdarma · web jednorázově od {formatCzk(PLANS[1].price)}</p>
        <h1 className="max-w-3xl font-serif text-[clamp(2.6rem,6vw,4.6rem)] leading-[1.04] tracking-tight">Svatba v jedné aplikaci. Web, hosté i plánování.</h1>
        <p className="max-w-xl text-lg text-ink-soft">Všechno, co potřebujete od zásnub po poděkování, česky a bez předplatného. Začněte zdarma a za web zaplaťte, až ho budete chtít ukázat hostům.</p>
        <div className="flex flex-wrap gap-3">
          <Link href="/registrace" className="inline-flex h-12 items-center rounded-full bg-eucalyptus px-7 font-medium text-white hover:bg-eucalyptus-deep">
            Založit svatbu zdarma
          </Link>
          <a href="#cenik" className="inline-flex h-12 items-center rounded-full px-6 font-medium text-ink-soft ring-1 ring-line hover:bg-surface hover:text-ink">
            Ceník
          </a>
        </div>
      </section>

      <section className="border-y border-line bg-surface">
        <div className="mx-auto grid max-w-6xl gap-x-8 gap-y-10 px-6 py-16 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f) => (
            <div key={f.title} className="flex flex-col gap-2">
              <span className="grid size-10 place-items-center rounded-full bg-eucalyptus-mist text-eucalyptus-deep">
                <Icon n={f.icon} />
              </span>
              <h2 className="mt-1 font-medium">{f.title}</h2>
              <p className="text-[15px] text-ink-soft">{f.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="cenik" className="mx-auto max-w-6xl px-6 py-20">
        <h2 className="font-serif text-4xl tracking-tight">Ceník</h2>
        <p className="mt-2 max-w-xl text-ink-soft">Jednorázově, včetně DPH. Žádné předplatné, žádné poplatky z darů.</p>
        <div className="mt-10 grid gap-4 lg:grid-cols-3">
          {PLANS.map((p, i) => (
            <div key={p.key} className={`flex flex-col gap-5 rounded-3xl p-7 ${i === 1 ? "bg-ink text-white" : "bg-surface ring-1 ring-line/70"}`}>
              <div>
                <p className={`text-sm ${i === 1 ? "text-white/70" : "text-ink-soft"}`}>{p.name}</p>
                <p className="mt-1 font-serif text-4xl">{p.price === 0 ? "Zdarma" : formatCzk(p.price)}</p>
                <p className={`text-sm ${i === 1 ? "text-white/70" : "text-ink-soft"}`}>{p.lead}</p>
              </div>
              <ul className="flex flex-col gap-2 text-[15px]">
                {p.points.map((pt) => (
                  <li key={pt} className="flex gap-2">
                    <Icon n="check" className={`mt-0.5 size-4 shrink-0 ${i === 1 ? "text-eucalyptus-mist" : "text-eucalyptus"}`} />
                    {pt}
                  </li>
                ))}
              </ul>
              <Link
                href="/registrace"
                className={`mt-auto inline-flex h-11 items-center justify-center rounded-full font-medium ${i === 1 ? "bg-white text-ink hover:bg-white/90" : "bg-eucalyptus text-white hover:bg-eucalyptus-deep"}`}
              >
                {p.price === 0 ? "Začít zdarma" : "Začít zdarma, zaplatit později"}
              </Link>
            </div>
          ))}
        </div>
      </section>

      <section className="border-t border-line bg-surface">
        <div className="mx-auto grid max-w-6xl gap-10 px-6 py-16 lg:grid-cols-[1fr_2fr]">
          <h2 className="font-serif text-4xl tracking-tight">Časté otázky</h2>
          <dl className="flex flex-col divide-y divide-line">
            {FAQ.map(([q, a]) => (
              <div key={q} className="py-5">
                <dt className="font-medium">{q}</dt>
                <dd className="mt-1.5 text-ink-soft">{a}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <footer className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-10 text-sm text-ink-soft">
        <Wordmark />
        <span>© {new Date().getFullYear()} · info@jakubhaluska.cz</span>
      </footer>
    </main>
  );
}
