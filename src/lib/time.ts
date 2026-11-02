/** Práce s časem svatby v jejím časovém pásmu (výchozí Europe/Prague) bez knihoven. */

const DEFAULT_TZ = "Europe/Prague";

function offsetMinutes(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return Math.round((asUtc - instant.getTime()) / 60_000);
}

/** Místní datum a čas ve svatebním pásmu → ISO v UTC. */
export function zonedToUtcIso(date: string, time: string, timeZone = DEFAULT_TZ): string {
  const [y, mo, d] = date.split("-").map(Number);
  const [h, mi] = time.split(":").map(Number);
  const naive = Date.UTC(y, mo - 1, d, h, mi);
  // dvě iterace zvládnou i přechod letního času
  let guess = naive - offsetMinutes(new Date(naive), timeZone) * 60_000;
  guess = naive - offsetMinutes(new Date(guess), timeZone) * 60_000;
  return new Date(guess).toISOString();
}

/** ISO v UTC → { date: "YYYY-MM-DD", time: "HH:MM" } ve svatebním pásmu. */
export function utcToZonedParts(iso: string, timeZone = DEFAULT_TZ): { date: string; time: string } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(new Date(iso));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return { date: `${get("year")}-${get("month")}-${get("day")}`, time: `${get("hour")}:${get("minute")}` };
}

/** Čitelný čas události, např. „12. června 2027, 14:00“. */
export function formatEventTime(iso: string, locale: "cs" | "en" = "cs", timeZone = DEFAULT_TZ): string {
  return new Intl.DateTimeFormat(locale === "cs" ? "cs-CZ" : "en-GB", {
    timeZone,
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function formatTime(iso: string, timeZone = DEFAULT_TZ): string {
  return new Intl.DateTimeFormat("cs-CZ", { timeZone, hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}
