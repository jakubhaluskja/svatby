import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LanguageSwitch } from "@/components/site/language-switch";
import { SiteSections } from "@/components/site/site-sections";
import { SiteShell } from "@/components/site/site-shell";
import { pickLocale, publicEvents, resolveWedding, siteAccess, siteContent, siteNotices } from "@/lib/site";
import { SiteNotices } from "@/components/site/site-notices";
import { siteCopy } from "@/lib/site-copy";
import { CodeForm } from "./code-form";
import { PasswordGate } from "./password-gate";

type Props = { params: Promise<{ site: string }>; searchParams: Promise<{ lang?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { site } = await params;
  const wedding = await resolveWedding(site);
  return {
    title: wedding ? `${wedding.partner1_name} & ${wedding.partner2_name}` : undefined,
    robots: { index: false, follow: false },
  };
}

export default async function WeddingSite({ params, searchParams }: Props) {
  const [{ site }, { lang }] = await Promise.all([params, searchParams]);
  const wedding = await resolveWedding(site);
  if (!wedding) notFound();

  const locale = pickLocale(wedding, lang);
  const copy = siteCopy(locale);
  const [content, events, access] = await Promise.all([siteContent(wedding), publicEvents(wedding.id, locale), siteAccess(wedding, false)]);

  const notices = await siteNotices(wedding, events, locale, null);

  if (access.locked) {
    return (
      <SiteShell template={content.template} preview={false} previewText="">
        <PasswordGate site={site} locale={locale} names={`${wedding.partner1_name} & ${wedding.partner2_name}`} />
      </SiteShell>
    );
  }

  return (
    <SiteShell template={content.template} preview={wedding.preview} previewText={copy.preview}>
      <SiteNotices notices={notices} />
      <div className="relative">
        <LanguageSwitch locales={wedding.locales} current={locale} />
        <SiteSections
          wedding={wedding}
          content={content}
          events={events}
          locale={locale}
          hidden={access.hidden}
          rsvp={
            <div className="flex flex-col items-center gap-4 text-center">
              <p style={{ color: "var(--site-muted)" }}>{copy.codeIntro}</p>
              <CodeForm site={site} locale={locale} />
            </div>
          }
        />
      </div>
    </SiteShell>
  );
}
