"use client";

import type { CSSProperties, ReactNode } from "react";
import { FONTS } from "@/lib/templates";
import type { Section } from "@/lib/site-sections";
import { LineText, RichText, Sec, SitePhoto, useEdit } from "../edit";
import type { SiteModel } from "../model";
import { ContactList, EventsHint, FaqList, GiftAccount, RsvpSlot, Title, address, fmtDate, grain, mapUrl, place, textOf, useSections, when } from "./shared";

const red = "#b01e2d";
const blue = "#1e3a6d";
const green = "#3d6a3c";
const ochre = "#d49a2f";
const linen = "#f8f3ea";
const COLORS: Record<string, string> = { r: red, b: blue, g: green, o: ochre, w: "#fff" };
const gloock: CSSProperties = { fontFamily: FONTS.gloock, fontWeight: 400 };

/** Křížkový steh z mřížky znaků (r, b, g, o, w = barva, . = prázdno). */
function Stitch({ rows, cell = 8, className = "", style }: { rows: string[]; cell?: number; className?: string; style?: CSSProperties }) {
  const w = rows[0].length;
  return (
    <svg viewBox={`0 0 ${w * cell} ${rows.length * cell}`} className={className} style={{ width: w * cell, maxWidth: "100%", height: "auto", ...style }} aria-hidden>
      {rows.flatMap((row, y) =>
        [...row].map((ch, x) =>
          COLORS[ch] ? (
            <g key={`${x}-${y}`} stroke={COLORS[ch]} strokeWidth={cell * 0.22} strokeLinecap="round">
              <line x1={x * cell + cell * 0.18} y1={y * cell + cell * 0.18} x2={x * cell + cell * 0.82} y2={y * cell + cell * 0.82} />
              <line x1={x * cell + cell * 0.82} y1={y * cell + cell * 0.18} x2={x * cell + cell * 0.18} y2={y * cell + cell * 0.82} />
            </g>
          ) : null,
        ),
      )}
    </svg>
  );
}

const TULIP = ["....r.....r....", "...rr..r..rr...", "...rrr.r.rrr...", "...rrrrrrrrr...", "...rrrrorrrr...", "....rrrorrr....", ".....rrorr.....", ".......g.......", "..gg...g...gg..", ".gggg..g..gggg.", "..gggg.g.gggg..", "....ggggggg....", ".......g.......", ".......g......."];
const HEART = ["..rrr...rrr..", ".rrrrr.rrrrr.", "rrrooorrrooor", "rrrorrrrrrorr", "rrrrrrrrrrrrr", ".rrrrrrrrrrr.", "..rrrrbrrrr..", "...rrrbrrr...", "....rrrrr....", ".....rrr.....", "......r......"];
const BELL = ["......b......", ".....bbb.....", "....bbobb....", "...bbooobb...", "..bbbobobbb..", "..bbbbbbbbb..", ".bbbbbbbbbbb.", ".b.r.r.r.r.b.", "...g.....g...", "..ggg...ggg..", "...g.....g..."];
const STAR = ["....o....", "...ooo...", "o.oo.oo.o", ".oo.r.oo.", "oo.rrr.oo", ".oo.r.oo.", "o.oo.oo.o", "...ooo...", "....o...."];
const MOTIFS = [TULIP, HEART, BELL, STAR];

function Band({ cell = 7, color = "b" }: { cell?: number; color?: "b" | "w" }) {
  const unit = ["....b.......b...", "...bbb.....bbb..", "..bbrbb...bbrbb.", ".bbrrrbb.bbrrrbb", "..bbrbb...bbrbb.", "...bbb.....bbb..", "....b.......b...", "rr..rr..rr..rr.."].map((r) => (color === "w" ? r.replace(/b/g, "w") : r));
  const rows = unit.map((r) => r.repeat(14));
  return (
    <div className="flex justify-center overflow-hidden" aria-hidden>
      <Stitch rows={rows} cell={cell} style={{ maxWidth: "none", width: rows[0].length * cell }} />
    </div>
  );
}

const WORDS = {
  cs: { tagline: "Zveme vás na svatbu", at: "obřad v", hour: "" },
  en: { tagline: "You are invited to our wedding", at: "ceremony at", hour: "" },
};

export function FolklorSite({ model }: { model: SiteModel }) {
  const { locale, update } = useEdit();
  const sections = useSections(model);
  const w = WORDS[locale];
  const first = model.events[0];
  const t0 = first ? when(first, locale, model.timeZone) : null;
  const titleClass = "text-[clamp(48px,8cqw,80px)] leading-none";

  const render = (s: Section): ReactNode => {
    switch (s.type) {
      case "hero":
        return (
          <Sec key="hero" s={s} className="relative pb-16 pt-8 @3xl:pb-20">
            <Band />
            <div className="mx-auto mt-12 flex max-w-[1100px] items-center justify-center gap-6 px-5 @3xl:mt-16 @3xl:justify-between @3xl:px-10">
              <Stitch rows={TULIP} cell={14} className="hidden @3xl:block" />
              <div className="text-center">
                <LineText type="hero" field="tagline" value={s.content.tagline} fallback={w.tagline} as="p" className="text-[22px] italic @3xl:text-[26px]" style={{ color: blue }} />
                <h1 className="mt-4" style={{ ...gloock, color: red }}>
                  <span className="block text-[clamp(76px,15cqw,150px)] leading-[0.85]">{model.partner1}</span>
                  <span className="my-3 flex justify-center">
                    <Stitch rows={HEART} cell={9} />
                  </span>
                  <span className="block text-[clamp(76px,15cqw,150px)] leading-[0.85]">{model.partner2}</span>
                </h1>
                {model.date ? <p className="mt-8 text-[26px] @3xl:text-[30px]">{fmtDate(model.date, locale, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</p> : null}
                {first ? (
                  <p className="text-[19px] italic opacity-75 @3xl:text-[22px]">
                    {[place(first), t0?.time ? `${w.at} ${t0.time}` : null].filter(Boolean).join(", ")}
                  </p>
                ) : null}
                <RichText type="hero" field="intro" value={s.content.intro} className="mx-auto mt-6 max-w-[40ch] text-[19px] leading-relaxed @3xl:text-[21px]" placeholder="Pár slov pro hosty (nepovinné)" />
              </div>
              <div className="hidden -scale-x-100 @3xl:block">
                <Stitch rows={TULIP} cell={14} />
              </div>
            </div>
            <HeroPhoto s={s} />
          </Sec>
        );
      case "story":
        return (
          <Sec key="story" s={s} style={{ background: blue, color: linen }}>
            <div className="mx-auto grid max-w-[1180px] items-center gap-14 px-6 py-20 @3xl:grid-cols-2 @3xl:gap-20 @3xl:px-16 @3xl:py-24">
              <StitchedPhoto path={s.content.photos[0] ?? null} onPath={(p) => update("story", { photos: setAt(s.content.photos, 0, p) })} />
              <div>
                <Title s={s} className={titleClass} style={gloock} />
                <RichText type="story" field="text" value={s.content.text} className="mt-8 text-[21px] leading-[1.55] opacity-90 @3xl:text-[24px]" />
              </div>
            </div>
            <MorePhotos s={s} />
          </Sec>
        );
      case "schedule":
        return (
          <Sec key="schedule" s={s} className="mx-auto max-w-[1180px] px-5 py-20 @3xl:px-10 @3xl:py-24">
            <Title s={s} className={`block text-center ${titleClass}`} style={{ ...gloock, color: red }} />
            <RichText type="schedule" field="intro" value={s.content.intro} className="mx-auto mt-5 max-w-[46ch] text-center text-[20px] italic opacity-80" placeholder="Úvod k programu (nepovinné)" />
            <div className="mt-14 grid gap-6 @xl:grid-cols-2 @5xl:grid-cols-4">
              {model.events.map((e, i) => {
                const t = when(e, locale, model.timeZone);
                const c = [red, blue, green, "#9a6a12"][i % 4];
                const a = address(e);
                return (
                  <div key={e.id} className="flex flex-col items-center gap-4 bg-white px-6 py-8 text-center" style={{ boxShadow: `inset 0 0 0 8px white, inset 0 0 0 9.5px ${c}` }}>
                    <Stitch rows={MOTIFS[i % MOTIFS.length]} cell={5} />
                    {t.time ? <p className="text-[46px] leading-none tabular-nums" style={{ ...gloock, color: c }}>{t.time}</p> : null}
                    <div>
                      <p className="text-[23px]">{e.name}</p>
                      {e.plan_b_active ? <p className="text-[14px] font-medium" style={{ color: red }}>{locale === "cs" ? "Kvůli počasí jinde" : "Moved due to weather"}</p> : null}
                      <p className="text-[17px] italic opacity-70">{place(e)}</p>
                      {a ? <a href={mapUrl(a)} target="_blank" rel="noreferrer" className="text-[15px] underline underline-offset-4 opacity-80">{a}</a> : null}
                    </div>
                  </div>
                );
              })}
            </div>
            <EventsHint />
          </Sec>
        );
      case "location":
      case "dresscode":
      case "accommodation":
      case "gifts": {
        const i = ["location", "dresscode", "accommodation", "gifts"].indexOf(s.type);
        return (
          <Sec key={s.type} s={s} className="mx-auto max-w-[920px] px-5 py-14 @3xl:px-10">
            <div className="relative bg-white px-7 pb-12 pt-14 @3xl:px-14" style={{ boxShadow: `inset 0 0 0 10px white, inset 0 0 0 11.5px ${[blue, red, green, ochre][i]}` }}>
              <div className="absolute -top-6 left-1/2 -translate-x-1/2 rounded-full bg-white px-4 py-2">
                <Stitch rows={MOTIFS[(i + 1) % MOTIFS.length]} cell={4} />
              </div>
              <Title s={s} className="block text-center text-[clamp(40px,7cqw,60px)] leading-none" style={{ ...gloock, color: red }} />
              {s.type === "location" ? <SitePhoto path={s.content.photo} onPath={(p) => update("location", { photo: p })} className="mt-8 aspect-[16/9]" placeholder={<div className="absolute inset-0" style={{ background: "linear-gradient(160deg,#f3e9da,#d9c3a2)" }} />} /> : null}
              <RichText type={s.type} field="text" value={textOf(s)} className="mx-auto mt-8 max-w-[58ch] text-[19px] leading-relaxed @3xl:text-[21px]" />
              {s.type === "gifts" ? <GiftAccount model={model} s={s} className="mt-10 border-t pt-8" style={{ borderColor: "#e2d8c8" }} /> : null}
            </div>
          </Sec>
        );
      }
      case "faq":
        return (
          <Sec key="faq" s={s} className="mx-auto max-w-[860px] px-5 py-14 @3xl:px-10">
            <Title s={s} className="mb-10 block text-center text-[clamp(40px,7cqw,60px)] leading-none" style={{ ...gloock, color: red }} />
            <FaqList s={s} qClass="text-[21px] @3xl:text-[23px]" aClass="text-[18px] opacity-80" lineColor="#e2d8c8" accent={red} />
          </Sec>
        );
      case "contacts":
        return (
          <Sec key="contacts" s={s} className="mx-auto max-w-[900px] px-5 py-14 @3xl:px-10">
            <Title s={s} className="mb-10 block text-center text-[clamp(40px,7cqw,60px)] leading-none" style={{ ...gloock, color: red }} />
            <ContactList s={s} className="grid gap-6 text-center @2xl:grid-cols-2" itemClass="items-center bg-white px-6 py-6 text-[19px]" nameClass="text-[26px]" accent={blue} />
          </Sec>
        );
      case "rsvp":
        return (
          <Sec key="rsvp" s={s} id="rsvp" className="py-20" style={{ background: red, color: linen }}>
            <div className="mx-auto max-w-[760px] px-5">
              <div className="mb-8 flex justify-center">
                <Stitch rows={HEART.map((r) => r.replace(/r/g, "w").replace(/o/g, "o"))} cell={8} />
              </div>
              <Title s={s} className="block text-center text-[clamp(48px,8cqw,76px)] leading-none" style={gloock} />
              <RichText type="rsvp" field="intro" value={s.content.intro} className="mx-auto mt-5 max-w-[46ch] text-center text-[20px] italic opacity-90" placeholder="Úvod nad formulářem (nepovinné)" />
              <div className="mt-10 bg-white p-6 @3xl:p-10" style={{ color: "#2a2320", boxShadow: `inset 0 0 0 8px white, inset 0 0 0 9.5px ${blue}` }}>
                <RsvpSlot model={model} />
              </div>
            </div>
          </Sec>
        );
    }
  };

  return (
    <div className="@container relative min-h-svh overflow-hidden" style={{ background: linen, color: "#2a2320", fontFamily: FONTS.instrument }}>
      <div className="pointer-events-none absolute inset-0 opacity-[.1]" style={grain} />
      {model.banner}
      <div className="relative">{sections.map(render)}</div>
      <div className="relative pb-10 pt-6">
        <Band />
      </div>
    </div>
  );
}

function HeroPhoto({ s }: { s: Extract<Section, { type: "hero" }> }) {
  const { editing, update } = useEdit();
  if (!s.content.photo && !editing) return null;
  return (
    <div className="mx-auto mt-14 max-w-[900px] px-5">
      <div className="p-3" style={{ outline: `2px dashed ${red}`, outlineOffset: "-2px" }}>
        <SitePhoto path={s.content.photo} onPath={(p) => update("hero", { photo: p })} priority className="aspect-[3/2]" placeholder={<div className="absolute inset-0" style={{ background: "linear-gradient(160deg,#f3e9da,#d9c3a2)" }} />} />
      </div>
    </div>
  );
}

function StitchedPhoto({ path, onPath }: { path: string | null; onPath?: (p: string | null) => void }) {
  const { editing } = useEdit();
  if (!path && !editing) return null;
  return (
    <div className="relative mx-auto w-full max-w-[480px] p-4" style={{ outline: `2px dashed ${ochre}`, outlineOffset: "-2px" }}>
      <SitePhoto path={path} onPath={onPath} className="aspect-[4/5]" placeholder={<div className="absolute inset-0" style={{ background: "linear-gradient(160deg,#f6e2c8,#c98a5f)" }} />} />
      <div className="absolute -bottom-8 -right-4 rotate-[8deg] rounded-full p-4 @3xl:-right-8" style={{ background: linen }}>
        <Stitch rows={HEART} cell={6} />
      </div>
    </div>
  );
}

function setAt(list: string[], i: number, p: string | null): string[] {
  const next = [...list];
  if (p) next[i] = p;
  else next.splice(i, 1);
  return next.filter(Boolean).slice(0, 6);
}

function MorePhotos({ s }: { s: Extract<Section, { type: "story" }> }) {
  const { editing, update } = useEdit();
  const rest = s.content.photos.slice(1);
  if (!rest.length && !editing) return null;
  const slots = editing && s.content.photos.length < 6 ? [...rest, null] : rest;
  return (
    <div className="mx-auto grid max-w-[1180px] grid-cols-2 gap-5 px-6 pb-20 @3xl:grid-cols-5 @3xl:px-16">
      {slots.map((p, i) => (
        <div key={i} className="p-2" style={{ outline: `2px dashed ${ochre}`, outlineOffset: "-2px" }}>
          <SitePhoto path={p} onPath={(np) => update("story", { photos: setAt(s.content.photos, i + 1, np) })} className="aspect-square" placeholder={<div className="absolute inset-0 bg-white/10" />} />
        </div>
      ))}
    </div>
  );
}
