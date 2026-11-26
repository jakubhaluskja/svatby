"use server";

import { z } from "zod";
import { MEDIA_FIELDS, createTickets, galleryByToken, registerUploads, signMedia, type MediaRow, type MediaView, type UploadTicket } from "@/lib/gallery";
import { createAdminClient } from "@/lib/supabase/admin";

const fileReq = z.array(z.object({ contentType: z.string().max(40), bytes: z.number().int().positive(), preview: z.boolean(), thumb: z.boolean() })).min(1).max(10);
const doneReq = z
  .array(
    z.object({
      id: z.string().uuid(),
      kind: z.enum(["photo", "video"]),
      contentType: z.string().max(40),
      width: z.number().int().nullable(),
      height: z.number().int().nullable(),
      duration: z.number().nullable(),
      takenAt: z.string().max(40).nullable(),
    }),
  )
  .max(10);

export async function guestStartUpload(site: string, token: string, files: unknown): Promise<{ tickets?: UploadTicket[]; error?: string }> {
  const g = await galleryByToken(site, token);
  if (!g) return { error: "closed" };
  const parsed = fileReq.safeParse(files);
  if (!parsed.success) return { error: "type" };
  try {
    return await createTickets(g, parsed.data);
  } catch {
    return { error: "failed" };
  }
}

export async function guestFinishUpload(site: string, token: string, items: unknown, name: string): Promise<{ count?: number; error?: string }> {
  const g = await galleryByToken(site, token);
  if (!g) return { error: "closed" };
  const parsed = doneReq.safeParse(items);
  if (!parsed.success) return { error: "failed" };
  const db = createAdminClient();
  const { data: album } = await db.from("albums").select("id").eq("wedding_id", g.id).eq("kind", "guests").maybeSingle();
  if (!album) return { error: "failed" };
  const count = await registerUploads(g, parsed.data, {
    albumId: album.id,
    status: g.gallery_moderation === "publish" ? "approved" : "pending",
    uploaderName: name.trim().slice(0, 80) || null,
    householdId: null,
  });
  return { count };
}

/** Schválené fotky (nejnovější první), stránkování podle času. */
export async function guestPhotos(site: string, token: string, before: string | null): Promise<MediaView[]> {
  const g = await galleryByToken(site, token);
  if (!g) return [];
  let q = createAdminClient().from("media").select(MEDIA_FIELDS).eq("wedding_id", g.id).eq("status", "approved").order("created_at", { ascending: false }).limit(60);
  if (before) q = q.lt("created_at", before);
  const { data } = await q;
  return signMedia((data ?? []) as MediaRow[], true);
}

export type Entry = { id: string; name: string; message: string; createdAt: string };

export async function guestbookPost(site: string, token: string, name: string, message: string): Promise<{ entry?: Entry; error?: string }> {
  const g = await galleryByToken(site, token);
  if (!g) return { error: "closed" };
  const n = name.trim().slice(0, 80);
  const m = message.trim().slice(0, 1000);
  if (!n || !m) return { error: "empty" };
  const db = createAdminClient();
  // Ochrana proti zahlcení: nejvýš 30 vzkazů za 10 minut na svatbu, žádné duplicity.
  const since = new Date(Date.now() - 10 * 60_000).toISOString();
  const { count } = await db.from("guestbook_entries").select("id", { count: "exact", head: true }).eq("wedding_id", g.id).gte("created_at", since);
  if ((count ?? 0) >= 30) return { error: "busy" };
  const { data: dup } = await db.from("guestbook_entries").select("id").eq("wedding_id", g.id).eq("name", n).eq("message", m).limit(1).maybeSingle();
  if (dup) return { error: "duplicate" };
  const { data, error } = await db.from("guestbook_entries").insert({ wedding_id: g.id, name: n, message: m }).select("id, name, message, created_at").single();
  if (error || !data) return { error: "failed" };
  return { entry: { id: data.id, name: data.name, message: data.message, createdAt: data.created_at } };
}

/** Data pro živou prezentaci: nejnovější schválené fotky a vzkazy. */
export async function slideshowFeed(site: string, token: string): Promise<{ photos: { id: string; src: string; kind: "photo" | "video"; uploader: string | null }[]; entries: Entry[] } | null> {
  const g = await galleryByToken(site, token);
  if (!g) return null;
  const db = createAdminClient();
  const [{ data: media }, { data: entries }] = await Promise.all([
    db.from("media").select(MEDIA_FIELDS).eq("wedding_id", g.id).eq("status", "approved").eq("kind", "photo").order("created_at", { ascending: false }).limit(150),
    db.from("guestbook_entries").select("id, name, message, created_at").eq("wedding_id", g.id).is("hidden_at", null).order("created_at", { ascending: false }).limit(60),
  ]);
  const signed = await signMedia((media ?? []) as MediaRow[]);
  return {
    photos: signed.map((m) => ({ id: m.id, src: m.preview, kind: m.kind, uploader: m.uploader })),
    entries: (entries ?? []).map((e) => ({ id: e.id, name: e.name, message: e.message, createdAt: e.created_at })),
  };
}
