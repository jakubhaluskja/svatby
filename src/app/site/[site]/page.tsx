import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SiteHero } from "@/components/site/site-hero";
import { SiteSchedule } from "@/components/site/site-schedule";
import { SiteShell, siteHeading } from "@/components/site/site-shell";
import { publicEvents, resolveWedding } from "@/lib/site";
import { siteCopy } from "@/lib/site-copy";
import { CodeForm } from "./code-form";

type Props = { params: Promise<{ site: string }> };

// Svatební weby se nikdy neindexují.
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function WeddingSite({ params }: Props) {
  const { site } = await params;
  const wedding = await resolveWedding(site);
  if (!wedding) notFound();

  const locale = wedding.default_locale;
  const copy = siteCopy(locale);
  const events = await publicEvents(wedding.id, locale);
  const first = events.find((e) => e.location_name);

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
      <SiteSchedule events={events} locale={locale} timeZone={wedding.timezone} />
      <section className="flex flex-col items-center gap-6 px-6 py-20 text-center">
        <h2 style={siteHeading} className="text-4xl sm:text-5xl">{copy.rsvpTitle}</h2>
        <p style={{ color: "var(--site-muted)" }}>{copy.codeIntro}</p>
        <CodeForm site={site} locale={locale} />
      </section>
    </SiteShell>
  );
}
