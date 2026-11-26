import { describe, expect, it } from "vitest";
import { buildIcs, escapeIcs, fold } from "./ics";

describe("iCalendar", () => {
  it("escapuje speciální znaky", () => {
    expect(escapeIcs("a,b;c\nd\\e")).toBe("a\\,b\;c\\nd\\\\e");
  });
  it("zalomí dlouhé řádky po 75 bajtech i s diakritikou", () => {
    const f = fold("SUMMARY:" + "ř".repeat(60));
    for (const line of f.split("\r\n")) expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
    expect(f.split("\r\n").slice(1).every((l) => l.startsWith(" "))).toBe(true);
  });
  it("celodenní úkol a událost s časem", () => {
    const ics = buildIcs("Svatba", [
      { uid: "t1@svatby", title: "Objednat dort", start: "2027-03-01", allDay: true, alarmMinutes: 540 },
      { uid: "e1@svatby", title: "Obřad", start: "2027-06-12T12:00:00Z", end: "2027-06-12T13:00:00Z", location: "Zámek" },
    ], new Date("2027-01-01T00:00:00Z"));
    expect(ics).toContain("DTSTART;VALUE=DATE:20270301\r\nDTEND;VALUE=DATE:20270302");
    expect(ics).toContain("DTSTART:20270612T120000Z");
    expect(ics).toContain("TRIGGER:-PT540M");
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
  });
});
