import { siteHeading } from "./site-shell";

/** Pruh na konci webu s odkazem na fotky a knihu přání (když pár galerii zapnul). */
export function PhotosBand({ href, locale }: { href: string; locale: "cs" | "en" }) {
  const en = locale === "en";
  return (
    <section className="px-6 py-16 text-center" style={{ borderTop: "1px solid var(--site-line)" }}>
      <p className="text-[12px] uppercase tracking-[0.22em]" style={{ fontFamily: "var(--font-geist-sans), system-ui, sans-serif", color: "var(--site-accent)" }}>
        {en ? "Photos & wishes" : "Fotky a vzkazy"}
      </p>
      <h2 className="mt-3 text-[clamp(1.8rem,4vw,2.6rem)]" style={siteHeading}>
        {en ? "Share your photos with us" : "Podělte se s námi o fotky"}
      </h2>
      <p className="mx-auto mt-3 max-w-md" style={{ color: "var(--site-muted)" }}>
        {en ? "Upload photos and videos from the day and leave us a message in the guestbook." : "Nahrajte fotky a videa ze svatby a napište nám vzkaz do knihy přání."}
      </p>
      <a
        href={href}
        className="mt-6 inline-flex h-12 items-center rounded-full px-7 text-[15px] font-medium text-white"
        style={{ background: "var(--site-accent)", fontFamily: "var(--font-geist-sans), system-ui, sans-serif" }}
      >
        {en ? "Open photos" : "Otevřít fotky"}
      </a>
    </section>
  );
}
