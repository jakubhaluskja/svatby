import { linkDomain } from "@/lib/domain";
import Link from "next/link";
import { daysUntil, formatWeddingDate } from "@/components/site/site-hero";
import { Icon, type IconName } from "@/components/icons";
import { Card, Eyebrow, FormMessage } from "@/components/ui";
import { loadGuestBook } from "@/lib/guest-data";
import { siteUrl } from "@/lib/hosts";
import { createClient } from "@/lib/supabase/server";
import { utcToZonedParts } from "@/lib/time";
import { requireUser, requireWedding } from "@/lib/wedding";
import { FirstSteps, type Step } from "./first-steps";
import { TaskItem } from "./task-item";

export const metadata = { title: "Přehled" };

type Props = { searchParams: Promise<{ vitejte?: string; pristup?: string }> };

const shortDate = new Intl.DateTimeFormat("cs-CZ", { day: "numeric", month: "numeric", timeZone: "UTC" });
const longToday = new Intl.DateTimeFormat("cs-CZ", { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/Prague" });
const relTime = new Intl.RelativeTimeFormat("cs", { numeric: "auto" });

function ago(iso: string) {
  const min = Math.round((Date.now() - Date.parse(iso)) / 60_000);
  if (min < 60) return relTime.format(-Math.max(min, 1), "minute");
  if (min < 24 * 60) return relTime.format(-Math.round(min / 60), "hour");
  return relTime.format(-Math.round(min / 1440), "day");
}

function greeting() {
  const h = Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hourCycle: "h23", timeZone: "Europe/Prague" }).format(new Date()));
  return h < 10 ? "Dobré ráno" : h < 18 ? "Dobrý den" : "Dobrý večer";
}

export default async function DashboardPage({ searchParams }: Props) {
  const { vitejte, pristup } = await searchParams;
  const [wedding, user] = await Promise.all([requireWedding(), requireUser()]);
  const supabase = await createClient();
  const today = utcToZonedParts(new Date().toISOString()).date;
  const inWeek = new Date(Date.parse(`${today}T00:00:00Z`) + 7 * 86_400_000).toISOString().slice(0, 10);

  const couple = wedding.role !== "coorganizer";
  const [{ data: week }, { count: taskTotal }, { count: taskDone }, book, { data: profile }, { data: members }, onboarding] = await Promise.all([
    supabase
      .from("tasks")
      .select("id, title, due_date, done_at, assignee_member_id, assignee_name")
      .eq("wedding_id", wedding.id)
      .is("parent_id", null)
      .is("done_at", null)
      .lte("due_date", inWeek)
      .order("due_date")
      .limit(6),
    supabase.from("tasks").select("id", { count: "exact", head: true }).eq("wedding_id", wedding.id).is("parent_id", null),
    supabase.from("tasks").select("id", { count: "exact", head: true }).eq("wedding_id", wedding.id).is("parent_id", null).not("done_at", "is", null),
    loadGuestBook(supabase, wedding.id),
    supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle(),
    supabase.from("wedding_members").select("id, role, display_name, invited_email").eq("wedding_id", wedding.id),
    couple
      ? Promise.all([
          supabase.from("events").select("starts_at, location_name").eq("wedding_id", wedding.id),
          supabase.from("site_pages").select("updated_at").eq("wedding_id", wedding.id).eq("state", "draft").maybeSingle(),
          supabase.from("weddings").select("created_at, budget_total").eq("id", wedding.id).single(),
          supabase.from("budget_items").select("id", { count: "exact", head: true }).eq("wedding_id", wedding.id).or("estimate_amount.not.is.null,actual_amount.not.is.null"),
          supabase.from("households").select("id", { count: "exact", head: true }).eq("wedding_id", wedding.id).not("invited_at", "is", null),
        ])
      : Promise.resolve(null),
  ]);

  const memberName = new Map((members ?? []).map((m) => [m.id as string, (m.display_name as string | null) || (m.invited_email as string | null) || "Člen týmu"]));
  const guests = book.households.flatMap((h) => h.guests.map((g) => ({ h, g })));
  const invited = guests.filter(({ h }) => h.event_ids.length > 0);
  const confirmed = invited.filter(({ h, g }) => h.event_ids.some((e) => g.responses[e] === "yes")).length;
  const answered = book.households.filter((h) => h.rsvp_submitted_at).sort((a, b) => b.rsvp_submitted_at!.localeCompare(a.rsvp_submitted_at!));
  const days = wedding.wedding_date ? daysUntil(wedding.wedding_date) : null;
  const firstName = (profile?.full_name ?? "").split(" ")[0];
  const webUrl = siteUrl(wedding.slug, await linkDomain());
  const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : 0);

  let steps: Step[] = [];
  if (onboarding) {
    const [{ data: evs }, { data: page }, { data: wrow }, { count: budgetItems }, { count: invitedCount }] = onboarding;
    const created = Date.parse(wrow?.created_at ?? "");
    steps = [
      { key: "date", title: "Datum a místo", text: "Bez nich se nic dalšího nehne.", href: "/app/udalosti", done: !!wedding.wedding_date && (evs ?? []).some((e) => e.location_name) },
      { key: "partner", title: "Pozvat partnera", text: "Plánujte spolu, každý ze svého telefonu.", href: "/app/tym", done: (members ?? []).some((m) => m.role === "partner") },
      { key: "budget", title: "Nastavit rozpočet", text: "Kolik chcete utratit a za co.", href: "/app/rozpocet", done: !!wrow?.budget_total || (budgetItems ?? 0) > 0 },
      { key: "events", title: "Program dne", text: "Obřad, hostina, zábava – hosté u nich potvrdí účast.", href: "/app/udalosti", done: (evs ?? []).filter((e) => e.starts_at).length >= 2 },
      { key: "guests", title: "Přidat hosty", text: "Ručně nebo vložením z Excelu.", href: "/app/hoste", done: book.households.length > 0 },
      { key: "web", title: "Vyladit web", text: "Šablona, texty, fotky – změny vidíte hned.", href: "/app/web/editor", done: !!page && Date.parse(page.updated_at) - created > 60_000 },
      { key: "invite", title: "Rozeslat pozvánky", text: "E-mailem, odkazem nebo s QR kódem na papíře.", href: "/app/hoste/emaily", done: (invitedCount ?? 0) > 0 || book.households.some((h) => h.rsvp_submitted_at) },
    ];
  }

  return (
    <div className="flex max-w-6xl flex-col gap-6 px-6 py-8 sm:px-10 lg:py-10">
      {vitejte ? (
        <FormMessage tone="info">
          {wedding.role === "coorganizer"
            ? "Vítejte v týmu! V menu vidíte části, ke kterým vám novomanželé dali přístup."
            : "Svatba je založená. Web zatím vidíte jen vy, hostům ho zpřístupníte zveřejněním."}
        </FormMessage>
      ) : null}
      {pristup === "0" ? <FormMessage>K této části svatby nemáte přístup. Pokud ho potřebujete, napište novomanželům.</FormMessage> : null}

      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Eyebrow>{longToday.format(new Date())}</Eyebrow>
          <h1 className="mt-2 font-serif text-4xl tracking-tight sm:text-[40px]">
            {greeting()}
            {firstName ? `, ${firstName}` : ""}
          </h1>
        </div>
        <a href={webUrl} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center gap-2 self-start rounded-full bg-surface px-4 text-sm font-medium ring-1 ring-line hover:ring-eucalyptus sm:self-auto">
          <Icon n="eye" className="size-4" />
          {wedding.status === "published" ? "Otevřít web" : "Náhled webu"}
        </a>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-[1.35fr_1fr_1fr_1fr]">
        <section className="relative overflow-hidden rounded-2xl bg-eucalyptus p-6 text-white shadow-card">
          {days !== null && days >= 0 ? (
            <>
              <p className="text-sm text-white/75">{days === 0 ? "Je to tady" : "Do svatby zbývá"}</p>
              <p className="mt-1 font-serif text-6xl leading-none">
                {days === 0 ? "Dnes" : days}
                {days > 0 ? <span className="text-2xl"> {days === 1 ? "den" : days <= 4 ? "dny" : "dní"}</span> : null}
              </p>
              <p className="mt-4 text-sm text-white/85">{formatWeddingDate(wedding.wedding_date!)}</p>
            </>
          ) : (
            <>
              <p className="text-sm text-white/75">Datum svatby</p>
              <p className="mt-1 font-serif text-3xl leading-tight">{wedding.wedding_date ? formatWeddingDate(wedding.wedding_date) : "Zatím nevíte"}</p>
            </>
          )}
          <svg viewBox="0 0 120 120" className="pointer-events-none absolute -bottom-6 -right-4 size-36 text-white/10" aria-hidden>
            <circle cx="45" cy="60" r="34" fill="none" stroke="currentColor" strokeWidth="8" />
            <circle cx="75" cy="60" r="34" fill="none" stroke="currentColor" strokeWidth="8" />
          </svg>
        </section>
        <Stat href="/app/hoste" icon="users" label="Hosté potvrzeni" value={String(confirmed)} sub={`z ${invited.length} pozvaných`} pct={pct(confirmed, invited.length)} />
        <Stat href="/app/checklist" icon="check" label="Checklist" value={`${pct(taskDone ?? 0, taskTotal ?? 0)} %`} sub={`${taskDone ?? 0} z ${taskTotal ?? 0} úkolů`} pct={pct(taskDone ?? 0, taskTotal ?? 0)} />
        <Stat
          href="/app/web"
          icon="globe"
          label="Svatební web"
          value={wedding.status === "published" ? "Online" : "Koncept"}
          sub={wedding.status === "published" ? "Hosté ho vidí" : "Vidíte ho jen vy"}
          pct={wedding.status === "published" ? 100 : 30}
        />
      </div>

      {steps.length ? <FirstSteps steps={steps} weddingId={wedding.id} /> : null}


      <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <Card className="flex flex-col p-6">
          <div className="flex items-center justify-between">
            <h2 className="font-serif text-2xl">Tento týden</h2>
            <Link href="/app/checklist" className="flex items-center gap-1 text-sm text-eucalyptus-deep hover:underline">
              Celý checklist
              <Icon n="chev" className="size-4" />
            </Link>
          </div>
          {week && week.length > 0 ? (
            <ul className="mt-4 flex flex-col gap-2">
              {week.map((t) => (
                <TaskItem
                  key={t.id}
                  id={t.id}
                  title={t.title}
                  due={t.due_date ? (t.due_date < today ? `po termínu, ${shortDate.format(new Date(t.due_date))}` : shortDate.format(new Date(t.due_date))) : null}
                  overdue={!!t.due_date && t.due_date < today}
                  done={false}
                  assignee={t.assignee_member_id ? memberName.get(t.assignee_member_id) : t.assignee_name}
                />
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-ink-soft">Na tento týden nic nečeká. Další úkoly se objeví, až se přiblíží jejich termín.</p>
          )}
        </Card>
        <Card className="flex flex-col p-6">
          <div className="flex items-center justify-between">
            <h2 className="font-serif text-2xl">Nové odpovědi</h2>
            <span className="rounded-full bg-eucalyptus-mist px-2.5 py-0.5 text-xs font-medium text-eucalyptus-deep">
              {answered.length} z {book.households.length}
            </span>
          </div>
          {answered.length ? (
            <ul className="mt-2 flex flex-col divide-y divide-line">
              {answered.slice(0, 5).map((h) => {
                const yes = h.guests.filter((g) => h.event_ids.some((e) => g.responses[e] === "yes")).length;
                return (
                  <li key={h.id}>
                    <Link href={`/app/hoste/${h.id}`} className="flex items-center gap-3 py-3 hover:opacity-80">
                      <span className={`size-2.5 shrink-0 rounded-full ${yes ? "bg-eucalyptus" : "bg-plum"}`} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{h.name}</span>
                        <span className="text-sm text-ink-soft">
                          {yes ? `${yes} ${yes === 1 ? "přijde" : "přijdou"}` : "nepřijdou"}
                          {h.needs_lodging ? " · přespí" : ""}
                        </span>
                      </span>
                      <span className="shrink-0 text-xs text-ink-soft">{ago(h.rsvp_submitted_at!)}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="mt-4 text-ink-soft">Zatím nikdo neodpověděl. Odpovědi hostů se objeví tady.</p>
          )}
        </Card>
      </div>
    </div>
  );
}

function Stat({ href, icon, label, value, sub, pct }: { href: string; icon: IconName; label: string; value: string; sub: string; pct: number }) {
  return (
    <Link href={href} className="flex flex-col rounded-2xl bg-surface p-5 shadow-card ring-1 ring-line/70 transition-shadow hover:ring-eucalyptus/50">
      <span className="flex items-center gap-2 text-sm text-ink-soft">
        <span className="grid size-8 place-items-center rounded-lg bg-eucalyptus-mist text-eucalyptus-deep">
          <Icon n={icon} className="size-4" />
        </span>
        {label}
      </span>
      <span className="mt-4 font-display text-3xl font-semibold tabular-nums">{value}</span>
      <span className="text-sm text-ink-soft">{sub}</span>
      <span className="mt-auto block pt-4">
        <span className="block h-1.5 rounded-full bg-paper">
          <span className="block h-full rounded-full bg-eucalyptus" style={{ width: `${pct}%` }} />
        </span>
      </span>
    </Link>
  );
}
