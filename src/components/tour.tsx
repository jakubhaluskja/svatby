"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { markTourDone } from "@/app/app/tour-actions";

type Step = {
  /** Cíle podle priority (data-tour); první viditelný se zvýrazní. Bez cíle = karta uprostřed. */
  targets: string[];
  title: string;
  text: string;
  /** Text, když je cílem tlačítko menu na mobilu */
  mobileText?: string;
};

const STEPS: Step[] = [
  { targets: [], title: "Vítejte ve svatebním plánovači", text: "Za minutu vám ukážeme, kde co najdete. Průvodce můžete kdykoli přeskočit a spustit znovu." },
  { targets: ["wedding"], title: "Vaše svatba", text: "Jména a datum. Odpočet do svatby a nejbližší úkoly uvidíte na přehledu." },
  {
    targets: ["nav-plan", "menu-button"],
    title: "Plánování",
    text: "Checklist s termíny, výběr místa, harmonogram dne a rozpočet. Platby se samy propíšou do úkolů.",
    mobileText: "V menu najdete checklist, výběr místa, harmonogram a rozpočet.",
  },
  {
    targets: ["nav-guests", "menu-button"],
    title: "Hosté",
    text: "Seznam hostů po domácnostech, potvrzování účasti, zasedací pořádek, ubytování a tiskoviny.",
    mobileText: "V menu jsou také hosté, zasedací pořádek, ubytování a tiskoviny.",
  },
  {
    targets: ["nav-web", "menu-button"],
    title: "Pro hosty",
    text: "Svatební web s potvrzením účasti, seznam darů a fotogalerie, kam hosté nahrají fotky přes QR kód.",
    mobileText: "Svatební web, dary a fotogalerie pro hosty najdete taky v menu.",
  },
  { targets: ["first-steps", "stats"], title: "Kde začít", text: "Doporučené první kroky. Odškrtávají se samy, jakmile je uděláte." },
  {
    targets: ["nav-settings", "menu-button"],
    title: "Tým a telefon",
    text: "Pozvěte partnera, svědky nebo rodiče a přidejte si aplikaci na plochu telefonu a termíny do kalendáře.",
    mobileText: "V menu pozvete partnera a další pomocníky a přidáte si aplikaci na plochu.",
  },
  { targets: ["tour-link", "menu-button"], title: "Průvodce kdykoli znovu", text: "Tímto odkazem průvodce spustíte znovu. Hodně štěstí s přípravami!", mobileText: "Průvodce spustíte znovu odkazem v menu. Hodně štěstí s přípravami!" },
];

export const TOUR_EVENT = "svatby:tour";

function visible(el: Element | null): el is HTMLElement {
  if (!(el instanceof HTMLElement)) return false;
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== "hidden";
}

function findTarget(step: Step): { el: HTMLElement | null; key: string | null } {
  for (const key of step.targets) {
    const el = Array.from(document.querySelectorAll(`[data-tour="${key}"]`)).find(visible) ?? null;
    if (el) return { el, key };
  }
  return { el: null, key: null };
}

type Box = { top: number; left: number; width: number; height: number };
const PAD = 8;

/** Průvodce aplikací: zvýrazní část stránky, zbytek ztmaví. Poprvé se spustí sám. */
export function AppTour({ autoStart, home = "/app" }: { autoStart: boolean; home?: string }) {
  const pathname = usePathname();
  const params = useSearchParams();
  const router = useRouter();
  const [index, setIndex] = useState<number | null>(null);
  const [box, setBox] = useState<Box | null>(null);
  const [targetKey, setTargetKey] = useState<string | null>(null);
  const [card, setCard] = useState<{ top: number; left: number } | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const started = useRef(false);

  const start = useCallback(() => {
    if (pathname !== home) {
      router.push(`${home}?pruvodce=1`);
      return;
    }
    setIndex(0);
  }, [pathname, router, home]);

  // Automaticky poprvé (jen na přehledu), nebo přes ?pruvodce=1.
  useEffect(() => {
    if (started.current || pathname !== home) return;
    if (params.get("pruvodce") === "1" || autoStart) {
      started.current = true;
      const id = setTimeout(() => setIndex(0), 400);
      return () => clearTimeout(id);
    }
  }, [autoStart, params, pathname, home]);

  useEffect(() => {
    const on = () => start();
    window.addEventListener(TOUR_EVENT, on);
    return () => window.removeEventListener(TOUR_EVENT, on);
  }, [start]);

  const finish = useCallback(() => {
    setIndex(null);
    setBox(null);
    void markTourDone();
    if (params.get("pruvodce")) router.replace(home);
  }, [params, router, home]);

  const step = index === null ? null : STEPS[index];

  // Pozice zvýraznění a karty.
  const measure = useCallback(() => {
    if (!step) return;
    const { el, key } = findTarget(step);
    setTargetKey(key);
    if (!el) {
      setBox(null);
      setCard(null);
      return;
    }
    const r = el.getBoundingClientRect();
    const b = { top: r.top - PAD, left: r.left - PAD, width: r.width + PAD * 2, height: r.height + PAD * 2 };
    setBox(b);
    const cw = Math.min(360, window.innerWidth - 32);
    const ch = cardRef.current?.offsetHeight ?? 200;
    let top: number;
    let left: number;
    if (b.left + b.width + 16 + cw <= window.innerWidth - 16) {
      // vpravo od cíle
      left = b.left + b.width + 16;
      top = Math.min(Math.max(16, b.top), window.innerHeight - ch - 16);
    } else if (b.top + b.height + 16 + ch <= window.innerHeight - 16) {
      left = Math.min(Math.max(16, b.left), window.innerWidth - cw - 16);
      top = b.top + b.height + 16;
    } else {
      left = Math.min(Math.max(16, b.left), window.innerWidth - cw - 16);
      top = Math.max(16, b.top - ch - 16);
    }
    setCard({ top, left });
  }, [step]);

  useLayoutEffect(() => {
    if (!step) return;
    const { el } = findTarget(step);
    if (el) {
      const r = el.getBoundingClientRect();
      if (r.top < 0 || r.bottom > window.innerHeight) el.scrollIntoView({ block: "center", behavior: "instant" as ScrollBehavior });
    }
    measure();
    const id = requestAnimationFrame(measure);
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      cancelAnimationFrame(id);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [step, measure]);

  useEffect(() => {
    if (index === null) return;
    cardRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") finish();
      if (e.key === "ArrowRight") setIndex((i) => (i === null ? i : Math.min(STEPS.length - 1, i + 1)));
      if (e.key === "ArrowLeft") setIndex((i) => (i === null ? i : Math.max(0, i - 1)));
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [index, finish]);

  if (index === null || !step) return null;
  const last = index === STEPS.length - 1;
  const text = targetKey === "menu-button" && step.mobileText ? step.mobileText : step.text;

  return (
    <div className="fixed inset-0 z-[70] print:hidden">
      {/* Zachytí kliknutí mimo kartu */}
      <div className="absolute inset-0" aria-hidden onClick={(e) => e.stopPropagation()} />
      {box ? (
        <div
          aria-hidden
          className="pointer-events-none absolute rounded-2xl ring-2 ring-white/80 transition-all duration-300 ease-out"
          style={{ top: box.top, left: box.left, width: box.width, height: box.height, boxShadow: "0 0 0 9999px rgba(20, 30, 26, 0.62)" }}
        />
      ) : (
        <div aria-hidden className="absolute inset-0 bg-[rgba(20,30,26,0.62)] transition-opacity" />
      )}

      <div
        ref={cardRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-title"
        className={`absolute w-[min(360px,calc(100vw-32px))] rounded-2xl bg-surface p-5 shadow-pop outline-none transition-all duration-300 ease-out ${box && card ? "" : "top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"}`}
        style={box && card ? { top: card.top, left: card.left } : undefined}
      >
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-eucalyptus">
          Krok {index + 1} z {STEPS.length}
        </p>
        <h2 id="tour-title" className="mt-1.5 font-serif text-2xl leading-tight">
          {step.title}
        </h2>
        <p className="mt-2 text-[15px] text-ink-soft" aria-live="polite">
          {text}
        </p>
        <div className="mt-4 flex items-center gap-1.5" aria-hidden>
          {STEPS.map((_, i) => (
            <span key={i} className={`h-1.5 rounded-full transition-all ${i === index ? "w-5 bg-eucalyptus" : "w-1.5 bg-line"}`} />
          ))}
        </div>
        <div className="mt-5 flex items-center gap-2">
          {!last ? (
            <button type="button" onClick={finish} className="mr-auto text-sm text-ink-soft hover:text-ink">
              Přeskočit
            </button>
          ) : (
            <span className="mr-auto" />
          )}
          {index > 0 ? (
            <button type="button" onClick={() => setIndex(index - 1)} className="h-10 rounded-full px-4 text-sm font-medium text-ink-soft ring-1 ring-line hover:text-ink">
              Zpět
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => (last ? finish() : setIndex(index + 1))}
            className="h-10 rounded-full bg-eucalyptus px-5 text-sm font-medium text-white hover:bg-eucalyptus-deep"
          >
            {last ? "Hotovo" : index === 0 ? "Začít" : "Další"}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Odkaz „Spustit průvodce“ (v menu). */
export function TourLink({ onClick, className = "" }: { onClick?: () => void; className?: string }) {
  return (
    <button
      type="button"
      data-tour="tour-link"
      onClick={() => {
        onClick?.();
        window.dispatchEvent(new Event(TOUR_EVENT));
      }}
      className={className}
    >
      Spustit průvodce
    </button>
  );
}
