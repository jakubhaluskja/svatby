import { describe, expect, it } from "vitest";
import { matchCategory, parseGuestImport } from "./guest-import";

describe("parseGuestImport", () => {
  it("načte tabulku z Excelu se záhlavím a seskupí domácnosti", () => {
    const text = [
      "Domácnost\tJméno\tPříjmení\tKategorie\tE-mail",
      "Novákovi\tJan\tNovák\tdospělý\tjan@novak.cz",
      "\tEva\tNováková\t\t",
      "\tTonda\tNovák\t4–12\t",
      "Babička\tMarie\tSvobodová\t\tneplatny-email",
    ].join("\n");
    const r = parseGuestImport(text);
    expect(r.households).toHaveLength(2);
    expect(r.households[0].name).toBe("Novákovi");
    expect(r.households[0].guests.map((g) => g.first_name)).toEqual(["Jan", "Eva", "Tonda"]);
    expect(r.households[0].guests[0].email).toBe("jan@novak.cz");
    expect(r.households[1].guests[0].email).toBeNull();
  });

  it("zvládne středníky, uvozovky a přeskočí řádky bez jména", () => {
    const r = parseGuestImport('"Dvořákovi; s.r.o.";Pavel;Dvořák\n;;\nX;;Y');
    expect(r.households[0].name).toBe("Dvořákovi; s.r.o.");
    expect(r.skipped).toEqual([3]);
  });

  it("bez názvu domácnosti ji pojmenuje podle hosta", () => {
    const r = parseGuestImport("\tPetr\tBílý");
    expect(r.households[0].name).toBe("Petr Bílý");
  });
});

describe("matchCategory", () => {
  const cats = [
    { id: "a", label: "Dospělý", is_adult: true, min_age: 13, max_age: null },
    { id: "b", label: "Dítě 4–12 let", is_adult: false, min_age: 4, max_age: 12 },
    { id: "c", label: "Dítě 0–3 roky", is_adult: false, min_age: 0, max_age: 3 },
  ];
  it("podle názvu, věku i obecného slova", () => {
    expect(matchCategory("Dítě 0–3 roky", cats)).toBe("c");
    expect(matchCategory("2", cats)).toBe("c");
    expect(matchCategory("4–12", cats)).toBe("b");
    expect(matchCategory("dítě", cats)).toBe("b");
    expect(matchCategory(null, cats)).toBe("a");
  });
});
