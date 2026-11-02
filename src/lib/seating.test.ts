import { describe, expect, it } from "vitest";
import { seatingWarnings, suggestSeating, type SeatGuest, type SeatTable } from "./seating";

const T = (id: string, seats: number): SeatTable => ({ id, label: id, seats });
const G = (id: string, household: string, tags: string[] = []): SeatGuest => ({ id, name: id, household_id: household, tags });
const tableOf = (r: ReturnType<typeof suggestSeating>, id: string) => r.assignments.find((a) => a.guest_id === id)?.table_id;

describe("suggestSeating", () => {
  it("domácnost sedí spolu a kapacita se dodrží", () => {
    const r = suggestSeating({
      tables: [T("A", 4), T("B", 4)],
      guests: [G("jan", "nov"), G("eva", "nov"), G("tom", "nov"), G("petr", "dvo"), G("ema", "dvo"), G("ivo", "ivo")],
      rules: [],
      locked: [],
    });
    expect(r.problems).toEqual([]);
    expect(tableOf(r, "jan")).toBe(tableOf(r, "eva"));
    expect(tableOf(r, "jan")).toBe(tableOf(r, "tom"));
    expect(tableOf(r, "petr")).toBe(tableOf(r, "ema"));
    const counts = ["A", "B"].map((t) => r.assignments.filter((a) => a.table_id === t).length);
    expect(Math.max(...counts)).toBeLessThanOrEqual(4);
  });

  it("seskupí podle štítků", () => {
    const r = suggestSeating({
      tables: [T("A", 4), T("B", 4)],
      guests: [G("k1", "1", ["Kolegové"]), G("s1", "2", ["Spolužáci"]), G("k2", "3", ["Kolegové"]), G("s2", "4", ["Spolužáci"])],
      rules: [],
      locked: [],
    });
    expect(tableOf(r, "k1")).toBe(tableOf(r, "k2"));
    expect(tableOf(r, "s1")).toBe(tableOf(r, "s2"));
    expect(tableOf(r, "k1")).not.toBe(tableOf(r, "s1"));
  });

  it("dodrží spolu, odděleně a pevný stůl", () => {
    const r = suggestSeating({
      tables: [T("hlavni", 4), T("A", 6), T("B", 6)],
      guests: [G("mama", "m"), G("tata", "t"), G("x", "x"), G("y", "y"), G("a", "a"), G("b", "b")],
      rules: [
        { kind: "fixed_table", guest_ids: ["mama", "tata"], table_id: "hlavni" },
        { kind: "apart", guest_ids: ["x", "y"] },
        { kind: "together", guest_ids: ["a", "b"] },
      ],
      locked: [],
    });
    expect(r.problems).toEqual([]);
    expect(tableOf(r, "mama")).toBe("hlavni");
    expect(tableOf(r, "tata")).toBe("hlavni");
    expect(tableOf(r, "x")).not.toBe(tableOf(r, "y"));
    expect(tableOf(r, "a")).toBe(tableOf(r, "b"));
  });

  it("zamčené hosty nechá na místě a zbytek skupiny přisadí", () => {
    const r = suggestSeating({
      tables: [T("A", 4), T("B", 4)],
      guests: [G("jan", "nov"), G("eva", "nov")],
      rules: [],
      locked: [{ guest_id: "jan", table_id: "B" }],
    });
    expect(tableOf(r, "jan")).toBe("B");
    expect(tableOf(r, "eva")).toBe("B");
  });

  it("nahlásí, co nejde splnit", () => {
    const r = suggestSeating({
      tables: [T("A", 2)],
      guests: [G("1", "h"), G("2", "h"), G("3", "h"), G("x", "x"), G("y", "y")],
      rules: [{ kind: "apart", guest_ids: ["1", "2"] }],
      locked: [],
    });
    expect(r.unseated).toEqual(expect.arrayContaining(["1", "2", "3"]));
    expect(r.problems.some((p) => p.message.includes("jedné domácnosti"))).toBe(true);
    expect(r.problems.some((p) => p.message.includes("není žádný stůl"))).toBe(true);
  });
});

describe("seatingWarnings", () => {
  it("najde přeplněné stoly a hosty, kteří odmítli", () => {
    const w = seatingWarnings(
      [T("A", 1)],
      [{ guest_id: "1", table_id: "A" }, { guest_id: "2", table_id: "A" }],
      new Set(["1"]),
    );
    expect(w.overfull[0].count).toBe(2);
    expect(w.declined).toEqual([{ guest_id: "2", table_id: "A" }]);
  });
});

import { freeSeatIndexes, initials, seatMap } from "./seating";

describe("židle", () => {
  it("pevné židle drží, ostatní doplní volná místa, zbytek je navíc", () => {
    const m = seatMap(3, [
      { guest_id: "a", seat_index: 2 },
      { guest_id: "b", seat_index: null },
      { guest_id: "c", seat_index: 2 },
      { guest_id: "d", seat_index: null },
      { guest_id: "e", seat_index: null },
    ]);
    expect(m.chairs).toEqual(["b", "c", "a"]);
    expect(m.overflow).toEqual(["d", "e"]);
  });

  it("najde volné židle", () => {
    expect(freeSeatIndexes(4, [0, 2, null], 3)).toEqual([1, 3, null]);
  });

  it("iniciály", () => {
    expect(initials("Jan Novák")).toBe("JN");
    expect(initials("Marie Anna Svobodová")).toBe("MS");
    expect(initials("Ema")).toBe("E");
  });
});
