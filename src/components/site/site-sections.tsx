import Image from "next/image";
import QRCode from "qrcode";
import type { ReactNode } from "react";
import type { Locale } from "@/lib/i18n";
import { photoUrl } from "@/lib/media";
import { formatIban, spayd } from "@/lib/payment-qr";
import type { PublicWedding, SiteContent, SiteEvent } from "@/lib/site";
import { GIFT_COPY, SECTION_TITLES } from "@/lib/site-copy";
import { lt, type Section } from "@/lib/site-sections";
import { SiteHero } from "./site-hero";
import { SiteSchedule } from "./site-schedule";
import { siteHeading } from "./site-shell";

type Props = {
  wedding: PublicWedding;
  content: SiteContent;
  events: SiteEvent[];
  locale: Locale;
  /** Obsah sekce Potvrzení účasti (kód z pozvánky, nebo formulář domácnosti) */
  rsvp: ReactNode;
  /** Sekce, které jsou skryté za heslem */
  hidden?: string[];
};

function Prose({ text }: { text: string }) {
  return (
    <div className="flex flex-col gap-4 text-lg leading-relaxed">
      {text
        .split(/\n{2,}/)
        .filter((p) => p.trim())
        .map((p, i) => (
          <p key={i} className="whitespace-pre-line">{p}</p>
        ))}
    </div>
  );
}

function Block({ title, children, wide }: { title: string; children: ReactNode; wide?: boolean }) {
  return (
    <section className={`mx-auto flex w-full flex-col gap-8 px-6 py-16 sm:py-20 ${wide ? "max-w-4xl" : "max-w-2xl"}`}>
      <h2 style={siteHeading} className="text-center text-4xl sm:text-5xl">{title}</h2>
      {children}
    </section>
  );
}

const muted = { color: "var(--site-muted)" };

export async function SiteSections({ wedding, content, events, locale, rsvp, hidden = [] }: Props) {
  const titles = SECTION_TITLES[locale];
  const first = events.find((e) => e.location_name);
  const visible = content.sections.filter((s) => s.enabled && !hidden.includes(s.type));

  const giftQr = content.gifts.iban
    ? await QRCode.toString(spayd({ iban: content.gifts.iban, message: GIFT_COPY[locale].message }), {
        type: "svg",
        margin: 0,
        errorCorrectionLevel: "M",
      })
    : null;

  const render = (s: Section): ReactNode => {
    switch (s.type) {
      case "hero": {
        const url = photoUrl(s.content.photo);
        const intro = lt(s.content.intro, locale);
        return (
          <div key="hero">
            <SiteHero
              partner1={wedding.partner1_name}
              partner2={wedding.partner2_name}
              date={wedding.wedding_date}
              place={first?.location_name ?? null}
              template={content.template}
              locale={locale}
              short={!!url || !!intro}
            />
            {url ? (
              <div className="mx-auto w-full max-w-4xl px-6">
                <div className="relative aspect-[3/2] w-full overflow-hidden rounded-sm">
                  <Image src={url} alt="" fill priority sizes="(min-width: 896px) 848px, 100vw" className="object-cover" />
                </div>
              </div>
            ) : null}
            {intro ? (
              <div className="mx-auto max-w-xl px-6 pt-12 text-center">
                <Prose text={intro} />
              </div>
            ) : null}
          </div>
        );
      }
      case "schedule": {
        const intro = lt(s.content.intro, locale);
        return (
          <div key="schedule">
            {intro ? (
              <div className="mx-auto max-w-2xl px-6 pt-16 text-center" style={muted}>
                <Prose text={intro} />
              </div>
            ) : null}
            <SiteSchedule events={events} locale={locale} timeZone={wedding.timezone} />
          </div>
        );
      }
      case "location":
      case "dresscode":
      case "accommodation": {
        const text = lt(s.content.text, locale);
        if (!text) return null;
        return (
          <Block key={s.type} title={titles[s.type]}>
            <Prose text={text} />
          </Block>
        );
      }
      case "story": {
        const text = lt(s.content.text, locale);
        const photos = s.content.photos.map(photoUrl).filter((u): u is string => !!u);
        if (!text && photos.length === 0) return null;
        return (
          <Block key="story" title={titles.story} wide={photos.length > 1}>
            {text ? (
              <div className="mx-auto max-w-2xl">
                <Prose text={text} />
              </div>
            ) : null}
            {photos.length ? (
              <div className={`grid gap-3 ${photos.length > 1 ? "sm:grid-cols-2" : ""}`}>
                {photos.map((u) => (
                  <div key={u} className="relative aspect-[4/5] overflow-hidden rounded-sm">
                    <Image src={u} alt="" fill sizes="(min-width: 640px) 420px, 100vw" className="object-cover" />
                  </div>
                ))}
              </div>
            ) : null}
          </Block>
        );
      }
      case "gifts": {
        const text = lt(s.content.text, locale);
        const showAccount = s.content.show_account && content.gifts.iban;
        if (!text && !showAccount) return null;
        const g = GIFT_COPY[locale];
        return (
          <Block key="gifts" title={titles.gifts}>
            {text ? <Prose text={text} /> : null}
            {showAccount ? (
              <div className="flex flex-col items-center gap-4 rounded-sm border px-6 py-8 text-center sm:flex-row sm:text-left" style={{ borderColor: "var(--site-line)" }}>
                {giftQr ? <div className="w-36 shrink-0 rounded-sm bg-white p-2" dangerouslySetInnerHTML={{ __html: giftQr }} /> : null}
                <div className="flex flex-col gap-1">
                  <span className="text-sm" style={muted}>{g.account}</span>
                  <span className="font-mono text-lg">{formatIban(content.gifts.iban!)}</span>
                  {content.gifts.holder ? <span style={muted}>{g.holder}: {content.gifts.holder}</span> : null}
                  <span className="mt-2 text-sm" style={muted}>{g.qr}</span>
                </div>
              </div>
            ) : null}
          </Block>
        );
      }
      case "faq": {
        const items = s.content.items.filter((i) => lt(i.q, locale));
        if (!items.length) return null;
        return (
          <Block key="faq" title={titles.faq}>
            <div className="flex flex-col">
              {items.map((i, n) => (
                <details key={n} className="group border-t py-5 last:border-b" style={{ borderColor: "var(--site-line)" }}>
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-lg font-medium">
                    {lt(i.q, locale)}
                    <span aria-hidden className="transition-transform group-open:rotate-45" style={{ color: "var(--site-accent)" }}>+</span>
                  </summary>
                  <div className="pt-3" style={muted}>
                    <Prose text={lt(i.a, locale)} />
                  </div>
                </details>
              ))}
            </div>
          </Block>
        );
      }
      case "contacts": {
        const items = s.content.items.filter((i) => i.name);
        if (!items.length) return null;
        return (
          <Block key="contacts" title={titles.contacts}>
            <ul className="grid gap-6 sm:grid-cols-2">
              {items.map((i, n) => (
                <li key={n} className="flex flex-col gap-1 text-center sm:text-left">
                  <span className="text-xl font-medium">{i.name}</span>
                  {lt(i.role, locale) ? <span style={muted}>{lt(i.role, locale)}</span> : null}
                  {i.phone ? (
                    <a href={`tel:${i.phone.replace(/\s+/g, "")}`} className="underline underline-offset-2" style={{ color: "var(--site-accent)" }}>
                      {i.phone}
                    </a>
                  ) : null}
                  {i.email ? (
                    <a href={`mailto:${i.email}`} className="underline underline-offset-2" style={{ color: "var(--site-accent)" }}>
                      {i.email}
                    </a>
                  ) : null}
                </li>
              ))}
            </ul>
          </Block>
        );
      }
      case "rsvp": {
        const intro = lt(s.content.intro, locale);
        return (
          <section key="rsvp" id="rsvp" className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-6 py-16 sm:py-20">
            <h2 style={siteHeading} className="text-center text-4xl sm:text-5xl">{titles.rsvp}</h2>
            {intro ? (
              <div className="text-center" style={muted}>
                <Prose text={intro} />
              </div>
            ) : null}
            {rsvp}
          </section>
        );
      }
    }
  };

  return <>{visible.map(render)}</>;
}
