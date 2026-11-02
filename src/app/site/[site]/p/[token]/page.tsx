import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LanguageSwitch } from "@/components/site/language-switch";
import { SiteSections } from "@/components/site/site-sections";
import { SiteShell } from "@/components/site/site-shell";
import { householdByToken, householdRooms, householdTables, localizeEvents, pickLocale, resolveWedding, siteContent, siteNotices } from "@/lib/site";
import { SiteNotices } from "@/components/site/site-notices";
import { siteCopy } from "@/lib/site-copy";
import { RsvpForm } from "./rsvp-form";

type Props = { params: Promise<{ site: string; token: string }>; searchParams: Promise<{ lang?: string }> };

export const metadata: Metadata = { robots: { index: false, follow: false }, referrer: "no-referrer" };

export default async function HouseholdSite({ params, searchParams }: Props) {
  const [{ site, token }, { lang }] = await Promise.all([params, searchParams]);
  const wedding = await resolveWedding(site);
  if (!wedding) notFound();

  const household = await householdByToken(wedding.id, token);
  const content = await siteContent(wedding);
  if (!household) {
    const copy = siteCopy(wedding.default_locale);
    return (
      <SiteShell template={content.template} preview={wedding.preview} previewText={copy.preview}>
        <p className="flex min-h-svh items-center justify-center px-6 text-center text-xl">{copy.notFound}</p>
      </SiteShell>
    );
  }

  const locale = pickLocale(wedding, lang, household.locale);
  const copy = siteCopy(locale);
  const deadlinePassed = !!wedding.rsvp_deadline && new Date(wedding.rsvp_deadline) < new Date();
  const deadline = wedding.rsvp_deadline
    ? new Intl.DateTimeFormat(locale === "cs" ? "cs-CZ" : "en-GB", { day: "numeric", month: "long", timeZone: wedding.timezone }).format(new Date(wedding.rsvp_deadline))
    : null;
  const invited = household.events.some((e) => e.invited);
  const events = localizeEvents(household.events, locale);
  const [tables, rooms] = await Promise.all([householdTables(wedding, household, locale), householdRooms(household, locale)]);
  const notices = await siteNotices(wedding, events, locale, household.events.filter((e) => e.invited).map((e) => e.id));

  return (
    <SiteShell template={content.template} preview={wedding.preview} previewText={copy.preview}>
      <SiteNotices notices={notices} />
      {tables.length ? (
        <section className="flex flex-col items-center gap-2 px-6 py-6 text-center" style={{ background: "var(--site-line)" }}>
          <h2 className="text-sm" style={{ color: "var(--site-muted)" }}>{copy.yourTable}</h2>
          {[...new Set(tables.map((t) => t.event))].map((ev) => {
            const rows = tables.filter((t) => t.event === ev);
            const same = rows.every((r) => r.table === rows[0].table);
            return (
              <p key={ev} className="text-2xl">
                {tables.length > rows.length || new Set(tables.map((t) => t.event)).size > 1 ? `${ev}: ` : ""}
                {same ? <strong>{rows[0].table}</strong> : rows.map((r) => `${r.guest} – ${r.table}`).join(", ")}
              </p>
            );
          })}
        </section>
      ) : null}
      <div className="relative">
        <LanguageSwitch locales={wedding.locales} current={locale} />
        <SiteSections
          wedding={wedding}
          content={content}
          events={events}
          locale={locale}
          rsvp={
            invited ? (
              <div className="flex flex-col gap-8">
                {rooms.length ? (
                  <div className="flex flex-col gap-3 rounded-sm border px-5 py-5" style={{ borderColor: "var(--site-line)" }}>
                    <h3 className="text-sm" style={{ color: "var(--site-muted)" }}>{copy.yourRoom}</h3>
                    {rooms.map((r, i) => (
                      <div key={i} className="flex flex-col gap-1">
                        <p className="text-lg font-medium">
                          {r.lodging}, {r.room}
                          {rooms.length > 1 || r.guests.length < household.guests.length ? <span className="font-normal" style={{ color: "var(--site-muted)" }}> ({r.guests.join(", ")})</span> : null}
                        </p>
                        <p className="text-sm" style={{ color: "var(--site-muted)" }}>
                          {[
                            r.address,
                            r.paid_by_couple
                              ? copy.paidByCouple
                              : r.price !== null
                                ? `${new Intl.NumberFormat(locale === "cs" ? "cs-CZ" : "en-GB", { style: "currency", currency: r.currency, maximumFractionDigits: 0 }).format(r.price)} ${copy.perNight}`
                                : null,
                          ]
                            .filter(Boolean)
                            .join(", ")}
                        </p>
                        {r.info ? <p className="whitespace-pre-line text-sm">{r.info}</p> : null}
                        {r.url ? <a href={r.url} target="_blank" rel="noreferrer" className="text-sm underline underline-offset-2" style={{ color: "var(--site-accent)" }}>{r.url.replace(/^https?:\/\//, "")}</a> : null}
                      </div>
                    ))}
                  </div>
                ) : null}
                <div className="flex flex-col gap-2 text-center">
                  <p className="text-lg">
                    {copy.greeting(household.name)} {copy.invitation}
                  </p>
                  {deadline && !deadlinePassed ? <p style={{ color: "var(--site-muted)" }}>{copy.deadline(deadline)}</p> : null}
                </div>
                {deadlinePassed ? (
                  <p className="text-center">{copy.closed}</p>
                ) : (
                  <RsvpForm
                    site={site}
                    token={token}
                    household={{ ...household, events }}
                    locale={locale}
                    disabled={wedding.preview}
                    disabledText={wedding.preview ? copy.previewRsvp : null}
                  />
                )}
              </div>
            ) : null
          }
        />
      </div>
    </SiteShell>
  );
}
