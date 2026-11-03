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
import { TaskItem } from "./task-item";

export const metadata = { title: "Přehled" };

type Props = { searchParams: Promise<{ vitejte?: string }> };

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
  const { vitejte } = await searchParams;
  const [wedding, user] = await Promise.all([requireWedding(), requireUser()]);
  const supabase = await createClient();
  const today = utcToZonedParts(new Date().toISOString()).date;
  const inWeek = new Date(Date.parse(`${today}T00:00:00Z`) + 7 * 86_400_000).toISOString().slice(0, 10);

  const [{ data: week }, { count: taskTotal }, { count: taskDone }, book, { data: profile }, { data: members }] = await Promise.all([
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
    supabase.from("wedding_members").select("id, display_name, invited_email").eq("wedding_id", wedding.id),
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

  return (
    <div className="flex max-w-6xl flex-col gap-6 px-6 py-8 sm:px-10 lg:py-10">
      {vitejte ? <FormMessage tone="info">Svatba je založená. Web zatím vidíte jen vy, hostům ho zpřístupníte zveřejněním.</FormMessage> : null}

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

      {book.households.length === 0 ? (
        <Card className="flex flex-col gap-3 p-6">
          <h2 className="font-serif text-2xl">Začněte tady</h2>
          <ol className="flex flex-col gap-2 text-[15px]">
            <li>
              1. <Link href="/app/udalosti" className="font-medium underline underline-offset-2">Doplňte události</Link>
              <span className="text-ink-soft">: obřad, hostinu, večerní zábavu. Hosté u nich potvrdí účast.</span>
            </li>
            <li>
              2. <Link href="/app/hoste" className="font-medium underline underline-offset-2">Přidejte hosty</Link>
              <span className="text-ink-soft">, ručně nebo vložením z Excelu. Každá domácnost dostane osobní odkaz.</span>
            </li>
          </ol>
        </Card>
      ) : null}

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
