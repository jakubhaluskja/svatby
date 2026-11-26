import type { Metadata } from "next";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { galleryByToken } from "@/lib/gallery";
import { linkDomain } from "@/lib/domain";
import { siteUrl } from "@/lib/hosts";
import { getTemplate } from "@/lib/templates";
import { slideshowFeed } from "../actions";
import { Slideshow } from "./slideshow";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Živá prezentace", robots: { index: false, follow: false } };

type Props = { params: Promise<{ site: string; token: string }> };

/** Živá prezentace fotek a vzkazů na projektor / televizi během večera. */
export default async function SlideshowPage({ params }: Props) {
  const { site, token } = await params;
  const g = await galleryByToken(site, token);
  if (!g) notFound();
  const [feed, domain] = await Promise.all([slideshowFeed(site, token), linkDomain()]);
  const guestUrl = `${siteUrl(g.slug, domain)}/fotky/${token}`;
  const qr = await QRCode.toString(guestUrl, { type: "svg", margin: 0, errorCorrectionLevel: "M" });
  const t = getTemplate(g.template);
  return (
    <Slideshow
      site={site}
      token={token}
      couple={`${g.partner1_name} & ${g.partner2_name}`}
      qrSvg={qr}
      guestUrl={guestUrl.replace(/^https?:\/\//, "")}
      initial={feed ?? { photos: [], entries: [] }}
      displayFont={t.displayFont}
      accent={t.colors.accent}
      locale={g.default_locale}
    />
  );
}
