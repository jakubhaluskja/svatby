"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { GALLERY_BUCKET, MEDIA_FIELDS, createTickets, galleryById, registerUploads, removeMediaFiles, signMedia, type MediaRow, type MediaView, type UploadTicket } from "@/lib/gallery";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { moduleLevel, requireUser, requireWedding } from "@/lib/wedding";

export type Result = { ok?: boolean; error?: string };
const uuid = z.string().uuid();
const ids = z.array(uuid).min(1).max(500);

async function writer() {
  const wedding = await requireWedding();
  if (wedding.suspended_at) return { wedding, error: "Služba je pozastavená." };
  if ((await moduleLevel(wedding.id, "gallery")) !== "write") return { wedding, error: "K galerii nemáte oprávnění." };
  return { wedding, error: null };
}

function done(): Result {
  revalidatePath("/app/galerie");
  return { ok: true };
}

export async function setGalleryEnabled(enabled: boolean): Promise<Result> {
  const { wedding, error } = await writer();
  if (error) return { error };
  const supabase = await createClient();
  const { error: e } = await supabase.from("weddings").update({ gallery_enabled: enabled }).eq("id", wedding.id);
  return e ? { error: "Nastavení se nepodařilo uložit." } : done();
}

export async function setModeration(mode: "approve" | "publish"): Promise<Result> {
  const { wedding, error } = await writer();
  if (error) return { error };
  const supabase = await createClient();
  const { error: e } = await supabase.from("weddings").update({ gallery_moderation: z.enum(["approve", "publish"]).parse(mode) }).eq("id", wedding.id);
  return e ? { error: "Nastavení se nepodařilo uložit." } : done();
}

/** Nový odkaz a QR pro hosty (starý přestane fungovat). */
export async function regenerateGalleryLink(): Promise<Result> {
  const { wedding, error } = await writer();
  if (error) return { error };
  const supabase = await createClient();
  const { error: e } = await supabase.from("weddings").update({ gallery_token: randomBytes(18).toString("base64url") }).eq("id", wedding.id);
  return e ? { error: "Odkaz se nepodařilo změnit." } : done();
}

const fileReq = z.array(z.object({ contentType: z.string().max(40), bytes: z.number().int().positive(), preview: z.boolean(), thumb: z.boolean() })).min(1).max(10);
const doneReq = z
  .array(
    z.object({
      id: uuid,
      kind: z.enum(["photo", "video"]),
      contentType: z.string().max(40),
      width: z.number().int().nullable(),
      height: z.number().int().nullable(),
      duration: z.number().nullable(),
      takenAt: z.string().max(40).nullable(),
    }),
  )
  .max(10);

const ERR: Record<string, string> = {
  type: "Tento typ souboru nejde nahrát.",
  size: "Soubor je moc velký (fotka do 40 MB, video do 200 MB).",
  quota: "V galerii došlo místo.",
  closed: "Galerie je vypnutá nebo jí vypršela platnost.",
};

export async function startUpload(files: unknown): Promise<{ tickets?: UploadTicket[]; error?: string }> {
  const { wedding, error } = await writer();
  if (error) return { error };
  const parsed = fileReq.safeParse(files);
  if (!parsed.success) return { error: ERR.type };
  const g = await galleryById(wedding.id);
  if (!g) return { error: "Galerie nenalezena." };
  // Pár nahrává i do vypnuté galerie (třeba fotky od fotografa před zveřejněním).
  const r = await createTickets({ ...g, open: g.quota > g.used }, parsed.data).catch(() => ({ error: "failed" as const }));
  return "error" in r && r.error ? { error: ERR[r.error] ?? "Nahrání se nepodařilo." } : r;
}

export async function finishUpload(items: unknown, albumId: string): Promise<{ count?: number; error?: string }> {
  const { wedding, error } = await writer();
  if (error) return { error };
  const parsed = doneReq.safeParse(items);
  if (!parsed.success) return { error: "Neplatný požadavek." };
  const supabase = await createClient();
  const { data: album } = await supabase.from("albums").select("id").eq("id", uuid.parse(albumId)).eq("wedding_id", wedding.id).maybeSingle();
  if (!album) return { error: "Album nenalezeno." };
  const g = await galleryById(wedding.id);
  if (!g) return { error: "Galerie nenalezena." };
  const user = await requireUser();
  const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle();
  const count = await registerUploads(g, parsed.data, { albumId: album.id, status: "approved", uploaderName: profile?.full_name ?? null, householdId: null });
  revalidatePath("/app/galerie");
  return { count };
}

export async function setMediaStatus(list: string[], status: "approved" | "hidden"): Promise<Result> {
  const { wedding, error } = await writer();
  if (error) return { error };
  const supabase = await createClient();
  const { error: e } = await supabase.from("media").update({ status: z.enum(["approved", "hidden"]).parse(status) }).in("id", ids.parse(list)).eq("wedding_id", wedding.id);
  return e ? { error: "Nepodařilo se uložit." } : done();
}

export async function moveMedia(list: string[], albumId: string): Promise<Result> {
  const { wedding, error } = await writer();
  if (error) return { error };
  const supabase = await createClient();
  const { error: e } = await supabase.from("media").update({ album_id: uuid.parse(albumId) }).in("id", ids.parse(list)).eq("wedding_id", wedding.id);
  return e ? { error: "Nepodařilo se přesunout." } : done();
}

export async function deleteMedia(list: string[]): Promise<Result> {
  const { wedding, error } = await writer();
  if (error) return { error };
  const supabase = await createClient();
  const { data, error: e } = await supabase.from("media").delete().in("id", ids.parse(list)).eq("wedding_id", wedding.id).select("id");
  if (e) return { error: "Nepodařilo se smazat." };
  await removeMediaFiles(wedding.id, (data ?? []).map((m) => m.id));
  return done();
}

const albumName = z.string().trim().min(1, "Zadejte název alba.").max(60);

export async function createAlbum(name: string): Promise<Result & { id?: string }> {
  const { wedding, error } = await writer();
  if (error) return { error };
  const parsed = albumName.safeParse(name);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const supabase = await createClient();
  const { data, error: e } = await supabase.from("albums").insert({ wedding_id: wedding.id, kind: "custom", name: { cs: parsed.data, en: parsed.data }, sort: 10 }).select("id").single();
  if (e || !data) return { error: "Album se nepodařilo vytvořit." };
  revalidatePath("/app/galerie");
  return { ok: true, id: data.id };
}

export async function deleteAlbum(id: string): Promise<Result> {
  const { wedding, error } = await writer();
  if (error) return { error };
  const supabase = await createClient();
  const { count } = await supabase.from("media").select("id", { count: "exact", head: true }).eq("album_id", uuid.parse(id));
  if (count) return { error: "Album není prázdné – fotky nejdřív přesuňte nebo smažte." };
  const { error: e } = await supabase.from("albums").delete().eq("id", id).eq("wedding_id", wedding.id).eq("kind", "custom");
  return e ? { error: "Album se nepodařilo smazat." } : done();
}

export async function setEntryHidden(id: string, hidden: boolean): Promise<Result> {
  const { wedding, error } = await writer();
  if (error) return { error };
  const supabase = await createClient();
  const { error: e } = await supabase.from("guestbook_entries").update({ hidden_at: hidden ? new Date().toISOString() : null }).eq("id", uuid.parse(id)).eq("wedding_id", wedding.id);
  return e ? { error: "Nepodařilo se uložit." } : done();
}

export async function deleteEntry(id: string): Promise<Result> {
  const { wedding, error } = await writer();
  if (error) return { error };
  const supabase = await createClient();
  const { error: e } = await supabase.from("guestbook_entries").delete().eq("id", uuid.parse(id)).eq("wedding_id", wedding.id);
  return e ? { error: "Nepodařilo se smazat." } : done();
}

/** Další stránka fotek v aplikaci. */
export async function loadMedia(before: string | null): Promise<MediaView[]> {
  const wedding = await requireWedding();
  const supabase = await createClient();
  let q = supabase.from("media").select(MEDIA_FIELDS).eq("wedding_id", wedding.id).neq("status", "uploading").order("created_at", { ascending: false }).limit(120);
  if (before) q = q.lt("created_at", before);
  const { data } = await q;
  return signMedia((data ?? []) as MediaRow[], true);
}

/** Odkazy ke stažení originálů (platí hodinu). */
export async function downloadLinks(list: string[]): Promise<{ name: string; url: string }[]> {
  const wedding = await requireWedding();
  const supabase = await createClient();
  const { data } = await supabase.from("media").select("id, storage_key, created_at").in("id", ids.parse(list)).eq("wedding_id", wedding.id);
  const storage = createAdminClient().storage.from(GALLERY_BUCKET);
  const out: { name: string; url: string }[] = [];
  for (const m of data ?? []) {
    const name = `svatba-${m.created_at.slice(0, 10)}-${m.id.slice(0, 8)}.${m.storage_key.split(".").pop()}`;
    const { data: s } = await storage.createSignedUrl(m.storage_key, 3600, { download: name });
    if (s?.signedUrl) out.push({ name, url: s.signedUrl });
  }
  return out;
}
