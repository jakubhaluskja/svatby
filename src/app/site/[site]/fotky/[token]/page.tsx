import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SiteShell } from "@/components/site/site-shell";
import { galleryByToken } from "@/lib/gallery";
import { createAdminClient } from "@/lib/supabase/admin";
import { guestPhotos } from "./actions";
import { GuestGallery } from "./guest-gallery";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Fotky a vzkazy", robots: { index: false, follow: false } };

type Props = { params: Promise<{ site: string; token: string }>; searchParams: Promise<{ lang?: string }> };

/** Stránka pro hosty (QR na stolech): nahrávání fotek, prohlížení, kniha přání. */
export default async function GuestPhotosPage({ params, searchParams }: Props) {
  const [{ site, token }, { lang }] = await Promise.all([params, searchParams]);
  const g = await galleryByToken(site, token);
  if (!g) notFound();
  const locale = lang === "en" || lang === "cs" ? lang : g.default_locale;
  const [photos, { data: entries }] = await Promise.all([
    guestPhotos(site, token, null),
    createAdminClient().from("guestbook_entries").select("id, name, message, created_at").eq("wedding_id", g.id).is("hidden_at", null).order("created_at", { ascending: false }).limit(100),
  ]);

  return (
    <SiteShell template={g.template} preview={false} previewText="">
      <GuestGallery
        site={site}
        token={token}
        locale={locale}
        couple={locale === "en" ? `${g.partner1_name} & ${g.partner2_name}` : `${g.partner1_name} & ${g.partner2_name}`}
        open={g.open}
        moderated={g.gallery_moderation === "approve"}
        initialPhotos={photos}
        initialEntries={(entries ?? []).map((e) => ({ id: e.id, name: e.name, message: e.message, createdAt: e.created_at }))}
      />
    </SiteShell>
  );
}
