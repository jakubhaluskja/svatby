/**
 * Rozlišení, kam požadavek patří, podle hostname.
 *
 *   app.cz / www.app.cz        → aplikace (marketing, přihlášení, administrace)
 *   jana-a-petr.app.cz         → svatební web podle subdomény
 *   novakovi.cz                → svatební web podle vlastní domény
 *
 * Pro vývoj funguje i `jana-a-petr.localhost:3000`.
 */

export type HostTarget =
  | { kind: "app" }
  | { kind: "site"; slug: string }
  | { kind: "custom"; hostname: string };

/** Subdomény, které nejsou svatby. */
export const RESERVED_SUBDOMAINS = new Set([
  "www",
  "app",
  "api",
  "admin",
  "mail",
  "static",
  "cdn",
  "media",
  "help",
  "blog",
]);

const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{1,46}[a-z0-9])$/;

export function isValidSlug(slug: string): boolean {
  return SLUG_RE.test(slug) && !RESERVED_SUBDOMAINS.has(slug);
}

export function parseHost(rawHost: string | null | undefined, appDomain: string): HostTarget {
  if (!rawHost) return { kind: "app" };

  const host = rawHost.toLowerCase().replace(/:\d+$/, "").replace(/\.$/, "");
  const root = appDomain.toLowerCase().replace(/:\d+$/, "");

  if (host === root || host === `www.${root}`) return { kind: "app" };

  // Vercel náhledy a localhost bez subdomény patří aplikaci
  if (host === "localhost" || host === "127.0.0.1" || host.endsWith(".vercel.app")) {
    return { kind: "app" };
  }

  for (const base of [root, "localhost"]) {
    if (host.endsWith(`.${base}`)) {
      const sub = host.slice(0, -(base.length + 1));
      if (sub.includes(".")) return { kind: "app" }; // víceúrovňové subdomény nepodporujeme
      if (RESERVED_SUBDOMAINS.has(sub)) return { kind: "app" };
      return SLUG_RE.test(sub) ? { kind: "site", slug: sub } : { kind: "app" };
    }
  }

  return { kind: "custom", hostname: host };
}

/**
 * Na doméně bez wildcard subdomén (Vercel náhled, localhost bez DNS) běží svatby
 * na cestě /site/<slug>. Na vlastní doméně aplikace na <slug>.<doména>.
 */
export function usesPathSites(appDomain: string): boolean {
  const d = appDomain.replace(/:\d+$/, "");
  return d.endsWith(".vercel.app") || d === "localhost" || d === "127.0.0.1";
}

/** Veřejná adresa svatebního webu. */
export function siteUrl(slug: string, appDomain: string): string {
  const protocol = appDomain.startsWith("localhost") || appDomain.startsWith("127.") ? "http" : "https";
  return usesPathSites(appDomain) ? `${protocol}://${appDomain}/site/${slug}` : `${protocol}://${slug}.${appDomain}`;
}

/** Osobní odkaz domácnosti na RSVP. */
export function householdUrl(slug: string, token: string, appDomain: string): string {
  return `${siteUrl(slug, appDomain)}/p/${token}`;
}
