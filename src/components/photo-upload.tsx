"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { photoUrl } from "@/lib/media";
import { createClient } from "@/lib/supabase/client";

/** Zmenší fotku v prohlížeči (max. 2400 px, JPEG), ať se šetří data hostů i úložiště. */
async function shrink(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 2400 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob"))), "image/jpeg", 0.85));
}

/** Zmenší a nahraje fotku webu, vrátí cestu v úložišti. */
export async function uploadSitePhoto(weddingId: string, file: File): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("type");
  const blob = await shrink(file);
  const path = `${weddingId}/${crypto.randomUUID()}.jpg`;
  const { error } = await createClient().storage.from("site-media").upload(path, blob, { contentType: "image/jpeg", cacheControl: "31536000" });
  if (error) throw error;
  return path;
}

export function PhotoUpload({
  weddingId,
  value,
  onChange,
  label,
}: {
  weddingId: string;
  value: string | null;
  onChange: (path: string | null) => void;
  label: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const url = photoUrl(value);

  async function upload(file: File) {
    setError(null);
    if (!file.type.startsWith("image/")) {
      setError("Vyberte fotku ve formátu JPG, PNG nebo WebP.");
      return;
    }
    setBusy(true);
    try {
      const blob = await shrink(file);
      const path = `${weddingId}/${crypto.randomUUID()}.jpg`;
      const { error: err } = await createClient().storage.from("site-media").upload(path, blob, { contentType: "image/jpeg", cacheControl: "31536000" });
      if (err) throw err;
      onChange(path);
    } catch {
      setError("Fotku se nepodařilo nahrát. Zkuste to znovu.");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium">{label}</span>
      {url ? (
        <div className="relative aspect-[4/3] w-full max-w-sm overflow-hidden rounded-xl border border-line bg-paper">
          <Image src={url} alt="" fill sizes="384px" className="object-cover" />
        </div>
      ) : null}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => input.current?.click()}
          disabled={busy}
          className="h-10 rounded-full border border-line bg-surface px-4 text-sm font-medium hover:border-eucalyptus disabled:opacity-50"
        >
          {busy ? "Nahrávám…" : url ? "Vyměnit fotku" : "Nahrát fotku"}
        </button>
        {url ? (
          <button type="button" onClick={() => onChange(null)} className="text-sm text-ink-soft underline-offset-2 hover:text-danger hover:underline">
            Odebrat
          </button>
        ) : null}
      </div>
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" tabIndex={-1} onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
      {error ? <p className="text-sm text-danger">{error}</p> : null}
    </div>
  );
}
