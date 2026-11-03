import Link from "next/link";
import { notFound } from "next/navigation";
import { FormMessage } from "@/components/ui";
import { appDomain } from "@/lib/env";
import { guestName, guestStatus, loadGuestBook } from "@/lib/guest-data";
import { householdUrl } from "@/lib/hosts";
import { createClient } from "@/lib/supabase/server";
import { requireWedding } from "@/lib/wedding";
import { deleteHousehold, saveRsvpDetails } from "../actions";
import { LinkPanel } from "./link-panel";
import { ResponseSelect } from "./response-select";

export const metadata = { title: "Domácnost" };

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ ulozeno?: string }> };

const fieldCls = "h-10 w-full rounded-lg border border-line bg-surface px-3 text-[15px] focus:border-eucalyptus focus:outline-none";

export default async function HouseholdPage({ params, searchParams }: Props) {
  const [{ id }, { ulozeno }] = await Promise.all([params, searchParams]);
  const wedding = await requireWedding();
  const supabase = await createClient();
  const book = await loadGuestBook(supabase, wedding.id, id);
  const h = book.households[0];
  if (!h) notFound();

  const events = book.events.filter((e) => h.event_ids.includes(e.id));
  const category = new Map(book.categories.map((c) => [c.id, c.label]));
  const url = householdUrl(wedding.slug, h.token, appDomain());
  const couple = `${wedding.partner1_name} a ${wedding.partner2_name}`;
  const message =
    h.locale === "en"
      ? `Hi! ${wedding.partner1_name} & ${wedding.partner2_name} would love you to join their wedding. Please reply here:`
      : `Ahoj, srdečně vás zveme na naši svatbu. ${couple}. Účast prosím potvrďte tady:`;

  return (
    <div className="flex max-w-4xl flex-col gap-10 px-6 py-8 sm:px-10 lg:py-10">
      <div className="flex flex-col gap-3">
        <Link href="/app/hoste" className="text-sm text-ink-soft hover:text-ink">Zpět na hosty</Link>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h1 className="font-serif text-4xl tracking-tight">{h.name}</h1>
          <Link href={`/app/hoste/${h.id}/upravit`} className="inline-flex h-10 items-center rounded-full border border-line bg-surface px-5 text-sm font-medium hover:border-eucalyptus">
            Upravit domácnost
          </Link>
        </div>
        <p className="text-ink-soft">
          {h.rsvp_submitted_at
            ? `Odpověděli ${new Intl.DateTimeFormat("cs-CZ", { dateStyle: "long", timeZone: "Europe/Prague" }).format(new Date(h.rsvp_submitted_at))}`
            : "Zatím neodpověděli"}
          {h.plus_ones_allowed > 0 ? `, smí přivést ${h.plus_ones_allowed} ${h.plus_ones_allowed === 1 ? "doprovod" : "doprovody"}` : ""}
          {h.locale === "en" ? ", anglicky" : ""}
        </p>
      </div>

      {ulozeno ? <FormMessage tone="info">Změny jsou uložené.</FormMessage> : null}

      <LinkPanel householdId={h.id} url={url} shortCode={h.short_code} message={message} />

      <section className="flex flex-col gap-4">
        <h2 className="font-serif text-2xl tracking-tight">Účast</h2>
        {events.length === 0 ? (
          <p className="text-ink-soft">Domácnost zatím není pozvaná na žádnou událost. Nastavíte to v úpravě domácnosti.</p>
        ) : (
          <div className="overflow-x-auto rounded-2xl bg-surface shadow-card ring-1 ring-line/70">
            <table className="w-full text-left text-[15px]">
              <thead className="text-sm text-ink-soft">
                <tr className="border-b border-line">
                  <th className="px-5 py-3 font-normal">Host</th>
                  {events.map((e) => (
                    <th key={e.id} className="px-5 py-3 font-normal">{e.name}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {h.guests.map((g) => (
                  <tr key={g.id} className="border-b border-line last:border-0">
                    <td className="px-5 py-3">
                      <span className="font-medium">{guestName(g)}</span>
                      <span className="block text-sm text-ink-soft">
                        {[g.age_category_id ? category.get(g.age_category_id) : null, g.is_plus_one ? "doprovod" : null, g.needs_high_chair ? "dětská židlička" : null, ...g.tags]
                          .filter(Boolean)
                          .join(", ")}
                      </span>
                    </td>
                    {events.map((e) => (
                      <td key={e.id} className="px-5 py-3">
                        <ResponseSelect
                          householdId={h.id}
                          guestId={g.id}
                          eventId={e.id}
                          status={guestStatus(h, g, e.id) ?? "pending"}
                          label={`${guestName(g)}, ${e.name}`}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="font-serif text-2xl tracking-tight">Údaje z odpovědi</h2>
        <form action={saveRsvpDetails.bind(null, h.id)} className="flex flex-col gap-5">
          <div className="grid gap-4 sm:grid-cols-2">
            {h.guests.map((g) => (
              <fieldset key={g.id} className="flex flex-col gap-2 rounded-xl bg-surface p-4 shadow-card ring-1 ring-line/70">
                <legend className="px-1 text-sm font-medium">{guestName(g)}</legend>
                <label className="flex flex-col gap-1 text-sm">
                  Strava
                  <input name={`diet:${g.id}`} defaultValue={g.diet ?? ""} placeholder="Například vegetarián" className={fieldCls} maxLength={200} />
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  Alergie
                  <input name={`allergies:${g.id}`} defaultValue={g.allergies ?? ""} className={fieldCls} maxLength={200} />
                </label>
              </fieldset>
            ))}
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <label className="flex flex-col gap-1 text-sm">
              Ubytování
              <select name="needs_lodging" defaultValue={h.needs_lodging === null ? "" : h.needs_lodging ? "yes" : "no"} className={fieldCls}>
                <option value="">Neuvedeno</option>
                <option value="yes">Chtějí ubytování</option>
                <option value="no">Nepotřebují</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm sm:col-span-2">
              Poznámka k ubytování
              <input name="lodging_note" defaultValue={h.lodging_note ?? ""} className={fieldCls} maxLength={300} />
            </label>
            <label className="flex flex-col gap-1 text-sm sm:col-span-3">
              Přání písničky
              <input name="song_wish" defaultValue={h.song_wish ?? ""} className={fieldCls} maxLength={200} />
            </label>
          </div>
          {h.message ? (
            <blockquote className="border-l-2 border-eucalyptus pl-4 text-ink-soft">
              <span className="block text-sm">Vzkaz od hostů</span>
              {h.message}
            </blockquote>
          ) : null}
          <button type="submit" className="self-start rounded-full bg-eucalyptus px-5 py-2.5 text-sm font-medium text-white hover:bg-eucalyptus-deep">
            Uložit údaje
          </button>
        </form>
      </section>

      <details className="border-t border-line pt-6">
        <summary className="cursor-pointer text-sm text-ink-soft hover:text-ink">Smazat domácnost</summary>
        <form action={deleteHousehold.bind(null, h.id)} className="mt-4 flex flex-col items-start gap-3">
          <p className="text-sm text-ink-soft">Smažou se všichni její hosté i jejich odpovědi. Osobní odkaz přestane fungovat.</p>
          <button type="submit" className="rounded-full border border-danger px-5 py-2 text-sm font-medium text-danger hover:bg-danger hover:text-white">
            Smazat natrvalo
          </button>
        </form>
      </details>
    </div>
  );
}
