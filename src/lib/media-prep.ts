"use client";

import { createClient } from "@/lib/supabase/client";

/** Fotka/video připravené k nahrání: originál + zmenšeniny vytvořené v prohlížeči. */
export type Prepared = {
  file: File;
  kind: "photo" | "video";
  contentType: string;
  preview: Blob | null;
  thumb: Blob | null;
  width: number | null;
  height: number | null;
  duration: number | null;
  takenAt: string | null;
  bytes: number;
};

const MAX_VIDEO_SECONDS = 60;

function canvasBlob(source: CanvasImageSource, w: number, h: number, max: number): Promise<Blob | null> {
  const scale = Math.min(1, max / Math.max(w, h));
  const cw = Math.max(1, Math.round(w * scale));
  const ch = Math.max(1, Math.round(h * scale));
  const canvas = document.createElement("canvas");
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext("2d");
  if (!ctx) return Promise.resolve(null);
  ctx.drawImage(source, 0, 0, cw, ch);
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), "image/jpeg", 0.82));
}

async function prepPhoto(file: File): Promise<Omit<Prepared, "file" | "kind" | "contentType" | "bytes">> {
  try {
    const bmp = await createImageBitmap(file, { imageOrientation: "from-image" } as ImageBitmapOptions);
    const [preview, thumb] = await Promise.all([canvasBlob(bmp, bmp.width, bmp.height, 1920), canvasBlob(bmp, bmp.width, bmp.height, 480)]);
    const res = { preview, thumb, width: bmp.width, height: bmp.height, duration: null, takenAt: file.lastModified ? new Date(file.lastModified).toISOString() : null };
    bmp.close();
    return res;
  } catch {
    // Formát, který prohlížeč neumí vykreslit (např. HEIC v Chromu) – nahraje se jen originál.
    return { preview: null, thumb: null, width: null, height: null, duration: null, takenAt: null };
  }
}

function prepVideo(file: File): Promise<Omit<Prepared, "file" | "kind" | "contentType" | "bytes"> | "too_long"> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement("video");
    v.preload = "metadata";
    v.muted = true;
    v.playsInline = true;
    v.src = url;
    const done = (r: Omit<Prepared, "file" | "kind" | "contentType" | "bytes"> | "too_long") => {
      URL.revokeObjectURL(url);
      resolve(r);
    };
    v.onloadedmetadata = () => {
      if (v.duration > MAX_VIDEO_SECONDS + 0.5) return done("too_long");
      v.currentTime = Math.min(0.5, v.duration / 2);
    };
    v.onseeked = async () => {
      const thumb = await canvasBlob(v, v.videoWidth, v.videoHeight, 480);
      done({ preview: thumb, thumb, width: v.videoWidth || null, height: v.videoHeight || null, duration: v.duration || null, takenAt: null });
    };
    v.onerror = () => done({ preview: null, thumb: null, width: null, height: null, duration: null, takenAt: null });
  });
}

const TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif", "video/mp4", "video/quicktime", "video/webm"];

export async function prepare(file: File): Promise<Prepared | "type" | "too_long"> {
  const contentType = file.type || (/\.heic$/i.test(file.name) ? "image/heic" : "");
  if (!TYPES.includes(contentType)) return "type";
  if (contentType.startsWith("video/")) {
    const r = await prepVideo(file);
    if (r === "too_long") return "too_long";
    return { file, kind: "video", contentType, bytes: file.size + (r.thumb?.size ?? 0) * 2, ...r };
  }
  const r = await prepPhoto(file);
  return { file, kind: "photo", contentType, bytes: file.size + (r.preview?.size ?? 0) + (r.thumb?.size ?? 0), ...r };
}

type Signed = { path: string; token: string };
export type Ticket = { id: string; original: Signed; preview?: Signed; thumb?: Signed };

/** Nahraje originál a zmenšeniny na podepsané adresy. */
export async function uploadPrepared(p: Prepared, t: Ticket): Promise<boolean> {
  const storage = createClient().storage.from("gallery");
  const put = async (s: Signed | undefined, body: Blob | null, type: string) => {
    if (!s || !body) return true;
    const { error } = await storage.uploadToSignedUrl(s.path, s.token, body, { contentType: type, upsert: false });
    return !error;
  };
  const ok = await put(t.original, p.file, p.contentType);
  if (!ok) return false;
  await Promise.all([put(t.preview, p.kind === "photo" ? p.preview : null, "image/jpeg"), put(t.thumb, p.thumb, "image/jpeg")]);
  return true;
}

/** Nahraje dávku souborů s omezeným souběhem; volá onProgress(hotovo, celkem). */
export async function uploadAll(
  items: Prepared[],
  start: (req: { contentType: string; bytes: number; preview: boolean; thumb: boolean }[]) => Promise<{ tickets?: Ticket[]; error?: string }>,
  finish: (done: { id: string; kind: "photo" | "video"; contentType: string; width: number | null; height: number | null; duration: number | null; takenAt: string | null }[]) => Promise<{ count?: number; error?: string }>,
  onProgress: (done: number, total: number) => void,
): Promise<{ uploaded: number; error?: string }> {
  let uploaded = 0;
  for (let i = 0; i < items.length; i += 10) {
    const batch = items.slice(i, i + 10);
    const r = await start(batch.map((p) => ({ contentType: p.contentType, bytes: p.bytes, preview: p.kind === "photo" && !!p.preview, thumb: !!p.thumb })));
    if (r.error || !r.tickets) return { uploaded, error: r.error ?? "failed" };
    const done: Parameters<typeof finish>[0] = [];
    let next = 0;
    const worker = async () => {
      while (next < batch.length) {
        const k = next++;
        const p = batch[k];
        if (await uploadPrepared(p, r.tickets![k])) {
          done.push({ id: r.tickets![k].id, kind: p.kind, contentType: p.contentType, width: p.width, height: p.height, duration: p.duration, takenAt: p.takenAt });
        }
        onProgress(i + k + 1, items.length);
      }
    };
    await Promise.all([worker(), worker(), worker()]);
    const f = await finish(done);
    if (f.error) return { uploaded, error: f.error };
    uploaded += f.count ?? 0;
  }
  return { uploaded };
}
