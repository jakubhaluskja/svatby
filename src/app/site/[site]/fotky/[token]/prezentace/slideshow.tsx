"use client";

import { useEffect, useRef, useState } from "react";
import "@/components/site/templates/fonts";
import { slideshowFeed, type Entry } from "../actions";

type Feed = { photos: { id: string; src: string; kind: "photo" | "video"; uploader: string | null }[]; entries: Entry[] };
type Slide = { type: "photo"; id: string; src: string; uploader: string | null } | { type: "entry"; id: string; name: string; message: string };

const PHOTO_MS = 7000;
const ENTRY_MS = 9000;
const REFRESH_MS = 20000;

/** Pořadí: nové fotky přednostně, každý 4. snímek vzkaz. */
function build(feed: Feed, seen: Set<string>): Slide[] {
  const fresh = feed.photos.filter((p) => !seen.has(p.id));
  const rest = feed.photos.filter((p) => seen.has(p.id));
  const photos: Slide[] = [...fresh, ...rest].map((p) => ({ type: "photo", id: p.id, src: p.src, uploader: p.uploader }));
  const entries: Slide[] = feed.entries.map((e) => ({ type: "entry", id: e.id, name: e.name, message: e.message }));
  const out: Slide[] = [];
  let e = 0;
  photos.forEach((p, i) => {
    out.push(p);
    if ((i + 1) % 3 === 0 && entries.length) out.push(entries[e++ % entries.length]);
  });
  if (!photos.length) out.push(...entries);
  return out;
}

export function Slideshow({
  site,
  token,
  couple,
  qrSvg,
  guestUrl,
  initial,
  displayFont,
  accent,
  locale,
}: {
  site: string;
  token: string;
  couple: string;
  qrSvg: string;
  guestUrl: string;
  initial: Feed;
  displayFont: string;
  accent: string;
  locale: "cs" | "en";
}) {
  const seen = useRef(new Set<string>());
  const [slides, setSlides] = useState<Slide[]>(() => build(initial, seen.current));
  const [index, setIndex] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const slide = slides.length ? slides[index % slides.length] : null;

  // Obnova obsahu (nové fotky a vzkazy).
  useEffect(() => {
    const id = setInterval(async () => {
      const feed = await slideshowFeed(site, token).catch(() => null);
      if (feed) setSlides(build(feed, seen.current));
    }, REFRESH_MS);
    return () => clearInterval(id);
  }, [site, token]);

  // Střídání snímků.
  useEffect(() => {
    if (!slide) return;
    if (slide.type === "photo") seen.current.add(slide.id);
    const id = setTimeout(() => setIndex((i) => i + 1), slide.type === "entry" ? ENTRY_MS : PHOTO_MS);
    return () => clearTimeout(id);
  }, [slide]);

  // Přednačtení dalšího obrázku.
  useEffect(() => {
    const next = slides[(index + 1) % Math.max(1, slides.length)];
    if (next?.type === "photo") {
      const img = new Image();
      img.src = next.src;
    }
  }, [index, slides]);

  useEffect(() => {
    const on = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", on);
    return () => document.removeEventListener("fullscreenchange", on);
  }, []);

  const cta = locale === "en" ? "Share your photos" : "Přidejte své fotky";
  const empty = locale === "en" ? "The first photos will appear here." : "Tady se brzy objeví první fotky.";

  return (
    <div className="fixed inset-0 overflow-hidden bg-black text-white" style={{ fontFamily: "var(--font-geist-sans), system-ui, sans-serif" }}>
      {slide ? (
        <div key={`${slide.id}-${index}`} className="absolute inset-0 animate-[slidefade_1.2s_ease]">
          {slide.type === "photo" ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={slide.src} alt="" className="absolute inset-0 size-full scale-110 object-cover opacity-40 blur-2xl" />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={slide.src} alt="" className="absolute inset-0 size-full object-contain" />
              {slide.uploader ? <p className="absolute bottom-8 left-10 text-[2vh] text-white/80 drop-shadow">📷 {slide.uploader}</p> : null}
            </>
          ) : (
            <div className="flex size-full flex-col items-center justify-center gap-[4vh] px-[12vw] text-center" style={{ background: `radial-gradient(circle at 50% 40%, ${accent}55, #000 70%)` }}>
              <p className="text-[clamp(1.6rem,4.6vh,3.6rem)] leading-snug" style={{ fontFamily: displayFont }}>
                „{slide.message}“
              </p>
              <p className="text-[2.6vh] text-white/75">— {slide.name}</p>
            </div>
          )}
        </div>
      ) : (
        <div className="flex size-full flex-col items-center justify-center gap-4">
          <p className="text-[6vh]" style={{ fontFamily: displayFont }}>
            {couple}
          </p>
          <p className="text-[2.4vh] text-white/70">{empty}</p>
        </div>
      )}

      <div className="absolute right-8 bottom-8 flex items-center gap-4 rounded-2xl bg-black/55 p-4 backdrop-blur">
        <div className="size-[14vh] min-h-24 min-w-24 rounded-lg bg-white p-2" dangerouslySetInnerHTML={{ __html: qrSvg }} />
        <div className="max-w-[22vw]">
          <p className="text-[2.4vh] font-medium">{cta}</p>
          <p className="mt-1 text-[1.6vh] break-all text-white/70">{guestUrl}</p>
        </div>
      </div>

      {!fullscreen ? (
        <button
          type="button"
          onClick={() => void document.documentElement.requestFullscreen?.()}
          className="absolute top-4 right-4 rounded-full bg-white/15 px-4 py-2 text-sm hover:bg-white/25"
        >
          {locale === "en" ? "Full screen" : "Celá obrazovka"}
        </button>
      ) : null}
      <style>{`@keyframes slidefade{from{opacity:0;transform:scale(1.02)}to{opacity:1;transform:none}}`}</style>
    </div>
  );
}
