import type { Locale } from "@/lib/i18n";
import type { SiteEvent } from "@/lib/site";
import { siteCopy } from "@/lib/site-copy";
import { siteHeading } from "./site-shell";

function timeRange(e: SiteEvent, locale: Locale, timeZone: string) {
  if (!e.starts_at) return null;
  const fmt = (iso: string, opts: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat(locale === "cs" ? "cs-CZ" : "en-GB", { timeZone, ...opts }).format(new Date(iso));
  const day = fmt(e.starts_at, { weekday: "long", day: "numeric", month: "long" });
  const start = fmt(e.starts_at, { hour: "2-digit", minute: "2-digit" });
  const end = e.ends_at ? fmt(e.ends_at, { hour: "2-digit", minute: "2-digit" }) : null;
  return { day, time: end ? `${start}–${end}` : start };
}

const mapUrl = (q: string) => `https://mapy.cz/?q=${encodeURIComponent(q)}`;

/** Harmonogram svatby – skládá se z událostí. */
export function SiteSchedule({ events, locale, timeZone }: { events: SiteEvent[]; locale: Locale; timeZone: string }) {
  const c = siteCopy(locale);
  if (events.length === 0) return null;
  return (
    <section className="mx-auto flex max-w-2xl flex-col gap-10 px-6 py-20">
      <h2 style={siteHeading} className="text-center text-4xl sm:text-5xl">
        {c.schedule}
      </h2>
      <ol className="flex flex-col">
        {events.map((e) => {
          const when = timeRange(e, locale, timeZone);
          const place = e.plan_b_active ? e.plan_b_location_name ?? e.location_name : e.location_name;
          const address = e.plan_b_active ? e.plan_b_address ?? e.address : e.address;
          return (
            <li key={e.id} className="grid gap-1 border-t py-6 sm:grid-cols-[9rem_1fr] sm:gap-8" style={{ borderColor: "var(--site-line)" }}>
              <div className="flex flex-col">
                {when ? (
                  <>
                    <span className="text-2xl tabular-nums">{when.time}</span>
                    <span className="text-sm first-letter:uppercase" style={{ color: "var(--site-muted)" }}>{when.day}</span>
                  </>
                ) : null}
              </div>
              <div className="flex flex-col gap-1">
                <h3 className="text-xl font-medium">{e.name}</h3>
                {e.plan_b_active ? (
                  <p className="text-sm font-medium" style={{ color: "var(--site-accent)" }}>{c.planB}</p>
                ) : null}
                {place ? <p>{place}</p> : null}
                {address ? (
                  <p className="text-sm" style={{ color: "var(--site-muted)" }}>
                    {address}{" "}
                    <a href={mapUrl(address)} target="_blank" rel="noreferrer" className="underline underline-offset-2" style={{ color: "var(--site-accent)" }}>
                      {c.map}
                    </a>
                  </p>
                ) : null}
                {e.description ? <p className="mt-2 whitespace-pre-line" style={{ color: "var(--site-muted)" }}>{e.description}</p> : null}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
