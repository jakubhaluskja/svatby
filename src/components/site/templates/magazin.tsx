"use client";

import type { CSSProperties, ReactNode } from "react";
import { FONTS } from "@/lib/templates";
import type { Section } from "@/lib/site-sections";
import { LineText, RichText, Sec, SitePhoto, useEdit } from "../edit";
import type { SiteModel } from "../model";
import { ContactList, EventsHint, FaqList, GiftAccount, RsvpSlot, SANS, Title, address, daysLeft, daysWord, defaultTitle, fmtDate, mapUrl, place, textOf, useSections, when } from "./shared";

const red = "#c3122f";
const ink = "#141414";
const bodoni: CSSProperties = { fontFamily: FONTS.bodoni };

function Barcode({ text }: { text: string }) {
  const bars = [3, 1, 2, 1, 1, 3, 1, 2, 2, 1, 3, 1, 1, 2, 1, 3, 2, 1, 1, 2, 3, 1, 2, 1, 1, 3, 1, 1, 2, 2];
  let x = 0;
  return (
    <div className="bg-white px-3 pb-1 pt-2" aria-hidden>
      <svg viewBox="0 0 90 40" className="h-10 w-24 @3xl:h-12 @3xl:w-28">
        {bars.map((w, i) => {
          const r = i % 2 ? null : <rect key={i} x={x} y="0" width={w} height="40" fill={ink} />;
          x += w + 0.6;
          return r;
        })}
      </svg>
      <p className="text-center text-[10px] tracking-[0.2em] text-black" style={{ fontFamily: SANS }}>
        {text}
      </p>
    </div>
  );
}

const WORDS = {
  cs: { issue: "Vydání pro svatební hosty", free: "Zdarma, s láskou", tagline: "Velké ano", toDays: "do svatby", reply: "Potvrďte účast", by: "do", contents: "Obsah", contentsIntro: "Svatební číslo, které vychází jen jednou.", feature: "Reportáž", today: "Dnes" },
  en: { issue: "The wedding guest issue", free: "Free, with love", tagline: "The big yes", toDays: "to go", reply: "RSVP", by: "by", contents: "Contents", contentsIntro: "A wedding issue published only once.", feature: "Feature", today: "Today" },
};

export function MagazinSite({ model }: { model: SiteModel }) {
  const { locale, update, editing } = useEdit();
  const sections = useSections(model);
  const w = WORDS[locale];
  const masthead = `${model.partner1}&${model.partner2}`.toUpperCase();
  const mastSize = `min(${(132 / Math.max(6, masthead.length)).toFixed(2)}cqw, 210px)`;
  const days = daysLeft(model.date);
  const first = model.events[0];
  const t0 = first ? when(first, locale, model.timeZone) : null;
  const toc = sections.filter((s) => s.type !== "hero");
  const deadline = model.rsvpDeadline ? new Intl.DateTimeFormat(locale === "cs" ? "cs-CZ" : "en-GB", { day: "numeric", month: "long", timeZone: model.timeZone }).format(new Date(model.rsvpDeadline)) : null;
  const titleOf = (s: Section) => {
    const v = (s.content as { title?: { cs: string; en: string } }).title;
    return (locale === "en" ? v?.en || v?.cs : v?.cs || v?.en) || defaultTitle(s.type, locale);
  };

  const render = (s: Section): ReactNode => {
    switch (s.type) {
      case "hero": {
        const hasPhoto = !!s.content.photo;
        return (
          <Sec key="hero" s={s}>
            <div className="relative mx-auto h-[min(1060px,165cqw)] min-h-[620px] max-w-[1440px] overflow-hidden" style={{ background: "#e7e2da" }}>
              <SitePhoto path={s.content.photo} onPath={(p) => update("hero", { photo: p })} priority sizes="100vw" className="absolute inset-0" placeholder={<div className="absolute inset-0" style={{ background: "radial-gradient(110% 80% at 60% 20%, #f2f2f2, #9a9a9a 55%, #2a2a2a)" }} />} />
              {hasPhoto || editing ? <div className="pointer-events-none absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(0,0,0,.18) 0%, transparent 30%, transparent 55%, rgba(0,0,0,.55) 100%)" }} /> : null}
              {!hasPhoto && !editing && model.date ? (
                <p aria-hidden className="pointer-events-none absolute inset-x-0 top-[30%] text-center leading-none tracking-[-0.05em]" style={{ ...bodoni, color: red, fontSize: "min(34cqw, 420px)" }}>
                  {Number(model.date.slice(8, 10))}.{Number(model.date.slice(5, 7))}.
                </p>
              ) : null}
              <div className={`pointer-events-none absolute inset-0 ${hasPhoto || editing ? "text-white" : "text-[#141414]"}`}>
                <h1 className="absolute inset-x-0 top-[1.5cqw] text-center font-bold leading-none tracking-[-0.04em]" style={{ ...bodoni, fontSize: mastSize }}>
                  {masthead}
                </h1>
                <div className="absolute inset-x-4 top-[calc(1.5cqw+min(14cqw,200px))] flex justify-between text-[11px] @3xl:inset-x-10 @3xl:text-[15px]" style={{ fontFamily: SANS }}>
                  <span>{w.issue}</span>
                  <span className="hidden @md:inline">{fmtDate(model.date, locale, { month: "long", year: "numeric" })}</span>
                  <span>{w.free}</span>
                </div>
              </div>
              <div className={`absolute bottom-[160px] left-4 w-[min(360px,80%)] @3xl:bottom-auto @3xl:left-10 @3xl:top-[34%] ${hasPhoto || editing ? "text-white" : "text-[#141414]"}`}>
                <LineText type="hero" field="tagline" value={s.content.tagline} fallback={w.tagline} as="p" className="text-[clamp(40px,7cqw,64px)] italic leading-[0.92]" style={bodoni} />
                <p className="mt-3 text-[16px] leading-snug @3xl:text-[19px]" style={{ fontFamily: SANS }}>
                  {[fmtDate(model.date, locale, { weekday: "long", day: "numeric", month: "long" }), first ? place(first) : null].filter(Boolean).join(", ")}
                </p>
                <RichText type="hero" field="intro" value={s.content.intro} className="mt-3 text-[15px] leading-snug opacity-90 @3xl:text-[17px]" style={{ fontFamily: SANS }} placeholder="Krátký úvod (nepovinné)" />
              </div>
              <div className={`absolute right-10 top-[36%] hidden w-[300px] flex-col gap-8 text-right @4xl:flex ${hasPhoto || editing ? "text-white" : "text-[#141414]"}`} style={bodoni}>
                {t0?.time ? (
                  <div>
                    <p className="text-[44px] leading-none" style={{ color: hasPhoto || editing ? "#ffd2d8" : red }}>
                      {t0.time}
                    </p>
                    <p className="text-[22px] italic">{[first?.name, first ? place(first) : null].filter(Boolean).join(", ")}</p>
                  </div>
                ) : null}
                {toc.slice(1, 3).map((s2) => (
                  <a key={s2.type} href={`#${s2.type}`} className="pointer-events-auto text-[22px] leading-tight hover:underline">
                    {titleOf(s2)}
                  </a>
                ))}
              </div>
              <div className="absolute bottom-6 left-4 flex items-end gap-4 @3xl:bottom-10 @3xl:left-10 @3xl:gap-6">
                {days !== null && days >= 0 ? (
                  <span className="grid size-[110px] -rotate-12 place-items-center rounded-full text-center text-white @3xl:size-[150px]" style={{ background: red, ...bodoni }}>
                    <span>
                      <span className="block text-[34px] leading-none @3xl:text-[46px]">{days === 0 ? w.today : days}</span>
                      {days > 0 ? <span className="block text-[13px] italic @3xl:text-[16px]">{daysWord(days, locale)} {w.toDays}</span> : null}
                    </span>
                  </span>
                ) : null}
                {deadline ? (
                  <a href="#rsvp" className={`max-w-[220px] pb-2 text-[18px] leading-tight @3xl:max-w-[300px] @3xl:pb-4 @3xl:text-[26px] ${hasPhoto || editing ? "text-white" : "text-[#141414]"}`} style={bodoni}>
                    {w.reply} {w.by} {deadline}.
                  </a>
                ) : null}
              </div>
              {model.date ? (
                <div className="absolute bottom-6 right-4 hidden @md:block @3xl:bottom-10 @3xl:right-10">
                  <Barcode text={model.date.split("-").reverse().join(" ")} />
                </div>
              ) : null}
            </div>
            {toc.length > 1 ? (
              <nav aria-label={w.contents} className="mx-auto grid max-w-[1280px] gap-10 px-5 py-20 @3xl:grid-cols-[1fr_1.4fr] @3xl:gap-20 @3xl:px-16 @3xl:py-24">
                <div>
                  <p className="text-[clamp(72px,12cqw,120px)] leading-[0.85] tracking-[-0.04em]" style={bodoni}>
                    {w.contents}
                  </p>
                  <p className="mt-6 max-w-[30ch] text-[20px] italic leading-snug">{w.contentsIntro}</p>
                </div>
                <ol className="flex flex-col">
                  {toc.map((s2, i) => (
                    <li key={s2.type} className="border-t last:border-b" style={{ borderColor: ink }}>
                      <a href={`#${s2.type}`} className="grid grid-cols-[3.5rem_1fr] items-baseline py-4 @3xl:grid-cols-[4.5rem_1fr]">
                        <span className="text-[36px] leading-none tabular-nums @3xl:text-[44px]" style={{ ...bodoni, color: red }}>
                          {String(i * 2 + 3).padStart(2, "0")}
                        </span>
                        <span className="text-[24px] leading-tight @3xl:text-[30px]" style={bodoni}>
                          {titleOf(s2)}
                        </span>
                      </a>
                    </li>
                  ))}
                </ol>
              </nav>
            ) : null}
          </Sec>
        );
      }
      case "story":
        return (
          <Sec key="story" s={s} className="mx-auto max-w-[1280px] px-5 pb-24 @3xl:px-16">
            <div className="grid gap-10 @3xl:grid-cols-[1.2fr_1fr] @3xl:gap-14">
              <SitePhoto path={s.content.photos[0] ?? null} onPath={(p) => update("story", { photos: setAt(s.content.photos, 0, p) })} className="aspect-[4/5]" placeholder={<div className="absolute inset-0" style={{ background: "radial-gradient(110% 80% at 60% 20%,#f6e2c8,#d9a87f 50%,#7a4f3a)" }} />} />
              <div className="flex flex-col">
                <p className="text-[18px] italic" style={{ color: red }}>
                  {w.feature}
                </p>
                <Title s={s} className="mt-3 text-[clamp(52px,9cqw,82px)] leading-[0.9] tracking-[-0.03em]" style={bodoni} />
                <RichText type="story" field="text" value={s.content.text} className="mag-dropcap mt-8 text-[20px] leading-[1.6] @3xl:text-[21px]" />
              </div>
            </div>
            <StripPhotos s={s} />
          </Sec>
        );
      case "schedule":
        return (
          <Sec key="schedule" s={s} className="px-5 py-20 text-white @3xl:px-16 @3xl:py-24" style={{ background: ink }}>
            <div className="mx-auto max-w-[1280px]">
              <Title s={s} className="text-[clamp(72px,12cqw,120px)] leading-none tracking-[-0.04em]" style={bodoni} />
              <RichText type="schedule" field="intro" value={s.content.intro} className="mt-4 max-w-[50ch] text-[20px] italic text-white/75" placeholder="Úvod k programu (nepovinné)" />
              <div className="mt-12 grid border-t border-white/30 @xl:grid-cols-2 @5xl:grid-cols-4">
                {model.events.map((e, i) => {
                  const t = when(e, locale, model.timeZone);
                  const a = address(e);
                  return (
                    <div key={e.id} className="border-b border-white/20 py-8 @xl:pr-6 @5xl:border-b-0 @5xl:border-r @5xl:last:border-r-0 @5xl:[&:not(:first-child)]:pl-6">
                      {t.time ? (
                        <p className="text-[64px] leading-none tabular-nums" style={{ ...bodoni, color: i === 0 ? "#ff5b72" : "white" }}>
                          {t.time}
                        </p>
                      ) : null}
                      <p className="mt-5 text-[28px] italic" style={bodoni}>
                        {e.name}
                      </p>
                      {e.plan_b_active ? <p className="text-[14px] text-[#ff8a9a]">{locale === "cs" ? "Kvůli počasí jinde" : "Moved due to weather"}</p> : null}
                      <p className="mt-1 text-[16px] text-white/65" style={{ fontFamily: SANS }}>
                        {place(e)}
                      </p>
                      {a ? (
                        <a href={mapUrl(a)} target="_blank" rel="noreferrer" className="text-[14px] text-white/65 underline underline-offset-4" style={{ fontFamily: SANS }}>
                          {a}
                        </a>
                      ) : null}
                    </div>
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
      case "gifts":
        return (
          <Sec key={s.type} s={s} className="mx-auto max-w-[1280px] px-5 py-16 @3xl:px-16 @3xl:py-20">
            {s.type === "location" ? <SitePhoto path={s.content.photo} onPath={(p) => update("location", { photo: p })} sizes="100vw" className="mb-12 aspect-[21/9]" placeholder={<div className="absolute inset-0" style={{ background: "radial-gradient(110% 80% at 60% 20%,#eef1e8,#a9b9a0 50%,#4c5d47)" }} />} /> : null}
            <div className="grid gap-8 border-t pt-8 @3xl:grid-cols-[1fr_1.4fr] @3xl:gap-20" style={{ borderColor: ink }}>
              <Title s={s} className="text-[clamp(48px,8cqw,76px)] leading-[0.92] tracking-[-0.03em]" style={bodoni} />
              <div>
                <RichText type={s.type} field="text" value={textOf(s)} className="text-[20px] leading-[1.6] @3xl:text-[22px]" />
                {s.type === "gifts" ? <GiftAccount model={model} s={s} className="mt-10 border p-6" style={{ borderColor: red }} /> : null}
              </div>
            </div>
          </Sec>
        );
      case "faq":
        return (
          <Sec key="faq" s={s} className="mx-auto max-w-[1280px] px-5 py-16 @3xl:px-16 @3xl:py-20">
            <div className="grid gap-8 border-t pt-8 @3xl:grid-cols-[1fr_1.4fr] @3xl:gap-20" style={{ borderColor: ink }}>
              <Title s={s} className="text-[clamp(48px,8cqw,76px)] leading-[0.92] tracking-[-0.03em]" style={bodoni} />
              <FaqList s={s} qClass="text-[22px] @3xl:text-[26px]" aClass="text-[19px] opacity-80" lineColor="#d9d9d9" accent={red} />
            </div>
          </Sec>
        );
      case "contacts":
        return (
          <Sec key="contacts" s={s} className="mx-auto max-w-[1280px] px-5 py-16 @3xl:px-16 @3xl:py-20">
            <div className="grid gap-8 border-t pt-8 @3xl:grid-cols-[1fr_1.4fr] @3xl:gap-20" style={{ borderColor: ink }}>
              <Title s={s} className="text-[clamp(48px,8cqw,76px)] leading-[0.92] tracking-[-0.03em]" style={bodoni} />
              <ContactList s={s} className="grid gap-8 @xl:grid-cols-2" itemClass="text-[19px]" nameClass="text-[28px]" accent={red} />
            </div>
          </Sec>
        );
      case "rsvp":
        return (
          <Sec key="rsvp" s={s} id="rsvp" className="border-t-[10px] px-5 py-20 @3xl:px-16 @3xl:py-24" style={{ borderColor: red }}>
            <div className="mx-auto max-w-[760px]">
              <Title s={s} className="block text-center text-[clamp(56px,10cqw,96px)] leading-none tracking-[-0.03em]" style={bodoni} />
              <RichText type="rsvp" field="intro" value={s.content.intro} className="mx-auto mt-5 max-w-[46ch] text-center text-[21px] italic" placeholder="Úvod nad formulářem (nepovinné)" />
              <div className="mt-12">
                <RsvpSlot model={model} />
              </div>
            </div>
          </Sec>
        );
    }
  };

  return (
    <div className="@container min-h-svh overflow-hidden bg-white" style={{ color: ink, fontFamily: FONTS.instrument }}>
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

function StripPhotos({ s }: { s: Extract<Section, { type: "story" }> }) {
  const { editing, update } = useEdit();
  const rest = s.content.photos.slice(1);
  if (!rest.length && !editing) return null;
  const slots = editing && s.content.photos.length < 6 ? [...rest, null] : rest;
  return (
    <div className="mt-6 grid grid-cols-2 gap-4 @3xl:grid-cols-5">
      {slots.map((p, i) => (
        <SitePhoto key={i} path={p} onPath={(np) => update("story", { photos: setAt(s.content.photos, i + 1, np) })} className="aspect-square" placeholder={<div className="absolute inset-0 bg-[#e7e2da]" />} />
      ))}
    </div>
  );
}
