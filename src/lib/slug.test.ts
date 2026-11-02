import { describe, expect, it } from "vitest";
import { slugAlternatives, slugify, suggestSlug } from "./slug";

describe("slugify", () => {
  it("odstraní diakritiku a speciální znaky", () => {
    expect(slugify("Šárka & Řehoř")).toBe("sarka-a-rehor");
    expect(slugify("  Žluťoučký kůň!! ")).toBe("zlutoucky-kun");
  });
});

describe("suggestSlug", () => {
  it("vezme křestní jména", () => {
    expect(suggestSlug("Jana Nováková", "Petr Dvořák")).toBe("jana-a-petr");
    expect(suggestSlug("Jana", "")).toBe("jana");
  });
});

describe("slugAlternatives", () => {
  it("nabídne platné alternativy", () => {
    expect(slugAlternatives("jana-a-petr", 2027)).toEqual([
      "jana-a-petr-2027",
      "jana-a-petr-svatba",
      "svatba-jana-a-petr",
    ]);
  });
});
