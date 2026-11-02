import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SiteHero } from "@/components/site/site-hero";
import { SiteSchedule } from "@/components/site/site-schedule";
import { SiteShell, siteHeading } from "@/components/site/site-shell";
import { householdByToken, resolveWedding } from "@/lib/site";
import { siteCopy } from "@/lib/site-copy";
import { RsvpForm } from "./rsvp-form";

type Props = { params: Promise<{ site: string; token: string }> };

export const metadata: Metadata = { robots: { index: false, follow: false }, referrer: "no-referrer" };

export default async function HouseholdSite({ params }: Props) {
  const { site, token } = await params;
  const wedding = await resolveWedding(site);
  if (!wedding) notFound();

  const household = await householdByToken(wedding.id, token);
  if (!household) {
    const copy = siteCopy(wedding.default_locale);
    return (
      <SiteShell template={wedding.template} preview={wedding.preview} previewText={copy.preview}>
        <p className="flex min-h-svh items-center justify-center px-6 text-center text-xl">{copy.notFound}</p>
      </SiteShell>
    );
  }

  const locale = household.locale;
  const copy = siteCopy(locale);
  const deadlinePassed = !!wedding.rsvp_deadline && new Date(wedding.rsvp_deadline) < new Date();
  const deadline = wedding.rsvp_deadline
    ? new Intl.DateTimeFormat(locale === "cs" ? "cs-CZ" : "en-GB", { day: "numeric", month: "long", timeZone: wedding.timezone }).format(new Date(wedding.rsvp_deadline))
    : null;
  const invitedEvents = household.events.filter((e) => e.invited);
  const first = household.events.find((e) => e.location_name);

  return (
    <SiteShell template={wedding.template} preview={wedding.preview} previewText={copy.preview}>
      <SiteHero
        partner1={wedding.partner1_name}
        partner2={wedding.partner2_name}
        date={wedding.wedding_date}
        place={first?.location_name ?? null}
        template={wedding.template}
        locale={locale}
      />
      <SiteSchedule events={household.events} locale={locale} timeZone={wedding.timezone} />
      {invitedEvents.length > 0 ? (
        <section className="mx-auto flex max-w-2xl flex-col gap-8 px-6 py-20">
          <div className="flex flex-col gap-3 text-center">
            <h2 style={siteHeading} className="text-4xl sm:text-5xl">{copy.rsvpTitle}</h2>
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
              household={household}
              locale={locale}
              disabled={wedding.preview}
              disabledText={wedding.preview ? copy.previewRsvp : null}
            />
          )}
        </section>
      ) : null}
    </SiteShell>
  );
}
