import { describe, expect, it } from "vitest";
import { scheduleState } from "./schedule";

const I = (id: string, start: string, end: string | null = null) => ({ id, starts_at: `2027-06-12T${start}:00Z`, ends_at: end ? `2027-06-12T${end}:00Z` : null, sort: 0 });

describe("scheduleState", () => {
  const items = [I("make-up", "08:00", "10:00"), I("foto", "10:00"), I("obrad", "12:00", "12:45"), I("hostina", "14:00")];

  it("probíhající položka bez konce trvá do další", () => {
    const s = scheduleState(items, new Date("2027-06-12T11:00:00Z"));
    expect([...s.current]).toEqual(["foto"]);
    expect([...s.past]).toEqual(["make-up"]);
    expect(s.next).toEqual(["obrad", "hostina"]);
  });

  it("mezi položkami nic neprobíhá", () => {
    const s = scheduleState(items, new Date("2027-06-12T13:00:00Z"));
    expect(s.current.size).toBe(0);
    expect(s.next).toEqual(["hostina"]);
  });

  it("před začátkem nic neproběhlo", () => {
    const s = scheduleState(items, new Date("2027-06-12T06:00:00Z"));
    expect(s.past.size).toBe(0);
    expect(s.next).toEqual(["make-up", "foto"]);
  });
});
