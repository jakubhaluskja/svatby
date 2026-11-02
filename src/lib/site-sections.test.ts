import { describe, expect, it } from "vitest";
import { lt, normalizeSections, SECTION_TYPES } from "./site-sections";

describe("normalizeSections", () => {
  it("doplní všechny sekce s výchozím obsahem", () => {
    const s = normalizeSections([]);
    expect(s.map((x) => x.type)).toEqual(SECTION_TYPES);
    expect(s.find((x) => x.type === "story")?.enabled).toBe(false);
    expect(s.find((x) => x.type === "rsvp")?.enabled).toBe(true);
  });

  it("zachová pořadí a obsah, zahodí neznámé a duplicitní sekce, úvod dá na začátek", () => {
    const s = normalizeSections([
      { type: "faq", enabled: true, content: { items: [{ q: { cs: "Parkování?" }, a: { cs: "U statku." } }] } },
      { type: "nesmysl" },
      { type: "hero", enabled: false, content: { intro: { cs: "Ahoj" } } },
      { type: "faq", enabled: false },
    ]);
    expect(s[0].type).toBe("hero");
    expect(s[0].enabled).toBe(true);
    expect(s[1].type).toBe("faq");
    expect(s[1].content).toEqual({ items: [{ q: { cs: "Parkování?", en: "" }, a: { cs: "U statku.", en: "" } }] });
    expect(s.filter((x) => x.type === "faq")).toHaveLength(1);
  });

  it("poškozený obsah nahradí výchozím", () => {
    const s = normalizeSections([{ type: "gifts", content: { show_account: "ano" } }]);
    expect(s.find((x) => x.type === "gifts")?.content).toEqual({ text: { cs: "", en: "" }, show_account: true });
  });
});

describe("lt", () => {
  it("vrátí jazyk webu, jinak druhý jazyk", () => {
    expect(lt({ cs: "Ahoj", en: "" }, "en")).toBe("Ahoj");
    expect(lt({ cs: "Ahoj", en: "Hi" }, "en")).toBe("Hi");
  });
});
