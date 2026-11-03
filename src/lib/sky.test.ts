import { describe, expect, it } from "vitest";
import { STARS, altAz, moonPhase, skyMap } from "./sky";

const at = new Date("2027-06-12T19:40:00Z"); // 21:40 v Praze

describe("obloha", () => {
  it("Polárka je ve výšce zeměpisné šířky", () => {
    const [, ra, dec] = STARS.find((s) => s[0] === "Polárka")!;
    expect(Math.abs(altAz(ra, dec, at, 49.8, 15.5).alt - 49.8)).toBeLessThan(1);
  });
  it("v červnovém večeru je Vega vysoko na východě", () => {
    const [, ra, dec] = STARS.find((s) => s[0] === "Vega")!;
    const { alt, az } = altAz(ra, dec, at, 49.8, 15.5);
    expect(alt).toBeGreaterThan(30);
    expect(az).toBeGreaterThan(45);
    expect(az).toBeLessThan(110);
  });
  it("Arcturus je vysoko na jihozápadě", () => {
    const [, ra, dec] = STARS.find((s) => s[0] === "Arcturus")!;
    const { alt, az } = altAz(ra, dec, at, 49.8, 15.5);
    expect(alt).toBeGreaterThan(45);
    expect(az).toBeGreaterThan(170);
    expect(az).toBeLessThan(260);
  });
  it("mapa obsahuje Velký vůz celý", () => {
    const m = skyMap(at);
    expect(m.stars.length).toBeGreaterThan(40);
    expect(m.lines.filter(([a]) => ["Dubhe", "Merak", "Phecda", "Megrez", "Alioth", "Mizar"].includes(a.name)).length).toBe(7);
  });
  it("fáze měsíce v rozsahu", () => {
    const p = moonPhase(at);
    expect(p).toBeGreaterThanOrEqual(0);
    expect(p).toBeLessThan(1);
    const nov = moonPhase(new Date("2024-04-08T18:20:00Z")); // novoluní při zatmění Slunce
    expect(Math.min(nov, 1 - nov)).toBeLessThan(0.03);
  });
});
