import { describe, expect, it } from "vitest";
import { utcToZonedParts, zonedToUtcIso } from "./time";

describe("časové pásmo svatby", () => {
  it("letní čas (UTC+2)", () => {
    expect(zonedToUtcIso("2027-06-12", "14:00")).toBe("2027-06-12T12:00:00.000Z");
  });
  it("zimní čas (UTC+1)", () => {
    expect(zonedToUtcIso("2027-01-09", "14:00")).toBe("2027-01-09T13:00:00.000Z");
  });
  it("tam a zpět", () => {
    expect(utcToZonedParts(zonedToUtcIso("2027-03-28", "16:30"))).toEqual({ date: "2027-03-28", time: "16:30" });
  });
});
