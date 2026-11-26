import QRCode from "qrcode";
import { linkDomain } from "@/lib/domain";
import { galleryById } from "@/lib/gallery";
import { siteUrl } from "@/lib/hosts";
import { createClient } from "@/lib/supabase/server";
import { moduleLevel, requireWedding } from "@/lib/wedding";
import { loadMedia } from "./actions";
import { GalleryView } from "./gallery-view";

export const metadata = { title: "Fotogalerie" };

type Props = { searchParams: Promise<{ tab?: string }> };

export default async function GalleryPage({ searchParams }: Props) {
  const { tab } = await searchParams;
  const wedding = await requireWedding();
  const supabase = await createClient();
  const [g, { data: albums }, media, { data: entries }, { count: pending }, level, domain, { data: w }] = await Promise.all([
    galleryById(wedding.id),
    supabase.from("albums").select("id, kind, name, sort").eq("wedding_id", wedding.id).order("sort"),
    loadMedia(null),
    supabase.from("guestbook_entries").select("id, name, message, hidden_at, created_at").eq("wedding_id", wedding.id).order("created_at", { ascending: false }),
    supabase.from("media").select("id", { count: "exact", head: true }).eq("wedding_id", wedding.id).eq("status", "pending"),
    moduleLevel(wedding.id, "gallery"),
    linkDomain(),
    supabase.from("weddings").select("gallery_enabled").eq("id", wedding.id).single(),
  ]);
  const guestUrl = g ? `${siteUrl(wedding.slug, domain)}/fotky/${g.gallery_token}` : "";
  const qrSvg = guestUrl ? await QRCode.toString(guestUrl, { type: "svg", margin: 0, errorCorrectionLevel: "M" }) : "";

  return (
    <GalleryView
      tab={tab === "vzkazy" ? "vzkazy" : tab === "hoste" ? "hoste" : "fotky"}
      canEdit={level === "write"}
      enabled={!!w?.gallery_enabled}
      moderation={g?.gallery_moderation ?? "approve"}
      quota={g?.quota ?? 0}
      used={g?.used ?? 0}
      guestUrl={guestUrl}
      qrSvg={qrSvg}
      couple={`${wedding.partner1_name} & ${wedding.partner2_name}`}
      albums={(albums ?? []).map((a) => ({ id: a.id, kind: a.kind as "guests" | "photographer" | "custom", name: (a.name as { cs?: string }).cs ?? "Album" }))}
      initialMedia={media}
      pending={pending ?? 0}
      entries={(entries ?? []).map((e) => ({ id: e.id, name: e.name, message: e.message, hidden: !!e.hidden_at, createdAt: e.created_at }))}
    />
  );
}
