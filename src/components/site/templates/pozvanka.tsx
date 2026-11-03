"use client";

import type { CSSProperties, ReactNode } from "react";
import { FONTS } from "@/lib/templates";
import type { Section } from "@/lib/site-sections";
import { LineText, RichText, Sec, SitePhoto, useEdit } from "../edit";
import type { SiteModel } from "../model";
import { deckle } from "./deckle";
import { ContactList, EventsHint, FaqList, GiftAccount, RsvpSlot, Title, address, fmtDate, grain, mapUrl, place, textOf, useSections, when } from "./shared";

const ink = "#1f2a44";
const wax = "#7d1d2c";
const paper = "#f8f6f1";
const linen: CSSProperties = {
  backgroundColor: "#d6d0c4",
  backgroundImage: "repeating-linear-gradient(0deg, rgba(255,255,255,.07) 0 1px, transparent 1px 3px), repeating-linear-gradient(90deg, rgba(0,0,0,.035) 0 1px, transparent 1px 3px)",
};
const script: CSSProperties = { fontFamily: FONTS.script, fontWeight: 400 };

function Seal({ size = 92, letters }: { size?: number; letters: string }) {
  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" className="absolute inset-0" aria-hidden>
        <defs>
          <radialGradient id="wax" cx="40%" cy="35%">
            <stop offset="0" stopColor="#a8343f" />
            <stop offset=".6" stopColor={wax} />
            <stop offset="1" stopColor="#4d0f19" />
          </radialGradient>
        </defs>
        <path d="M50 3c8 0 10 5 17 7s13 0 17 6 0 11 4 17 9 9 8 17-7 9-8 16 3 13-3 18-12 2-18 6-8 9-17 9-11-6-18-8-14 1-18-5 1-12-4-18-10-8-10-16 6-10 8-16-2-13 4-18 12-1 18-5 8-6 18-6z" fill="url(#wax)" />
        <circle cx="50" cy="51" r="29" fill="none" stroke="#5a1220" strokeWidth="2" opacity=".7" />
        <circle cx="50" cy="51" r="29" fill="none" stroke="#c4646f" strokeWidth=".8" opacity=".5" transform="translate(-.8 -.8)" />
      </svg>
      <span className="relative leading-none" style={{ ...script, fontSize: size * 0.32, color: "#4a0d17", textShadow: "1px 1px 0 rgba(255,180,180,.35)" }}>
        {letters}
      </span>
    </div>
  );
}

function Card({ children, className = "", seed = 3, rotate = 0, style }: { children: ReactNode; className?: string; seed?: number; rotate?: number; style?: CSSProperties }) {
  return (
    <div className={`relative ${className}`} style={{ transform: `rotate(${rotate}deg)`, filter: "drop-shadow(0 18px 22px rgba(40,30,20,.22)) drop-shadow(0 2px 3px rgba(40,30,20,.18))", ...style }}>
      <div className="relative h-full" style={{ background: paper, clipPath: deckle(seed), color: ink }}>
        <div className="pointer-events-none absolute inset-0 opacity-[.13]" style={grain} />
        <div className="relative">{children}</div>
      </div>
    </div>
  );
}

function Print({ path, onPath, caption, rotate = -3, className = "", tape = true }: { path: string | null; onPath?: (p: string | null) => void; caption?: ReactNode; rotate?: number; className?: string; tape?: boolean }) {
  const { editing } = useEdit();
  if (!path && !editing) return null;
  return (
    <div className={`relative ${className}`}>
      <div className="bg-white p-3 pb-12 @3xl:p-4 @3xl:pb-16" style={{ transform: `rotate(${rotate}deg)`, boxShadow: "0 20px 30px rgba(40,30,20,.22)" }}>
        <SitePhoto path={path} onPath={onPath} className="aspect-[4/5]" placeholder={<div className="absolute inset-0" style={{ background: "linear-gradient(160deg,#e8e2d6,#c9bfae)" }} />} />
        {caption ? <div className="absolute inset-x-0 bottom-3 text-center text-[22px] @3xl:bottom-5 @3xl:text-[26px]" style={script}>{caption}</div> : null}
      </div>
      {tape ? <span className="absolute -top-3 left-1/2 h-8 w-28 -translate-x-1/2 rotate-[4deg]" style={{ background: "rgba(214,201,176,.75)", boxShadow: "0 1px 2px rgba(0,0,0,.08)" }} /> : null}
    </div>
  );
}

function Sprig({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 80 300" className={className} fill="none" stroke="#6f7a5b" strokeWidth="1.4" style={{ filter: "drop-shadow(2px 6px 4px rgba(0,0,0,.15))" }} aria-hidden>
      <path d="M40 300C38 200 42 100 40 0" />
      {Array.from({ length: 12 }, (_, i) => (
        <g key={i}>
          <path d={`M40 ${270 - i * 22}c-14-4-24-14-26-26 12 2 22 12 26 26Z`} fill="#8b9672" />
          <path d={`M40 ${258 - i * 22}c14-4 24-14 26-26-12 2-22 12-26 26Z`} fill="#7d8866" />
        </g>
      ))}
    </svg>
  );
}

const WORDS = {
  cs: { tagline: "Spolu se svými rodiči vás srdečně zvou na svůj sňatek", and: "a", reply: "Odpovězte prosím", by: "do", story: "Jak to začalo", schedule: "Pořad dne", at: "v", hour: "hodin" },
  en: { tagline: "Together with their families invite you to celebrate their wedding", and: "&", reply: "Kindly reply", by: "by", story: "How it began", schedule: "Order of the day", at: "at", hour: "" },
};

export function PozvankaSite({ model }: { model: SiteModel }) {
  const { locale } = useEdit();
  const sections = useSections(model);
  const w = WORDS[locale];
  const letters = `${model.partner1.trim()[0] ?? ""}&${model.partner2.trim()[0] ?? ""}`;
  const first = model.events[0];
  const firstWhen = first ? when(first, locale, model.timeZone) : null;
  const deadline = model.rsvpDeadline ? new Intl.DateTimeFormat(locale === "cs" ? "cs-CZ" : "en-GB", { day: "numeric", month: "long", timeZone: model.timeZone }).format(new Date(model.rsvpDeadline)) : null;

  const render = (s: Section): ReactNode => {
    switch (s.type) {
      case "hero":
        return (
          <Sec key="hero" s={s} className="relative px-5 pb-20 pt-10 @3xl:px-10 @3xl:pb-28 @3xl:pt-16">
            <div className="relative mx-auto max-w-[1100px]">
              {/* obálka */}
              <div className="absolute left-1/2 top-[38%] hidden h-[62%] w-[min(700px,120%)] -translate-x-1/2 rotate-[-4deg] @md:block" style={{ filter: "drop-shadow(0 30px 30px rgba(40,30,20,.25))" }} aria-hidden>
                <div className="absolute inset-0" style={{ background: "#9fb0c4" }} />
                <div className="absolute inset-0 opacity-25" style={grain} />
                <svg viewBox="0 0 700 470" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
                  <path d="M0 470 L350 230 L700 470" fill="#93a5bb" />
                  <path d="M0 0 L350 250 L700 0" fill="#a9b9cc" stroke="#8496ad" strokeWidth="1" />
                </svg>
              </div>
              <Sprig className="absolute left-[2%] top-[48%] hidden h-[330px] rotate-[-18deg] @4xl:block" />
              <div className="absolute left-0 top-[8%] hidden w-[230px] @5xl:block">
                <Print path={s.content.photo} onPath={(p) => update(s, { photo: p })} rotate={-6} caption={fmtDate(model.date, locale, { day: "numeric", month: "numeric", year: "numeric" })} />
              </div>
              {/* pozvánka */}
              <Card seed={7} rotate={1.5} className="relative mx-auto w-full max-w-[480px]">
                <div className="flex flex-col items-center px-8 pb-24 pt-12 text-center @md:px-14 @md:pt-16">
                  <svg viewBox="0 0 120 60" className="w-20 opacity-80 @md:w-24" fill="none" stroke={ink} strokeWidth=".9" aria-hidden>
                    <path d="M60 58C60 40 58 22 62 4" />
                    <path d="M61 46c-10-4-16-12-18-22 10 2 16 10 18 22ZM60 34c10-4 16-12 18-22-10 2-16 10-18 22ZM61 22c-7-3-11-9-12-16 7 2 11 8 12 16Z" />
                  </svg>
                  <LineText type="hero" field="tagline" value={s.content.tagline} fallback={w.tagline} as="p" className="mt-6 max-w-[26ch] text-[18px] leading-snug @md:text-[19px]" />
                  <h1 className="mt-6 text-[clamp(56px,16cqw,92px)] leading-[0.95]" style={script}>
                    {model.partner1}
                    <br />
                    <span className="text-[0.58em]">{w.and}</span> {model.partner2}
                  </h1>
                  {model.date ? <p className="mt-8 text-[21px] leading-snug @md:text-[22px]">{fmtDate(model.date, locale, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</p> : null}
                  {first ? (
                    <p className="mt-3 text-[17px] italic opacity-80 @md:text-lg">
                      {[firstWhen?.time ? `${w.at} ${firstWhen.time}` : null, place(first)].filter(Boolean).join(", ")}
                    </p>
                  ) : null}
                  <RichText type="hero" field="intro" value={s.content.intro} className="mt-6 max-w-[34ch] text-[17px] leading-relaxed opacity-90" placeholder="Pár slov pro hosty (nepovinné)" />
                </div>
              </Card>
              <div className="relative z-10 -mt-14 flex justify-center" style={{ filter: "drop-shadow(0 6px 6px rgba(60,10,20,.35))" }}>
                <div className="rotate-[8deg]">
                  <Seal size={96} letters={letters} />
                </div>
              </div>
              {deadline ? (
                <div className="mx-auto mt-6 w-[220px] rotate-[4deg] rounded-sm px-6 py-4 text-center backdrop-blur-sm @4xl:absolute @4xl:right-[4%] @4xl:top-[58%] @4xl:mt-0 @4xl:rotate-[8deg]" style={{ background: "rgba(255,255,255,.45)", boxShadow: "0 10px 20px rgba(40,30,20,.12)", border: "1px solid rgba(255,255,255,.6)" }}>
                  <p className="text-[15px] italic">{w.reply}</p>
                  <p className="text-[26px] leading-tight" style={script}>
                    {w.by} {deadline}
                  </p>
                </div>
              ) : null}
              <div className="mx-auto mt-10 w-[78%] max-w-[300px] @5xl:hidden">
                <Print path={s.content.photo} onPath={(p) => update(s, { photo: p })} rotate={-3} caption={fmtDate(model.date, locale, { day: "numeric", month: "numeric", year: "numeric" })} />
              </div>
            </div>
          </Sec>
        );
      case "story":
        return (
          <Sec key="story" s={s} className="px-5 pb-24 @3xl:px-10 @3xl:pb-28">
            <div className="mx-auto grid max-w-[1100px] items-center gap-14 @3xl:grid-cols-[1fr_1.1fr] @3xl:gap-20">
              <div className="mx-auto w-[82%] max-w-[420px] @3xl:w-full">
                <Print path={s.content.photos[0] ?? null} onPath={(p) => update(s, { photos: setAt(s.content.photos, 0, p) })} />
              </div>
              <Card seed={11} rotate={1.2}>
                <div className="px-8 py-12 @md:px-14 @md:py-14" style={{ backgroundImage: "repeating-linear-gradient(transparent 0 37px, rgba(31,42,68,.12) 37px 38px)", backgroundPosition: "0 96px" }}>
                  <Title s={s} className="text-[clamp(46px,9cqw,64px)] leading-none" style={script} />
                  <RichText type="story" field="text" value={s.content.text} className="mt-8 text-[20px] leading-[38px] @md:text-[22px]" />
                  <p className="mt-6 text-right text-[28px]" style={script}>
                    {model.partner1} &amp; {model.partner2}
                  </p>
                </div>
              </Card>
            </div>
            <MorePhotos s={s} />
          </Sec>
        );
      case "schedule":
        return (
          <Sec key="schedule" s={s} className="flex justify-center px-5 pb-24 @3xl:pb-28">
            <Card seed={5} rotate={-1} className="w-full max-w-[580px]">
              <div className="px-8 py-14 text-center @md:px-16">
                <Title s={s} className="text-[clamp(46px,9cqw,60px)] leading-none" style={script} />
                {model.date ? <p className="mt-3 italic opacity-70">{fmtDate(model.date, locale, { weekday: "long", day: "numeric", month: "long" })}</p> : null}
                <RichText type="schedule" field="intro" value={s.content.intro} className="mx-auto mt-5 max-w-[40ch] text-[18px] italic opacity-80" placeholder="Úvod k programu (nepovinné)" />
                <ol className="mt-10 flex flex-col gap-7 text-left">
                  {model.events.map((e) => {
                    const t = when(e, locale, model.timeZone);
                    const a = address(e);
                    return (
                      <li key={e.id}>
                        <div className="flex items-baseline gap-3 text-[21px] @md:text-[24px]">
                          <span>{e.name}</span>
                          <span className="flex-1 translate-y-[-5px] border-b border-dotted" style={{ borderColor: `${ink}66` }} />
                          {t.time ? <span className="tabular-nums" style={{ fontFamily: FONTS.bodoni }}>{t.time}</span> : null}
                        </div>
                        {e.plan_b_active ? <p className="text-[15px] font-medium" style={{ color: wax }}>{locale === "cs" ? "Kvůli počasí jinde" : "Moved due to weather"}</p> : null}
                        <p className="text-[17px] italic opacity-70">
                          {[place(e), a].filter(Boolean).join(", ")}
                          {a ? (
                            <>
                              {" "}
                              <a href={mapUrl(a)} target="_blank" rel="noreferrer" className="not-italic underline underline-offset-4">
                                {locale === "cs" ? "mapa" : "map"}
                              </a>
                            </>
                          ) : null}
                        </p>
                        {e.description ? <p className="mt-1 whitespace-pre-line text-[16px] opacity-80">{e.description}</p> : null}
                      </li>
                    );
                  })}
                </ol>
                <EventsHint />
                <div className="mt-12 flex justify-center">
                  <Seal size={64} letters={letters} />
                </div>
              </div>
            </Card>
          </Sec>
        );
      case "location":
      case "dresscode":
      case "accommodation": {
        const i = ["location", "dresscode", "accommodation"].indexOf(s.type);
        return (
          <Sec key={s.type} s={s} className="flex justify-center px-5 pb-20">
            <Card seed={20 + i} rotate={[1.2, -1.4, 0.8][i]} className="w-full max-w-[640px]">
              <div className="px-8 py-12 @md:px-14">
                <Title s={s} className="text-center text-[clamp(42px,8cqw,56px)] leading-none" style={script} />
                {s.type === "location" ? <SitePhoto path={s.content.photo} onPath={(p) => update(s, { photo: p })} className="mt-8 aspect-[16/9]" placeholder={<div className="absolute inset-0" style={{ background: "linear-gradient(160deg,#e8e2d6,#c9bfae)" }} />} /> : null}
                <RichText type={s.type} field="text" value={textOf(s)} className="mt-8 text-[19px] leading-relaxed @md:text-[21px]" />
              </div>
            </Card>
          </Sec>
        );
      }
      case "gifts":
        return (
          <Sec key="gifts" s={s} className="flex justify-center px-5 pb-20">
            <Card seed={31} rotate={-0.8} className="w-full max-w-[640px]">
              <div className="flex flex-col gap-8 px-8 py-12 @md:px-14">
                <Title s={s} className="text-center text-[clamp(42px,8cqw,56px)] leading-none" style={script} />
                <RichText type="gifts" field="text" value={s.content.text} className="text-[19px] leading-relaxed @md:text-[21px]" />
                <GiftAccount model={model} s={s} className="border-t pt-8" style={{ borderColor: `${ink}22` }} />
              </div>
            </Card>
          </Sec>
        );
      case "faq":
        return (
          <Sec key="faq" s={s} className="flex justify-center px-5 pb-20">
            <Card seed={41} rotate={0.6} className="w-full max-w-[720px]">
              <div className="px-8 py-12 @md:px-14">
                <Title s={s} className="mb-8 text-center text-[clamp(42px,8cqw,56px)] leading-none" style={script} />
                <FaqList s={s} qClass="text-[20px] @md:text-[22px]" aClass="text-[18px] opacity-80" lineColor={`${ink}22`} accent={wax} />
              </div>
            </Card>
          </Sec>
        );
      case "contacts":
        return (
          <Sec key="contacts" s={s} className="px-5 pb-20">
            <Title s={s} className="mb-10 block text-center text-[clamp(42px,8cqw,56px)] leading-none" style={script} />
            <ContactList
              s={s}
              className="mx-auto grid max-w-[900px] gap-6 @2xl:grid-cols-2"
              itemClass="bg-[#f8f6f1] px-8 py-7 text-[18px] shadow-[0_14px_24px_rgba(40,30,20,.18)]"
              nameClass="text-[24px]"
              accent={ink}
            />
          </Sec>
        );
      case "rsvp":
        return (
          <Sec key="rsvp" s={s} id="rsvp" className="flex justify-center px-5 pb-28">
            <Card seed={51} rotate={-0.5} className="w-full max-w-[720px]">
              <div className="relative px-6 py-12 @md:px-14 @md:py-14">
                <div className="absolute right-5 top-5 hidden rotate-[6deg] p-1.5 @md:block" style={{ background: "#f8f6f1", outline: `2px dashed ${ink}55`, outlineOffset: "-1px" }} aria-hidden>
                  <div className="grid size-16 place-items-center" style={{ background: "#9fb0c4" }}>
                    <span className="text-[22px] text-white" style={script}>
                      {letters}
                    </span>
                  </div>
                </div>
                <Title s={s} className="text-center text-[clamp(42px,8cqw,56px)] leading-none" style={script} />
                <RichText type="rsvp" field="intro" value={s.content.intro} className="mx-auto mt-5 max-w-[40ch] text-center text-[19px] italic opacity-80" placeholder="Úvod nad formulářem (nepovinné)" />
                <div className="mt-10" style={{ fontFamily: FONTS.instrument }}>
                  <RsvpSlot model={model} />
                </div>
              </div>
            </Card>
          </Sec>
        );
    }
  };

  const { update: upd } = useEdit();
  function update(s: Section, patch: Record<string, unknown>) {
    upd(s.type, patch);
  }

  return (
    <div className="@container min-h-svh overflow-hidden" style={{ ...linen, color: ink, fontFamily: FONTS.instrument }}>
      {model.banner}
      {sections.map(render)}
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
        <Print key={i} path={p} onPath={(np) => update("story", { photos: setAt(s.content.photos, i + 1, np) })} rotate={[-3, 2, -1.5, 3, -2][i % 5]} tape={i % 2 === 0} />
      ))}
    </div>
  );
}
