import Link from "next/link";
import { daysUntil, formatWeddingDate } from "@/components/site/site-hero";
import { FormMessage } from "@/components/ui";
import { appDomain } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { requireWedding } from "@/lib/wedding";
import { TaskItem } from "./task-item";

export const metadata = { title: "Přehled" };

type Props = { searchParams: Promise<{ vitejte?: string }> };

const shortDate = new Intl.DateTimeFormat("cs-CZ", { day: "numeric", month: "numeric", year: "numeric", timeZone: "UTC" });

export default async function DashboardPage({ searchParams }: Props) {
  const { vitejte } = await searchParams;
  const wedding = await requireWedding();
  const supabase = await createClient();

  const [{ data: tasks }, { count: guestCount }, { count: householdCount }] = await Promise.all([
    supabase
      .from("tasks")
      .select("id, title, due_date, done_at")
      .eq("wedding_id", wedding.id)
      .is("parent_id", null)
      .is("done_at", null)
      .order("due_date", { ascending: true, nullsFirst: false })
      .order("sort")
      .limit(6),
    supabase.from("guests").select("id", { count: "exact", head: true }).eq("wedding_id", wedding.id),
    supabase.from("households").select("id", { count: "exact", head: true }).eq("wedding_id", wedding.id),
  ]);

  const days = wedding.wedding_date ? daysUntil(wedding.wedding_date) : null;
  const domain = appDomain().replace(/:\d+$/, "");

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-12 px-6 py-10 sm:px-10">
      {vitejte ? (
        <FormMessage tone="info">
          Svatba je založená. Web zatím vidíte jen vy, hostům ho zpřístupníte zveřejněním.
        </FormMessage>
      ) : null}

      <section className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-2">
          <h1 className="font-display text-4xl font-semibold tracking-tight sm:text-5xl">
            {wedding.partner1_name} a {wedding.partner2_name}
          </h1>
          <p className="text-lg text-ink-soft">
            {wedding.wedding_date ? formatWeddingDate(wedding.wedding_date) : "Datum zatím nevíte"}
            {days !== null && days > 0 ? `, zbývá ${days} dní` : null}
          </p>
        </div>
        <Link
          href="/app/web/nahled"
          className="inline-flex h-11 items-center justify-center self-start rounded-full border border-line bg-surface px-5 text-[15px] font-medium hover:border-eucalyptus sm:self-auto"
        >
          Zobrazit náhled webu
        </Link>
      </section>

      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-3">
        <Stat label="Adresa webu" value={`${wedding.slug}.${domain}`} small />
        <Stat label="Stav webu" value={wedding.status === "published" ? "Zveřejněný" : "Koncept"} />
        <Stat label="Hosté" value={`${guestCount ?? 0} v ${householdCount ?? 0} domácnostech`} />
      </dl>

      {(householdCount ?? 0) === 0 ? (
        <section className="flex flex-col gap-3">
          <h2 className="font-display text-2xl font-semibold tracking-tight">Začněte tady</h2>
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
        </section>
      ) : null}

      <section className="flex flex-col gap-2">
        <h2 className="font-display text-2xl font-semibold tracking-tight">Nejbližší úkoly</h2>
        {tasks && tasks.length > 0 ? (
          <ul className="divide-y divide-line">
            {tasks.map((t) => (
              <TaskItem
                key={t.id}
                id={t.id}
                title={t.title}
                due={t.due_date ? shortDate.format(new Date(t.due_date)) : null}
                done={!!t.done_at}
              />
            ))}
          </ul>
        ) : (
          <p className="text-ink-soft">Všechno hotovo. Další úkoly se objeví, až se přiblíží jejich termín.</p>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value, small }: { label: string; value: string; small?: boolean }) {
  return (
    <div className="flex flex-col gap-1 bg-surface px-5 py-4">
      <dt className="text-sm text-ink-soft">{label}</dt>
      <dd className={`font-medium ${small ? "truncate text-[15px]" : "text-lg"}`}>{value}</dd>
    </div>
  );
}
