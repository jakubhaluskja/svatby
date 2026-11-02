import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LanguageSwitch } from "@/components/site/language-switch";
import { SiteSections } from "@/components/site/site-sections";
import { SiteShell } from "@/components/site/site-shell";
import { householdByToken, householdTables, localizeEvents, pickLocale, resolveWedding, siteContent, siteNotices } from "@/lib/site";
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
  const tables = await householdTables(wedding, household, locale);
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
