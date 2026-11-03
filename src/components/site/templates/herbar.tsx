"use client";

import type { CSSProperties, ReactNode } from "react";
import { FONTS } from "@/lib/templates";
import type { Section } from "@/lib/site-sections";
import { RichText, Sec, SitePhoto, useEdit } from "../edit";
import type { SiteModel } from "../model";
import { ContactList, EventsHint, FaqList, GiftAccount, RsvpSlot, Title, address, fmtDate, grain, mapUrl, place, textOf, useSections, when } from "./shared";

const ink = "#2b3a2a";
const rust = "#8a4b2f";
const sheetBg = "#fbfaf5";
const gloock: CSSProperties = { fontFamily: FONTS.gloock, fontWeight: 400 };
const hand: CSSProperties = { fontFamily: FONTS.hand };

function Tape({ className = "", rotate = 0 }: { className?: string; rotate?: number }) {
  return <span aria-hidden className={`absolute z-10 h-7 w-24 ${className}`} style={{ transform: `rotate(${rotate}deg)`, background: "rgba(222,210,180,.72)", boxShadow: "0 1px 2px rgba(0,0,0,.08)", clipPath: "polygon(2% 0,98% 4%,100% 50%,97% 100%,3% 96%,0 50%)" }} />;
}

export function Lavender({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 80 320" className={className} aria-hidden>
      <path d="M40 320C42 230 38 140 41 40" stroke="#7d8a62" strokeWidth="2" fill="none" />
      {Array.from({ length: 16 }, (_, i) => (
        <ellipse key={i} cx={34 + (i % 2) * 12} cy={30 + i * 7} rx="5" ry="7.5" fill={i % 3 ? "#8f7bb0" : "#a493c2"} transform={`rotate(${i % 2 ? 25 : -25} ${34 + (i % 2) * 12} ${30 + i * 7})`} opacity=".9" />
      ))}
      <path d="M41 240c-14-6-22-20-22-36 12 8 20 20 22 36ZM40 200c13-6 20-18 20-32-11 7-18 18-20 32Z" fill="#8c9a6e" opacity=".85" />
    </svg>
  );
}
export function Daisy({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 140 300" className={className} aria-hidden>
      <defs>
        <pattern id="hb-dots" width="4" height="4" patternUnits="userSpaceOnUse">
          <circle cx="2" cy="2" r=".9" fill="#8a5a1a" />
        </pattern>
      </defs>
      <path d="M70 300C64 220 76 150 70 74" stroke="#7d8a62" strokeWidth="2" fill="none" />
      <path d="M70 230c-24-4-38-18-42-38 22 2 36 16 42 38ZM71 180c22-6 34-20 36-40-20 4-32 18-36 40Z" fill="#8c9a6e" opacity=".9" />
      <g transform="translate(70 62)">
        {Array.from({ length: 18 }, (_, i) => (
          <ellipse key={i} cx="0" cy="-30" rx="6" ry="24" fill="#f6f2e7" stroke="#d9d0bb" strokeWidth=".8" transform={`rotate(${i * 20})`} />
        ))}
        <circle r="13" fill="#d9a441" />
        <circle r="13" fill="url(#hb-dots)" opacity=".5" />
      </g>
    </svg>
  );
}
export function Fern({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 360" className={className} aria-hidden>
      <path d="M60 360C58 260 64 140 60 10" stroke="#6b7c55" strokeWidth="2" fill="none" />
      {Array.from({ length: 20 }, (_, i) => {
        const y = 330 - i * 16;
        const w = 50 - i * 2.2;
        return (
          <g key={i} fill="#7d8f62" opacity=".88">
            <path d={`M60 ${y}c-${w * 0.4}-2-${w}-10-${w}-18 ${w * 0.5} 0 ${w * 0.9} 8 ${w} 18Z`} />
            <path d={`M60 ${y - 6}c${w * 0.4}-2 ${w}-10 ${w}-18-${w * 0.5} 0-${w * 0.9} 8-${w} 18Z`} />
          </g>
        );
      })}
    </svg>
  );
}
function Poppy({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 300" className={className} aria-hidden>
      <path d="M60 300C56 220 66 150 60 80" stroke="#7d8a62" strokeWidth="2" fill="none" />
      <path d="M60 240c-18-2-30-14-32-30 16 2 28 12 32 30Z" fill="#8c9a6e" />
      <g transform="translate(60 60)" opacity=".92">
        <path d="M0 0C-34-10-40-40-18-50 0-56 4-30 0 0Z" fill="#c6473b" />
        <path d="M0 0C34-10 40-40 18-50 0-56-4-30 0 0Z" fill="#b83a30" />
        <path d="M0 0C-30 6-44 30-26 42 -8 50-2 26 0 0Z" fill="#d0564a" />
        <path d="M0 0C30 6 44 30 26 42 8 50 2 26 0 0Z" fill="#c24a3f" />
        <circle r="7" fill="#2f2a26" />
      </g>
    </svg>
  );
}
const PLANTS = [Fern, Daisy, Lavender, Poppy];

function Sheet({ children, className = "", rotate = 0, style }: { children: ReactNode; className?: string; rotate?: number; style?: CSSProperties }) {
  return (
    <div className={`relative isolate ${className}`} style={{ background: sheetBg, transform: `rotate(${rotate}deg)`, boxShadow: "0 1px 0 rgba(0,0,0,.04), 0 24px 40px -18px rgba(40,50,30,.35)", ...style }}>
      <div className="pointer-events-none absolute inset-0 -z-10 opacity-[.12]" style={grain} />
      {children}
    </div>
  );
}

function Label({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`border px-5 py-3 ${className}`} style={{ borderColor: `${ink}55`, background: "#fdfcf8" }}>
      {children}
    </div>
  );
}

const WORDS = {
  cs: { sheet: "Herbarium nuptiale, list č.", kind: "Druh", site: "Naleziště", date: "Datum", by: "Sběratelé", intro: "si řeknou ano. Budeme rádi, když u toho budete.", and: "a" },
  en: { sheet: "Herbarium nuptiale, sheet no.", kind: "Species", site: "Locality", date: "Date", by: "Collected by", intro: "are getting married. We would love you to be there.", and: "&" },
};

function roman(m: number) {
  return ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"][m - 1] ?? "";
}

export function HerbarSite({ model }: { model: SiteModel }) {
  const { locale, update } = useEdit();
  const sections = useSections(model);
  const w = WORDS[locale];
  const first = model.events[0];
  const t0 = first ? when(first, locale, model.timeZone) : null;
  const [y, m, d] = (model.date ?? "").split("-").map(Number);
  const latin = `Nuptiae ${model.partner1} et ${model.partner2}`;
  let sheetNo = 1;

  const titleClass = "text-[clamp(44px,8cqw,72px)] leading-[0.95]";
  const render = (s: Section): ReactNode => {
    switch (s.type) {
      case "hero":
        return (
          <Sec key="hero" s={s} className="px-4 pt-8 @3xl:px-10 @3xl:pt-16">
            <Sheet className="mx-auto grid max-w-[1180px] gap-8 px-6 py-10 @3xl:min-h-[760px] @3xl:grid-cols-[1fr_1.05fr] @3xl:gap-10 @3xl:px-16 @3xl:py-16">
              <div className="relative h-[300px] @3xl:h-auto">
                <Fern className="absolute left-[2%] top-0 h-[300px] rotate-[-8deg] @3xl:top-6 @3xl:h-[560px]" />
                <Daisy className="absolute left-[30%] top-6 h-[250px] rotate-[10deg] @3xl:left-[150px] @3xl:top-24 @3xl:h-[440px]" />
                <Lavender className="absolute left-[60%] top-0 h-[290px] rotate-[3deg] @3xl:left-[300px] @3xl:h-[520px]" />
                <Tape className="left-[4%] top-[200px] @3xl:left-[30px] @3xl:top-[420px]" rotate={-22} />
                <Tape className="left-[34%] top-[230px] @3xl:left-[180px] @3xl:top-[470px]" rotate={14} />
                <Tape className="left-[62%] top-[190px] @3xl:left-[300px] @3xl:top-[380px]" rotate={-6} />
              </div>
              <div className="flex flex-col justify-between">
                <div>
                  <p className="text-right text-[18px] italic text-[#6c7a5f] @3xl:text-[22px]">
                    {w.sheet} {sheetNo++}
                  </p>
                  <h1 className="mt-6 text-[clamp(72px,15cqw,132px)] leading-[0.86] tracking-[-0.02em] @3xl:mt-14" style={gloock}>
                    {model.partner1}
                    <br />&amp; {model.partner2}
                  </h1>
                  <RichText type="hero" field="intro" value={s.content.intro} className="mt-8 max-w-[26ch] text-[22px] leading-snug @3xl:text-[28px]" placeholder={w.intro} />
                </div>
                <Label className="mt-10 grid grid-cols-[auto_1fr] gap-x-6 gap-y-1 text-[17px] @3xl:text-[19px]">
                  <span className="italic opacity-70">{w.kind}</span>
                  <span>{latin}</span>
                  {first && place(first) ? (
                    <>
                      <span className="italic opacity-70">{w.site}</span>
                      <span>{place(first)}</span>
                    </>
                  ) : null}
                  {model.date ? (
                    <>
                      <span className="italic opacity-70">{w.date}</span>
                      <span>
                        {d}. {roman(m)}. {y}
                        {t0?.time ? `, ${t0.time}` : ""}
                      </span>
                    </>
                  ) : null}
                  <span className="italic opacity-70">{w.by}</span>
                  <span style={{ ...hand, fontSize: 26, lineHeight: 1 }}>
                    {model.partner1} {w.and} {model.partner2}
                  </span>
                </Label>
              </div>
            </Sheet>
            <HeroPhoto s={s} />
          </Sec>
        );
      case "story":
        return (
          <Sec key="story" s={s} className="px-5 pt-24 @3xl:px-10">
            <div className="mx-auto grid max-w-[1100px] items-start gap-14 @3xl:grid-cols-[1.1fr_1fr]">
              <div className="@3xl:pt-10">
                <Title s={s} className={titleClass} style={gloock} />
                <RichText type="story" field="text" value={s.content.text} className="mt-8 text-[21px] leading-[1.55] @3xl:text-[24px]" />
              </div>
              <TapedPhoto path={s.content.photos[0] ?? null} onPath={(p) => update("story", { photos: setAt(s.content.photos, 0, p) })} caption={fmtDate(model.date, locale, { month: "long", year: "numeric" })} rotate={2} />
            </div>
            <MorePhotos s={s} />
          </Sec>
        );
      case "schedule":
        return (
          <Sec key="schedule" s={s} className="px-5 pt-28 @3xl:px-10">
            <div className="mx-auto max-w-[1180px]">
              <Title s={s} className={`block text-center ${titleClass}`} style={gloock} />
              <RichText type="schedule" field="intro" value={s.content.intro} className="mx-auto mt-5 max-w-[46ch] text-center text-[20px] italic opacity-80" placeholder="Úvod k programu (nepovinné)" />
              <div className="mt-14 grid gap-6 @xl:grid-cols-2 @5xl:grid-cols-4">
                {model.events.map((e, i) => {
                  const t = when(e, locale, model.timeZone);
                  const Plant = PLANTS[i % PLANTS.length];
                  const a = address(e);
                  return (
                    <Sheet key={e.id} rotate={[-1.5, 1, -0.5, 1.8][i % 4]} className="flex min-h-[360px] flex-col px-6 pb-6 pt-8">
                      <div className="grid flex-1 place-items-center">
                        <Plant className="h-44" />
                      </div>
                      <Label className="mt-4">
                        {t.time ? <p className="text-[34px] leading-none tabular-nums" style={gloock}>{t.time}</p> : null}
                        <p className="mt-2 text-[21px]">{e.name}</p>
                        {e.plan_b_active ? <p className="text-[14px] font-medium" style={{ color: rust }}>{locale === "cs" ? "Kvůli počasí jinde" : "Moved due to weather"}</p> : null}
                        <p className="text-[16px] italic opacity-70">{place(e)}</p>
                        {a ? (
                          <a href={mapUrl(a)} target="_blank" rel="noreferrer" className="text-[15px] underline underline-offset-4 opacity-80">
                            {a}
                          </a>
                        ) : null}
                      </Label>
                    </Sheet>
                  );
                })}
              </div>
              <EventsHint />
            </div>
          </Sec>
        );
      case "location":
      case "dresscode":
      case "accommodation":
      case "gifts": {
        const i = ["location", "dresscode", "accommodation", "gifts"].indexOf(s.type);
        const Plant = PLANTS[(i + 1) % PLANTS.length];
        const flip = i % 2 === 1;
        return (
          <Sec key={s.type} s={s} className="px-5 pt-24 @3xl:px-10">
            <Sheet rotate={flip ? 0.6 : -0.6} className={`mx-auto grid max-w-[1000px] items-center gap-8 px-7 py-12 @3xl:gap-12 @3xl:px-14 ${flip ? "@3xl:grid-cols-[1fr_200px]" : "@3xl:grid-cols-[200px_1fr]"}`}>
              <div className={`relative mx-auto hidden h-64 w-40 @3xl:block ${flip ? "@3xl:order-2" : ""}`}>
                <Plant className="h-full w-full" />
                <Tape className="bottom-14 left-6" rotate={-10} />
              </div>
              <div>
                <p className="text-[18px] italic text-[#6c7a5f]">
                  {w.sheet} {sheetNo++}
                </p>
                <Title s={s} className="mt-2 block text-[clamp(38px,7cqw,56px)] leading-none" style={gloock} />
                {s.type === "location" ? <SitePhoto path={s.content.photo} onPath={(p) => update("location", { photo: p })} className="mt-6 aspect-[16/9]" placeholder={<div className="absolute inset-0" style={{ background: "linear-gradient(160deg,#e6eadf,#bfc8b3)" }} />} /> : null}
                <RichText type={s.type} field="text" value={textOf(s)} className="mt-6 text-[19px] leading-relaxed @3xl:text-[21px]" />
                {s.type === "gifts" ? <GiftAccount model={model} s={s} className="mt-8 border-t pt-8" style={{ borderColor: `${ink}22` }} /> : null}
              </div>
            </Sheet>
          </Sec>
        );
      }
      case "faq":
        return (
          <Sec key="faq" s={s} className="px-5 pt-24 @3xl:px-10">
            <Sheet rotate={-0.4} className="mx-auto max-w-[860px] px-7 py-12 @3xl:px-14">
              <Title s={s} className="mb-8 block text-[clamp(38px,7cqw,56px)] leading-none" style={gloock} />
              <FaqList s={s} qClass="text-[20px] @3xl:text-[22px]" aClass="text-[18px] opacity-80" lineColor={`${ink}33`} accent={rust} />
            </Sheet>
          </Sec>
        );
      case "contacts":
        return (
          <Sec key="contacts" s={s} className="px-5 pt-24 @3xl:px-10">
            <div className="mx-auto max-w-[900px]">
              <Title s={s} className="mb-10 block text-center text-[clamp(38px,7cqw,56px)] leading-none" style={gloock} />
              <ContactList s={s} className="grid gap-6 @2xl:grid-cols-2" itemClass="border bg-[#fdfcf8] px-6 py-5 text-[18px]" nameClass="text-[24px]" accent={ink} />
            </div>
          </Sec>
        );
      case "rsvp":
        return (
          <Sec key="rsvp" s={s} id="rsvp" className="px-5 pt-24 @3xl:px-10">
            <Sheet rotate={0.4} className="mx-auto max-w-[760px] px-6 py-12 @3xl:px-14">
              <div className="flex items-start justify-between gap-6">
                <Title s={s} className="block text-[clamp(38px,7cqw,56px)] leading-none" style={gloock} />
                <Poppy className="hidden h-28 shrink-0 @xl:block" />
              </div>
              <RichText type="rsvp" field="intro" value={s.content.intro} className="mt-4 max-w-[46ch] text-[20px] italic opacity-80" placeholder="Úvod nad formulářem (nepovinné)" />
              <div className="mt-10">
                <RsvpSlot model={model} />
              </div>
            </Sheet>
          </Sec>
        );
    }
  };

  return (
    <div className="@container relative min-h-svh overflow-hidden pb-24" style={{ background: "#e4e7dc", color: ink, fontFamily: FONTS.instrument }}>
      <div className="pointer-events-none absolute inset-0 opacity-[.08]" style={grain} />
      {model.banner}
      <div className="relative">{sections.map(render)}</div>
    </div>
  );
}

function TapedPhoto({ path, onPath, caption, rotate = 0 }: { path: string | null; onPath?: (p: string | null) => void; caption?: string | null; rotate?: number }) {
  const { editing } = useEdit();
  if (!path && !editing) return null;
  return (
    <div className="relative mx-auto w-full max-w-[460px]">
      <Sheet rotate={rotate} className="p-4 pb-12">
        <SitePhoto path={path} onPath={onPath} className="aspect-[4/5]" placeholder={<div className="absolute inset-0" style={{ background: "linear-gradient(160deg,#e6eadf,#a9b9a0)" }} />} />
        {caption ? (
          <p className="absolute bottom-3 left-5 text-[22px]" style={hand}>
            {caption}
          </p>
        ) : null}
      </Sheet>
      <Tape className="-top-3 left-10" rotate={-12} />
      <Tape className="-top-2 right-8" rotate={10} />
    </div>
  );
}

function HeroPhoto({ s }: { s: Extract<Section, { type: "hero" }> }) {
  const { editing, update } = useEdit();
  if (!s.content.photo && !editing) return null;
  return (
    <div className="mx-auto -mt-6 max-w-[860px] px-4 @3xl:-mt-10">
      <div className="relative">
        <Sheet rotate={-1} className="p-4">
          <SitePhoto path={s.content.photo} onPath={(p) => update("hero", { photo: p })} priority className="aspect-[3/2]" placeholder={<div className="absolute inset-0" style={{ background: "linear-gradient(160deg,#e6eadf,#a9b9a0)" }} />} />
        </Sheet>
        <Tape className="-top-3 left-1/2 -translate-x-1/2" rotate={3} />
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
    <div className="mx-auto mt-16 grid max-w-[1000px] grid-cols-2 gap-8 @3xl:grid-cols-4">
      {slots.map((p, i) => (
        <TapedPhoto key={i} path={p} onPath={(np) => update("story", { photos: setAt(s.content.photos, i + 1, np) })} rotate={[-2, 1.5, -1, 2][i % 4]} />
      ))}
    </div>
  );
}
