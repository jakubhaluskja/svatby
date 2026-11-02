import Link from "next/link";
import type { Locale } from "@/lib/i18n";

/** Přepínač jazyka webu (zobrazí se jen, když web nabízí oba jazyky). */
export function LanguageSwitch({ locales, current }: { locales: string[]; current: Locale }) {
  if (locales.length < 2) return null;
  return (
    <nav aria-label="Jazyk / Language" className="absolute right-4 top-4 z-10 flex gap-1 text-sm">
      {(["cs", "en"] as const)
        .filter((l) => locales.includes(l))
        .map((l) => (
          <Link
            key={l}
            href={{ query: { lang: l } }}
            hrefLang={l}
            aria-current={l === current ? "true" : undefined}
            className="rounded-full px-3 py-1"
            style={l === current ? { background: "var(--site-text)", color: "var(--site-bg)" } : { color: "var(--site-muted)" }}
          >
            {l === "cs" ? "Česky" : "English"}
          </Link>
        ))}
    </nav>
  );
}
