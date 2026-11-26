"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import "@/components/site/templates/fonts";
import { siteHeading } from "@/components/site/site-shell";
import type { MediaView } from "@/lib/gallery";
import { prepare, uploadAll, type Prepared } from "@/lib/media-prep";
import { guestbookPost, guestFinishUpload, guestPhotos, guestStartUpload, type Entry } from "./actions";

const SANS = "var(--font-geist-sans), system-ui, sans-serif";
const LINE = "var(--site-line)";
const MUTED = "var(--site-muted)";
const ACCENT = "var(--site-accent)";

const COPY = {
  cs: {
    eyebrow: "Fotky a vzkazy",
    intro: "Podělte se s námi o fotky a videa ze svatby. Nemusíte nic instalovat – stačí vybrat soubory z telefonu.",
    name: "Vaše jméno",
    namePh: "Aby novomanželé věděli, od koho fotky jsou",
    add: "Přidat fotky a videa",
    uploading: (d: number, t: number) => `Nahrávám ${d} z ${t}…`,
    thanks: (n: number, mod: boolean) => `Děkujeme! Nahráno ${n} ${n === 1 ? "soubor" : n < 5 ? "soubory" : "souborů"}.${mod ? " Ukážou se tu, jakmile je novomanželé schválí." : ""}`,
    errors: {
      type: "Tento typ souboru nejde nahrát. Použijte fotky (JPG, PNG, HEIC) nebo videa (MP4, MOV).",
      too_long: "Videa můžou mít nejvýš 60 sekund.",
      size: "Soubor je moc velký (fotka do 40 MB, video do 200 MB).",
      quota: "Galerie je plná. Dejte prosím vědět novomanželům.",
      closed: "Nahrávání je teď vypnuté.",
      failed: "Něco se nepovedlo. Zkuste to prosím znovu.",
    },
    closed: "Nahrávání fotek je teď vypnuté.",
    photos: "Fotky",
    empty: "Zatím tu nejsou žádné fotky. Buďte první!",
    more: "Načíst další",
    book: "Kniha přání",
    bookIntro: "Napište novomanželům pár slov.",
    message: "Vzkaz",
    send: "Poslat vzkaz",
    sent: "Děkujeme za vzkaz!",
    bookErrors: { empty: "Vyplňte jméno i vzkaz.", busy: "Teď je tu rušno, zkuste to prosím za pár minut.", duplicate: "Tenhle vzkaz už tu je.", closed: "Kniha přání je zavřená.", failed: "Vzkaz se nepodařilo uložit." },
    download: "Stáhnout originál",
    close: "Zavřít",
    prev: "Předchozí",
    next: "Další",
    by: "od",
  },
  en: {
    eyebrow: "Photos & wishes",
    intro: "Share your photos and videos from the wedding with us. No app needed – just pick files from your phone.",
    name: "Your name",
    namePh: "So the couple knows who the photos are from",
    add: "Add photos and videos",
    uploading: (d: number, t: number) => `Uploading ${d} of ${t}…`,
    thanks: (n: number, mod: boolean) => `Thank you! Uploaded ${n} ${n === 1 ? "file" : "files"}.${mod ? " They'll appear here once the couple approves them." : ""}`,
    errors: {
      type: "This file type can't be uploaded. Use photos (JPG, PNG, HEIC) or videos (MP4, MOV).",
      too_long: "Videos can be at most 60 seconds long.",
      size: "The file is too large (photos up to 40 MB, videos up to 200 MB).",
      quota: "The gallery is full. Please let the couple know.",
      closed: "Uploading is currently disabled.",
      failed: "Something went wrong. Please try again.",
    },
    closed: "Photo uploads are currently disabled.",
    photos: "Photos",
    empty: "No photos yet. Be the first!",
    more: "Load more",
    book: "Guestbook",
    bookIntro: "Leave the couple a few words.",
    message: "Message",
    send: "Send message",
    sent: "Thank you for your message!",
    bookErrors: { empty: "Please fill in your name and message.", busy: "It's busy right now, please try again in a few minutes.", duplicate: "This message is already here.", closed: "The guestbook is closed.", failed: "The message couldn't be saved." },
    download: "Download original",
    close: "Close",
    prev: "Previous",
    next: "Next",
    by: "by",
  },
} as const;

type Locale = keyof typeof COPY;

function useStoredName(): [string, (v: string) => void] {
  const [name, setName] = useState("");
  useEffect(() => {
    try {
      setName(localStorage.getItem("svatby-guest-name") ?? "");
    } catch {
      /* úložiště nedostupné */
    }
  }, []);
  return [
    name,
    (v: string) => {
      setName(v);
      try {
        localStorage.setItem("svatby-guest-name", v);
      } catch {
        /* úložiště nedostupné */
      }
    },
  ];
}

const input = "h-11 w-full rounded-xl bg-transparent px-4 text-[15px] outline-none focus:ring-2";

export function GuestGallery({
  site,
  token,
  locale,
  couple,
  open,
  moderated,
  initialPhotos,
  initialEntries,
}: {
  site: string;
  token: string;
  locale: Locale;
  couple: string;
  open: boolean;
  moderated: boolean;
  initialPhotos: MediaView[];
  initialEntries: Entry[];
}) {
  const c = COPY[locale];
  const [name, setName] = useStoredName();
  const [photos, setPhotos] = useState(initialPhotos);
  const [hasMore, setHasMore] = useState(initialPhotos.length >= 60);
  const [progress, setProgress] = useState<[number, number] | null>(null);
  const [status, setStatus] = useState<{ ok?: string; error?: string } | null>(null);
  const [lightbox, setLightbox] = useState<number | null>(null);
  const [entries, setEntries] = useState(initialEntries);
  const [message, setMessage] = useState("");
  const [bookStatus, setBookStatus] = useState<{ ok?: string; error?: string } | null>(null);
  const [pending, start] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  async function onFiles(list: FileList | null) {
    if (!list?.length) return;
    setStatus(null);
    setProgress([0, list.length]);
    const prepared: Prepared[] = [];
    for (const f of Array.from(list)) {
      const p = await prepare(f);
      if (p === "type" || p === "too_long") {
        setStatus({ error: c.errors[p] });
        continue;
      }
      prepared.push(p);
    }
    if (!prepared.length) {
      setProgress(null);
      return;
    }
    const r = await uploadAll(
      prepared,
      (req) => guestStartUpload(site, token, req),
      (done) => guestFinishUpload(site, token, done, name),
      (d, t) => setProgress([d, t]),
    );
    setProgress(null);
    if (fileRef.current) fileRef.current.value = "";
    if (r.error && !r.uploaded) setStatus({ error: c.errors[r.error as keyof typeof c.errors] ?? c.errors.failed });
    else {
      setStatus({ ok: c.thanks(r.uploaded, moderated) });
      if (!moderated) setPhotos(await guestPhotos(site, token, null));
    }
  }

  const current = lightbox === null ? null : photos[lightbox];
  useEffect(() => {
    if (lightbox === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightbox(null);
      if (e.key === "ArrowRight") setLightbox((i) => (i === null ? i : Math.min(photos.length - 1, i + 1)));
      if (e.key === "ArrowLeft") setLightbox((i) => (i === null ? i : Math.max(0, i - 1)));
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [lightbox, photos.length]);

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-14 px-5 py-14 sm:py-20">
      <header className="flex flex-col items-center gap-3 text-center">
        <p className="text-[12px] uppercase tracking-[0.22em]" style={{ fontFamily: SANS, color: ACCENT }}>
          {c.eyebrow}
        </p>
        <h1 className="text-[clamp(2.4rem,7vw,4.2rem)] leading-[1.05]" style={siteHeading}>
          {couple}
        </h1>
        <p className="max-w-lg text-[1.05rem]" style={{ color: MUTED }}>
          {c.intro}
        </p>
      </header>

      <section className="mx-auto flex w-full max-w-md flex-col gap-4" style={{ fontFamily: SANS }}>
        {open ? (
          <>
            <label className="flex flex-col gap-1.5 text-[14px]">
              <span style={{ color: MUTED }}>{c.name}</span>
              <input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder={c.namePh} className={input} style={{ border: `1px solid ${LINE}` }} />
            </label>
            <input ref={fileRef} type="file" accept="image/*,video/*" multiple hidden onChange={(e) => void onFiles(e.target.files)} />
            <button
              type="button"
              disabled={!!progress}
              onClick={() => fileRef.current?.click()}
              className="h-14 rounded-full text-[16px] font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60"
              style={{ background: ACCENT }}
            >
              {progress ? c.uploading(progress[0], progress[1]) : c.add}
            </button>
            {progress ? (
              <div className="h-1.5 overflow-hidden rounded-full" style={{ background: LINE }}>
                <div className="h-full rounded-full transition-all" style={{ width: `${(progress[0] / Math.max(1, progress[1])) * 100}%`, background: ACCENT }} />
              </div>
            ) : null}
            {status?.ok ? <p className="text-center text-[14px]" style={{ color: ACCENT }}>{status.ok}</p> : null}
            {status?.error ? <p className="text-center text-[14px]" style={{ color: "#b33" }}>{status.error}</p> : null}
          </>
        ) : (
          <p className="text-center text-[14px]" style={{ color: MUTED }}>
            {c.closed}
          </p>
        )}
      </section>

      <section className="flex flex-col gap-6">
        <h2 className="text-center text-[2rem]" style={siteHeading}>
          {c.photos}
        </h2>
        {photos.length ? (
          <ul className="grid grid-cols-3 gap-1.5 sm:grid-cols-4 sm:gap-2 lg:grid-cols-5">
            {photos.map((p, i) => (
              <li key={p.id}>
                <button type="button" onClick={() => setLightbox(i)} className="relative block aspect-square w-full overflow-hidden" aria-label={p.uploader ? `${c.by} ${p.uploader}` : c.photos}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.thumb} alt="" loading="lazy" className="size-full object-cover transition-transform duration-300 hover:scale-105" />
                  {p.kind === "video" ? <span className="absolute right-1.5 bottom-1.5 rounded-full bg-black/55 px-2 py-0.5 text-[11px] text-white">▶</span> : null}
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-center" style={{ color: MUTED }}>
            {c.empty}
          </p>
        )}
        {hasMore ? (
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const more = await guestPhotos(site, token, photos.at(-1)?.createdAt ?? null);
                setPhotos((p) => [...p, ...more]);
                setHasMore(more.length >= 60);
              })
            }
            className="mx-auto h-11 rounded-full px-6 text-[14px]"
            style={{ fontFamily: SANS, border: `1px solid ${LINE}` }}
          >
            {c.more}
          </button>
        ) : null}
      </section>

      <section className="mx-auto flex w-full max-w-2xl flex-col gap-6">
        <div className="text-center">
          <h2 className="text-[2rem]" style={siteHeading}>
            {c.book}
          </h2>
          <p className="mt-1" style={{ color: MUTED }}>
            {c.bookIntro}
          </p>
        </div>
        <form
          className="flex flex-col gap-3"
          style={{ fontFamily: SANS }}
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const r = await guestbookPost(site, token, name, message);
              if (r.entry) {
                setEntries((list) => [r.entry!, ...list]);
                setMessage("");
                setBookStatus({ ok: c.sent });
              } else setBookStatus({ error: c.bookErrors[(r.error ?? "failed") as keyof typeof c.bookErrors] ?? c.bookErrors.failed });
            });
          }}
        >
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} required placeholder={c.name} className={input} style={{ border: `1px solid ${LINE}` }} />
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            maxLength={1000}
            required
            rows={3}
            placeholder={c.message}
            className="w-full rounded-xl bg-transparent px-4 py-3 text-[15px] outline-none focus:ring-2"
            style={{ border: `1px solid ${LINE}` }}
          />
          <button type="submit" disabled={pending} className="h-11 self-start rounded-full px-6 text-[14px] font-medium text-white disabled:opacity-60" style={{ background: ACCENT }}>
            {c.send}
          </button>
          {bookStatus?.ok ? <p className="text-[14px]" style={{ color: ACCENT }}>{bookStatus.ok}</p> : null}
          {bookStatus?.error ? <p className="text-[14px]" style={{ color: "#b33" }}>{bookStatus.error}</p> : null}
        </form>
        <ul className="flex flex-col gap-4">
          {entries.map((e) => (
            <li key={e.id} className="px-5 py-4" style={{ border: `1px solid ${LINE}` }}>
              <p className="whitespace-pre-line text-[1.05rem] leading-relaxed">{e.message}</p>
              <p className="mt-2 text-[13px]" style={{ fontFamily: SANS, color: MUTED }}>
                — {e.name}
              </p>
            </li>
          ))}
        </ul>
      </section>

      {current ? (
        <div className="fixed inset-0 z-50 flex flex-col bg-black/92 text-white" role="dialog" aria-modal="true" style={{ fontFamily: SANS }}>
          <div className="flex items-center gap-4 px-4 py-3 text-[14px]">
            <span className="min-w-0 flex-1 truncate text-white/70">{current.uploader ? `${c.by} ${current.uploader}` : ""}</span>
            {current.original ? (
              <a href={current.original} download className="underline underline-offset-2">
                {c.download}
              </a>
            ) : null}
            <button type="button" onClick={() => setLightbox(null)} className="rounded-full px-3 py-1 ring-1 ring-white/40">
              {c.close}
            </button>
          </div>
          <div className="relative flex min-h-0 flex-1 items-center justify-center px-2 pb-4">
            {current.kind === "video" && current.original ? (
              <video src={current.original} controls autoPlay playsInline className="max-h-full max-w-full" />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={current.preview} alt="" className="max-h-full max-w-full object-contain" />
            )}
            {lightbox! > 0 ? (
              <button type="button" aria-label={c.prev} onClick={() => setLightbox(lightbox! - 1)} className="absolute top-1/2 left-2 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-white/15 text-2xl">
                ‹
              </button>
            ) : null}
            {lightbox! < photos.length - 1 ? (
              <button type="button" aria-label={c.next} onClick={() => setLightbox(lightbox! + 1)} className="absolute top-1/2 right-2 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-white/15 text-2xl">
                ›
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </main>
  );
}
