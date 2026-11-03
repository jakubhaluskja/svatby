"use client";

import { useMemo, type CSSProperties, type ReactNode } from "react";
import { FONTS } from "@/lib/templates";
import type { Section } from "@/lib/site-sections";
import { moonPhase, skyMap } from "@/lib/sky";
import { zonedToUtcIso } from "@/lib/time";
import { LineText, RichText, Sec, SitePhoto, useEdit } from "../edit";
import type { SiteModel } from "../model";
import { ContactList, EventsHint, FaqList, GiftAccount, RsvpSlot, Title, address, fmtDate, mapUrl, place, textOf, useSections, when } from "./shared";

const sky = "#0f1733";
const gold = "#d4b47c";
const text = "#ece6d8";
const serif: CSSProperties = { fontFamily: FONTS.instrument };

function rng(seed: number) {
  let s = seed;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

/** Skutečná obloha nad místem svatby v čase oslavy. */
function StarMap({ date, coords }: { date: Date; coords: { lat: number; lon: number } }) {
  const map = useMemo(() => skyMap(date, coords.lat, coords.lon), [date, coords.lat, coords.lon]);
  const phase = moonPhase(date);
  const R = 236;
  const P = (x: number, y: number) => [250 + x * R, 250 + y * R];
  // fáze: osvětlená část měsíce
  const lit = Math.cos(phase * 2 * Math.PI); // 1 nov, -1 úplněk
  const waxing = phase < 0.5;
  return (
    <svg viewBox="0 0 500 500" className="h-auto w-full" role="img" aria-label="Hvězdná obloha">
      <defs>
        <radialGradient id="noc-sky" cx="50%" cy="45%">
          <stop offset="0" stopColor="#24305a" />
          <stop offset="1" stopColor="#0b1128" />
        </radialGradient>
        <clipPath id="noc-moon">
          <circle cx="0" cy="0" r="16" />
        </clipPath>
      </defs>
      <circle cx="250" cy="250" r="244" fill="url(#noc-sky)" stroke={gold} strokeWidth="1.2" />
      <circle cx="250" cy="250" r="236" fill="none" stroke={gold} strokeWidth=".5" opacity=".6" />
      {[0.333, 0.667].map((r) => (
        <circle key={r} cx="250" cy="250" r={R * r} fill="none" stroke={text} strokeWidth=".3" opacity=".18" strokeDasharray="2 4" />
      ))}
      {Array.from({ length: 12 }, (_, i) => (
        <line key={i} x1="250" y1="250" x2={250 + Math.cos((i * Math.PI) / 6) * R} y2={250 + Math.sin((i * Math.PI) / 6) * R} stroke={text} strokeWidth=".3" opacity=".12" />
      ))}
      {map.lines.map(([a, b], i) => {
        const [x1, y1] = P(a.x, a.y);
        const [x2, y2] = P(b.x, b.y);
        return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={gold} strokeWidth=".8" opacity=".75" />;
      })}
      {map.stars.map((s) => {
        const [x, y] = P(s.x, s.y);
        const r = Math.max(0.8, 3.4 - s.mag * 0.75);
        return <circle key={s.name} cx={x} cy={y} r={r} fill={s.mag < 1.5 ? gold : text} opacity={s.mag < 3 ? 1 : 0.75} />;
      })}
      <g transform="translate(408 92)">
        <circle r="16" fill="#1b2547" stroke={gold} strokeWidth=".6" />
        <g clipPath="url(#noc-moon)">
          <rect x={waxing ? 0 : -16} y="-16" width="16" height="32" fill={gold} />
          <ellipse cx="0" cy="0" rx={Math.abs(lit) * 16} ry="16" fill={lit > 0 ? "#1b2547" : gold} />
        </g>
      </g>
      <text x="250" y="22" textAnchor="middle" fontSize="11" fill={gold} opacity=".7" style={{ fontFamily: FONTS.sans }}>S</text>
      <text x="250" y="490" textAnchor="middle" fontSize="11" fill={gold} opacity=".7" style={{ fontFamily: FONTS.sans }}>J</text>
      <text x="14" y="254" textAnchor="middle" fontSize="11" fill={gold} opacity=".7" style={{ fontFamily: FONTS.sans }}>V</text>
      <text x="486" y="254" textAnchor="middle" fontSize="11" fill={gold} opacity=".7" style={{ fontFamily: FONTS.sans }}>Z</text>
    </svg>
  );
}

function Stars() {
  const pts = useMemo(() => {
    const r = rng(7);
    return Array.from({ length: 160 }, () => ({ l: r() * 100, t: r() * 100, s: r() > 0.9 ? 2 : 1, o: 0.2 + r() * 0.6 }));
  }, []);
  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden>
      {pts.map((p, i) => (
        <span key={i} className="absolute rounded-full bg-white" style={{ left: `${p.l}%`, top: `${p.t}%`, width: p.s, height: p.s, opacity: p.o }} />
      ))}
    </div>
  );
}

const WORDS = {
  cs: { tagline: "Pod jedním nebem", sky: (d: string, t: string, p: string) => `Takhle bude vypadat obloha${p ? ` nad místem ${p}` : ""} ${d} ve ${t}, až budeme slavit s vámi.`, and: "a", moon: ["nov", "dorůstající měsíc", "první čtvrť", "dorůstající měsíc", "úplněk", "ubývající měsíc", "poslední čtvrť", "ubývající měsíc"] },
  en: { tagline: "Under one sky", sky: (d: string, t: string, p: string) => `This is the sky${p ? ` above ${p}` : ""} on ${d} at ${t}, when we celebrate with you.`, and: "&", moon: ["new moon", "waxing crescent", "first quarter", "waxing gibbous", "full moon", "waning gibbous", "last quarter", "waning crescent"] },
};

export function NocSite({ model }: { model: SiteModel }) {
  const { locale, update } = useEdit();
  const sections = useSections(model);
  const w = WORDS[locale];
  const coords = model.coords ?? { lat: 49.8, lon: 15.5 };
  const skyTime = "21:30";
  const skyDate = useMemo(() => new Date(model.date ? zonedToUtcIso(model.date, skyTime, model.timeZone) : Date.now()), [model.date, model.timeZone]);
  const first = model.events[0];
  const moonName = w.moon[Math.round(moonPhase(skyDate) * 8) % 8];
  const titleClass = "text-[clamp(48px,8cqw,80px)] leading-[0.95]";

  const render = (s: Section): ReactNode => {
    switch (s.type) {
      case "hero":
        return (
          <Sec key="hero" s={s} className="relative mx-auto grid max-w-[1280px] items-center gap-10 px-6 pb-16 pt-16 @3xl:min-h-[860px] @3xl:grid-cols-2 @3xl:gap-6 @3xl:px-16">
            <div>
              <LineText type="hero" field="tagline" value={s.content.tagline} fallback={w.tagline} as="p" className="text-[22px] italic @3xl:text-[24px]" style={{ color: gold }} />
              <h1 className="mt-6 text-[clamp(84px,15cqw,150px)] leading-[0.82] tracking-[-0.02em]" style={serif}>
                {model.partner1}
                <br />
                <span className="pl-[0.6em] italic" style={{ color: gold }}>
                  {w.and}
                </span>{" "}
                {model.partner2}
              </h1>
              {model.date ? <p className="mt-8 text-[24px] @3xl:text-[28px]">{fmtDate(model.date, locale, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</p> : null}
              <RichText type="hero" field="intro" value={s.content.intro} className="mt-6 max-w-[34ch] text-[20px] leading-snug opacity-85 @3xl:text-[22px]" placeholder={w.sky(fmtDate(model.date, locale, { day: "numeric", month: "long" }) ?? "", skyTime, first ? place(first) ?? "" : "")} />
            </div>
            <figure className="mx-auto flex w-full max-w-[560px] flex-col items-center">
              <StarMap date={skyDate} coords={coords} />
              <figcaption className="mt-5 text-center text-[16px] italic opacity-75 @3xl:text-[18px]">
                {[first ? place(first) : null, fmtDate(model.date, locale, { day: "numeric", month: "numeric", year: "numeric" }), skyTime, moonName].filter(Boolean).join(", ")}
              </figcaption>
            </figure>
          </Sec>
        );
      case "story":
        return (
          <Sec key="story" s={s} className="mx-auto grid max-w-[1180px] items-center gap-14 px-6 py-20 @3xl:grid-cols-[0.9fr_1fr] @3xl:gap-20 @3xl:px-16 @3xl:py-24">
            <ArchPhoto path={s.content.photos[0] ?? null} onPath={(p) => update("story", { photos: setAt(s.content.photos, 0, p) })} />
            <div>
              <Title s={s} className={titleClass} style={serif} />
              <RichText type="story" field="text" value={s.content.text} className="mt-8 text-[21px] leading-[1.55] opacity-90 @3xl:text-[24px]" />
              <MorePhotos s={s} />
            </div>
          </Sec>
        );
      case "schedule":
        return (
          <Sec key="schedule" s={s} className="mx-auto max-w-[1180px] px-6 py-20 @3xl:px-16">
            <Title s={s} className={`block text-center ${titleClass}`} style={serif} />
            <RichText type="schedule" field="intro" value={s.content.intro} className="mx-auto mt-5 max-w-[46ch] text-center text-[20px] italic opacity-75" placeholder="Úvod k programu (nepovinné)" />
            {/* souhvězdí na počítači */}
            <div className="relative mt-16 hidden h-[440px] @4xl:block">
              <svg viewBox="0 0 1000 440" preserveAspectRatio="none" className="absolute inset-0 h-full w-full" aria-hidden>
                <polyline points={model.events.map((_, i) => `${constX(i, model.events.length) * 10},${constY(i) * 4.4}`).join(" ")} fill="none" stroke={gold} strokeWidth="1.2" strokeDasharray="1 7" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
              </svg>
              {model.events.map((e, i) => {
                const t = when(e, locale, model.timeZone);
                return (
                  <div key={e.id} className="absolute w-56 -translate-x-1/2 text-center" style={{ left: `${constX(i, model.events.length)}%`, top: `calc(${constY(i)}% - 8px)` }}>
                    <span className="mx-auto block size-4 rounded-full" style={{ background: gold, boxShadow: `0 0 0 6px ${sky}, 0 0 28px 6px ${gold}88` }} />
                    {t.time ? <p className="mt-4 text-[42px] leading-none tabular-nums" style={{ color: gold }}>{t.time}</p> : null}
                    <p className="mt-2 text-[23px]">{e.name}</p>
                    <p className="text-[16px] italic opacity-65">{place(e)}</p>
                  </div>
                );
              })}
            </div>
            {/* seznam na mobilu a vždy s adresami */}
            <ol className="mx-auto mt-12 flex max-w-[640px] flex-col @4xl:mt-6 @4xl:hidden">
              {model.events.map((e) => {
                const t = when(e, locale, model.timeZone);
                const a = address(e);
                return (
                  <li key={e.id} className="relative grid grid-cols-[5rem_1fr] gap-4 border-l py-5 pl-6" style={{ borderColor: `${gold}55` }}>
                    <span className="absolute -left-[7px] top-8 size-3 rounded-full" style={{ background: gold, boxShadow: `0 0 16px 3px ${gold}88` }} />
                    <span className="text-[30px] leading-none tabular-nums" style={{ color: gold }}>{t.time}</span>
                    <div>
                      <p className="text-[22px]">{e.name}</p>
                      {e.plan_b_active ? <p className="text-[14px]" style={{ color: gold }}>{locale === "cs" ? "Kvůli počasí jinde" : "Moved due to weather"}</p> : null}
                      <p className="text-[16px] italic opacity-70">{place(e)}</p>
                      {a ? <a href={mapUrl(a)} target="_blank" rel="noreferrer" className="text-[15px] underline underline-offset-4 opacity-80">{a}</a> : null}
                    </div>
                  </li>
                );
              })}
            </ol>
            <Addresses model={model} />
            <EventsHint />
          </Sec>
        );
      case "location":
      case "dresscode":
      case "accommodation":
      case "gifts":
        return (
          <Sec key={s.type} s={s} className="mx-auto max-w-[900px] px-6 py-16 @3xl:px-16">
            <div className="rounded-[28px] border px-7 py-12 @3xl:px-14" style={{ borderColor: `${gold}55`, background: "rgba(255,255,255,.03)" }}>
              <Title s={s} className="block text-center text-[clamp(42px,7cqw,64px)] leading-none" style={serif} />
              {s.type === "location" ? <SitePhoto path={s.content.photo} onPath={(p) => update("location", { photo: p })} className="mt-8 aspect-[16/9] rounded-2xl" placeholder={<div className="absolute inset-0" style={{ background: "radial-gradient(110% 80% at 60% 20%,#3a4d7a,#1b2747 50%,#0b1024)" }} />} /> : null}
              <RichText type={s.type} field="text" value={textOf(s)} className="mx-auto mt-8 max-w-[56ch] text-[20px] leading-relaxed opacity-90 @3xl:text-[22px]" />
              {s.type === "gifts" ? <GiftAccount model={model} s={s} className="mt-10 border-t pt-8" style={{ borderColor: `${gold}44` }} /> : null}
            </div>
          </Sec>
        );
      case "faq":
        return (
          <Sec key="faq" s={s} className="mx-auto max-w-[860px] px-6 py-16 @3xl:px-16">
            <Title s={s} className="mb-10 block text-center text-[clamp(42px,7cqw,64px)] leading-none" style={serif} />
            <FaqList s={s} qClass="text-[21px] @3xl:text-[24px]" aClass="text-[18px] opacity-80" lineColor={`${gold}44`} accent={gold} />
          </Sec>
        );
      case "contacts":
        return (
          <Sec key="contacts" s={s} className="mx-auto max-w-[900px] px-6 py-16 @3xl:px-16">
            <Title s={s} className="mb-10 block text-center text-[clamp(42px,7cqw,64px)] leading-none" style={serif} />
            <ContactList s={s} className="grid gap-6 text-center @2xl:grid-cols-2" itemClass="items-center rounded-2xl border px-6 py-6 text-[19px]" nameClass="text-[26px]" accent={gold} />
          </Sec>
        );
      case "rsvp":
        return (
          <Sec key="rsvp" s={s} id="rsvp" className="mx-auto max-w-[760px] px-6 pb-28 pt-16">
            <Title s={s} className="block text-center text-[clamp(48px,8cqw,80px)] leading-none" style={serif} />
            <RichText type="rsvp" field="intro" value={s.content.intro} className="mx-auto mt-5 max-w-[46ch] text-center text-[20px] italic opacity-80" placeholder="Úvod nad formulářem (nepovinné)" />
            <div className="mt-12 rounded-[28px] p-6 @3xl:p-10" style={{ background: "#f4efe4", color: "#1d2440" }}>
              <RsvpSlot model={model} />
            </div>
          </Sec>
        );
    }
  };

  return (
    <div className="@container relative min-h-svh overflow-hidden" style={{ background: sky, color: text, fontFamily: FONTS.instrument }}>
      <Stars />
      {model.banner}
      <div className="relative">{sections.map(render)}</div>
    </div>
  );
}

function constX(i: number, n: number) {
  return n <= 1 ? 50 : 8 + (84 * i) / (n - 1);
}
function constY(i: number) {
  return [70, 30, 60, 18, 52, 26][i % 6];
}

function Addresses({ model }: { model: SiteModel }) {
  const list = model.events.filter((e) => address(e));
  if (!list.length) return null;
  return (
    <ul className="mx-auto mt-6 hidden max-w-[760px] flex-wrap justify-center gap-x-8 gap-y-2 text-[16px] opacity-75 @4xl:flex">
      {list.map((e) => (
        <li key={e.id}>
          {e.name}:{" "}
          <a href={mapUrl(address(e)!)} target="_blank" rel="noreferrer" className="underline underline-offset-4">
            {address(e)}
          </a>
        </li>
      ))}
    </ul>
  );
}

function ArchPhoto({ path, onPath }: { path: string | null; onPath?: (p: string | null) => void }) {
  const { editing } = useEdit();
  if (!path && !editing) return null;
  return (
    <div className="relative mx-auto w-[80%] max-w-[440px] @3xl:w-full">
      <SitePhoto path={path} onPath={onPath} className="aspect-[3/4] rounded-t-[999px]" placeholder={<div className="absolute inset-0" style={{ background: "radial-gradient(110% 80% at 60% 20%,#3a4d7a,#1b2747 50%,#0b1024)" }} />} />
      <div className="pointer-events-none absolute -inset-4 rounded-t-[999px] border" style={{ borderColor: `${gold}88` }} />
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
    <div className="mt-10 grid grid-cols-3 gap-3">
      {slots.map((p, i) => (
        <SitePhoto key={i} path={p} onPath={(np) => update("story", { photos: setAt(s.content.photos, i + 1, np) })} className="aspect-square rounded-full" placeholder={<div className="absolute inset-0 bg-white/10" />} label="fotku" />
      ))}
    </div>
  );
}
