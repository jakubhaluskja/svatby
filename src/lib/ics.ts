/** Jednoduchý generátor iCalendar (RFC 5545) pro odběr v Google/Apple kalendáři. */
export type IcsItem = {
  uid: string;
  title: string;
  description?: string;
  location?: string;
  url?: string;
  /** Celodenní: YYYY-MM-DD; jinak ISO čas */
  start: string;
  end?: string | null;
  allDay?: boolean;
  /** Připomenutí N minut předem */
  alarmMinutes?: number;
};

export function escapeIcs(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/** Zalomení řádků na 75 bajtů (pokračování začíná mezerou). */
export function fold(line: string): string {
  const bytes = new TextEncoder().encode(line);
  if (bytes.length <= 75) return line;
  const out: string[] = [];
  let current = "";
  let size = 0;
  for (const ch of line) {
    const n = new TextEncoder().encode(ch).length;
    const limit = out.length ? 74 : 75;
    if (size + n > limit) {
      out.push(current);
      current = "";
      size = 0;
    }
    current += ch;
    size += n;
  }
  out.push(current);
  return out.join("\r\n ");
}

const utc = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const day = (d: string) => d.slice(0, 10).replace(/-/g, "");
const nextDay = (d: string) => new Date(Date.parse(`${d.slice(0, 10)}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10).replace(/-/g, "");

export function buildIcs(name: string, items: IcsItem[], now = new Date()): string {
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Svatby//CS", "CALSCALE:GREGORIAN", "METHOD:PUBLISH", `X-WR-CALNAME:${escapeIcs(name)}`, "X-WR-TIMEZONE:Europe/Prague", "REFRESH-INTERVAL;VALUE=DURATION:PT6H", "X-PUBLISHED-TTL:PT6H"];
  for (const it of items) {
    lines.push("BEGIN:VEVENT", `UID:${it.uid}`, `DTSTAMP:${utc(now.toISOString())}`);
    if (it.allDay) {
      lines.push(`DTSTART;VALUE=DATE:${day(it.start)}`, `DTEND;VALUE=DATE:${nextDay(it.start)}`);
    } else {
      lines.push(`DTSTART:${utc(it.start)}`, `DTEND:${utc(it.end ?? new Date(Date.parse(it.start) + 3_600_000).toISOString())}`);
    }
    lines.push(`SUMMARY:${escapeIcs(it.title)}`);
    if (it.description) lines.push(`DESCRIPTION:${escapeIcs(it.description)}`);
    if (it.location) lines.push(`LOCATION:${escapeIcs(it.location)}`);
    if (it.url) lines.push(`URL:${it.url}`);
    if (it.alarmMinutes) lines.push("BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${escapeIcs(it.title)}`, `TRIGGER:-PT${it.alarmMinutes}M`, "END:VALARM");
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}
