import "server-only";
import { cache } from "react";
import { isCustomDomainParam } from "@/lib/site";
import { createAdminClient } from "@/lib/supabase/admin";

export const GALLERY_BUCKET = "gallery";
/** Bez placení (před spuštěním plateb) dostane každá svatba tolik místa. */
export const FREE_QUOTA_BYTES = 10 * 1024 ** 3;
export const MAX_PHOTO_BYTES = 40 * 1024 ** 2;
export const MAX_VIDEO_BYTES = 200 * 1024 ** 2;

export type GalleryWedding = {
  id: string;
  slug: string;
  partner1_name: string;
  partner2_name: string;
  default_locale: "cs" | "en";
  template: string;
  gallery_token: string;
  gallery_moderation: "approve" | "publish";
  quota: number;
  used: number;
  /** Nahrávat lze (zapnuto, v kvótě, neprošlá platnost, nepozastaveno). */
  open: boolean;
};

const FIELDS =
  "id, slug, partner1_name, partner2_name, default_locale, template, status, suspended_at, gallery_enabled, gallery_token, gallery_moderation, gallery_quota_bytes, gallery_used_bytes, gallery_expires_at";

type Row = {
  id: string;
  slug: string;
  partner1_name: string;
  partner2_name: string;
  default_locale: "cs" | "en";
  template: string;
  status: string;
  suspended_at: string | null;
  gallery_enabled: boolean;
  gallery_token: string;
  gallery_moderation: "approve" | "publish";
  gallery_quota_bytes: number;
  gallery_used_bytes: number;
  gallery_expires_at: string | null;
};

async function paymentsEnabled(): Promise<boolean> {
  const { data } = await createAdminClient().rpc("payments_enabled");
  return !!data;
}

export async function toGallery(w: Row): Promise<GalleryWedding> {
  const quotaRaw = Number(w.gallery_quota_bytes);
  const quota = quotaRaw > 0 ? quotaRaw : (await paymentsEnabled()) ? 0 : FREE_QUOTA_BYTES;
  const used = Number(w.gallery_used_bytes);
  const expired = !!w.gallery_expires_at && Date.parse(w.gallery_expires_at) < Date.now();
  return {
    id: w.id,
    slug: w.slug,
    partner1_name: w.partner1_name,
    partner2_name: w.partner2_name,
    default_locale: w.default_locale,
    template: w.template,
    gallery_token: w.gallery_token,
    gallery_moderation: w.gallery_moderation,
    quota,
    used,
    open: w.gallery_enabled && !w.suspended_at && !expired && quota > used,
  };
}

/** Svatba podle webu a tokenu galerie (QR pro hosty). Nevyžaduje zveřejněný web. */
export const galleryByToken = cache(async (siteParam: string, token: string): Promise<GalleryWedding | null> => {
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(token)) return null;
  const site = decodeURIComponent(siteParam).toLowerCase();
  const db = createAdminClient();
  let query = db.from("weddings").select(FIELDS).eq("gallery_token", token);
  if (isCustomDomainParam(site)) {
    const { data } = await db.from("custom_domains").select("wedding_id").eq("hostname", site).eq("status", "verified").maybeSingle();
    if (!data) return null;
    query = query.eq("id", data.wedding_id);
  } else {
    query = query.eq("slug", site);
  }
  const { data: w } = await query.maybeSingle();
  if (!w || w.status === "deleted" || w.suspended_at || !w.gallery_enabled) return null;
  return toGallery(w as Row);
});

export async function galleryById(weddingId: string): Promise<GalleryWedding | null> {
  const { data: w } = await createAdminClient().from("weddings").select(FIELDS).eq("id", weddingId).maybeSingle();
  return w ? toGallery(w as Row) : null;
}

export type MediaRow = {
  id: string;
  album_id: string;
  kind: "photo" | "video";
  storage_key: string;
  thumb_key: string | null;
  preview_key: string | null;
  content_type: string;
  bytes: number;
  width: number | null;
  height: number | null;
  status: string;
  uploader_name: string | null;
  created_at: string;
};

export type MediaView = {
  id: string;
  albumId: string;
  kind: "photo" | "video";
  thumb: string;
  preview: string;
  original: string | null;
  width: number | null;
  height: number | null;
  status: string;
  uploader: string | null;
  createdAt: string;
};

/** Podepsané odkazy (platí hodinu) na náhledy a případně originály. */
export async function signMedia(rows: MediaRow[], withOriginal = false): Promise<MediaView[]> {
  if (!rows.length) return [];
  const keys = new Set<string>();
  for (const r of rows) {
    keys.add(r.thumb_key ?? r.preview_key ?? r.storage_key);
    keys.add(r.preview_key ?? r.storage_key);
    if (withOriginal || r.kind === "video") keys.add(r.storage_key);
  }
  const storage = createAdminClient().storage.from(GALLERY_BUCKET);
  const list = [...keys];
  const signed = new Map<string, string>();
  for (let i = 0; i < list.length; i += 500) {
    const { data } = await storage.createSignedUrls(list.slice(i, i + 500), 3600);
    for (const s of data ?? []) if (s.path && s.signedUrl) signed.set(s.path, s.signedUrl);
  }
  return rows.map((r) => ({
    id: r.id,
    albumId: r.album_id,
    kind: r.kind,
    thumb: signed.get(r.thumb_key ?? r.preview_key ?? r.storage_key) ?? "",
    preview: signed.get(r.preview_key ?? r.storage_key) ?? "",
    original: withOriginal || r.kind === "video" ? (signed.get(r.storage_key) ?? null) : null,
    width: r.width,
    height: r.height,
    status: r.status,
    uploader: r.uploader_name,
    createdAt: r.created_at,
  }));
}

export const MEDIA_FIELDS = "id, album_id, kind, storage_key, thumb_key, preview_key, content_type, bytes, width, height, status, uploader_name, created_at";

const EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heif",
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "video/webm": "webm",
};

export type UploadRequest = { contentType: string; bytes: number; preview: boolean; thumb: boolean };
export type UploadTicket = { id: string; original: { path: string; token: string }; preview?: { path: string; token: string }; thumb?: { path: string; token: string } };

/** Připraví podepsané adresy pro nahrání (prohlížeč nahrává rovnou do úložiště). */
export async function createTickets(g: GalleryWedding, files: UploadRequest[]): Promise<{ tickets?: UploadTicket[]; error?: "type" | "size" | "quota" | "closed" }> {
  if (!g.open) return { error: g.quota <= g.used ? "quota" : "closed" };
  let total = 0;
  for (const f of files) {
    if (!EXT[f.contentType]) return { error: "type" };
    const limit = f.contentType.startsWith("video/") ? MAX_VIDEO_BYTES : MAX_PHOTO_BYTES;
    if (!(f.bytes > 0) || f.bytes > limit) return { error: "size" };
    total += f.bytes;
  }
  if (g.used + total > g.quota) return { error: "quota" };

  const storage = createAdminClient().storage.from(GALLERY_BUCKET);
  const tickets: UploadTicket[] = [];
  for (const f of files) {
    const id = crypto.randomUUID();
    const base = `${g.id}/${id}`;
    const sign = async (name: string) => {
      const path = `${base}/${name}`;
      const { data, error } = await storage.createSignedUploadUrl(path);
      if (error || !data) throw new Error(error?.message ?? "sign");
      return { path, token: data.token };
    };
    tickets.push({
      id,
      original: await sign(`original.${EXT[f.contentType]}`),
      ...(f.preview ? { preview: await sign("preview.jpg") } : {}),
      ...(f.thumb ? { thumb: await sign("thumb.jpg") } : {}),
    });
  }
  return { tickets };
}

export type UploadDone = {
  id: string;
  kind: "photo" | "video";
  contentType: string;
  width: number | null;
  height: number | null;
  duration: number | null;
  takenAt: string | null;
};

/** Zapíše nahrané soubory; velikost bere z úložiště, ne od klienta. */
export async function registerUploads(
  g: GalleryWedding,
  items: UploadDone[],
  opts: { albumId: string; status: "pending" | "approved"; uploaderName: string | null; householdId: string | null },
): Promise<number> {
  const db = createAdminClient();
  const storage = db.storage.from(GALLERY_BUCKET);
  const rows = [];
  for (const it of items) {
    if (!/^[0-9a-f-]{36}$/.test(it.id)) continue;
    const { data: files } = await storage.list(`${g.id}/${it.id}`);
    const original = files?.find((f) => f.name.startsWith("original."));
    if (!original) continue;
    const size = (n: string) => Number((files?.find((f) => f.name === n)?.metadata as { size?: number } | undefined)?.size ?? 0);
    const bytes = (files ?? []).reduce((a, f) => a + Number((f.metadata as { size?: number } | undefined)?.size ?? 0), 0);
    rows.push({
      id: it.id,
      wedding_id: g.id,
      album_id: opts.albumId,
      uploader_household_id: opts.householdId,
      uploader_name: opts.uploaderName,
      kind: it.kind,
      storage_key: `${g.id}/${it.id}/${original.name}`,
      preview_key: size("preview.jpg") ? `${g.id}/${it.id}/preview.jpg` : null,
      thumb_key: size("thumb.jpg") ? `${g.id}/${it.id}/thumb.jpg` : null,
      content_type: it.contentType,
      bytes,
      width: it.width,
      height: it.height,
      duration_s: it.duration === null ? null : Math.min(60, Math.round(it.duration * 100) / 100),
      taken_at: it.takenAt,
      status: opts.status,
    });
  }
  if (!rows.length) return 0;
  const { error } = await db.from("media").insert(rows);
  if (error) {
    console.error("media insert", error);
    return 0;
  }
  return rows.length;
}

/** Smaže soubory fotek z úložiště. */
export async function removeMediaFiles(weddingId: string, ids: string[]) {
  const storage = createAdminClient().storage.from(GALLERY_BUCKET);
  for (const id of ids) {
    const { data } = await storage.list(`${weddingId}/${id}`);
    if (data?.length) await storage.remove(data.map((f) => `${weddingId}/${id}/${f.name}`));
  }
}

export function formatBytes(n: number): string {
  if (n >= 1024 ** 3) return `${(n / 1024 ** 3).toFixed(1).replace(".", ",")} GB`;
  if (n >= 1024 ** 2) return `${Math.round(n / 1024 ** 2)} MB`;
  return `${Math.max(1, Math.round(n / 1024))} kB`;
}
