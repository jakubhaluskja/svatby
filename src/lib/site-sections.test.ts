import { describe, expect, it } from "vitest";
import { lt, MAX_CUSTOM, normalizeSections, parseSectionContent, SECTION_TYPES } from "./site-sections";

describe("normalizeSections", () => {
  it("doplní všechny sekce s výchozím obsahem", () => {
    const s = normalizeSections([]);
    expect(s.map((x) => x.type)).toEqual(SECTION_TYPES.filter((t) => t !== "custom"));
    expect(s.every((x) => x.id === x.type)).toBe(true);
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
    expect(s[1].content).toEqual({ title: { cs: "", en: "" }, items: [{ q: { cs: "Parkování?", en: "" }, a: { cs: "U statku.", en: "" } }] });
    expect(s.filter((x) => x.type === "faq")).toHaveLength(1);
  });

  it("poškozený obsah nahradí výchozím", () => {
    const s = normalizeSections([{ type: "gifts", content: { show_account: "ano" } }]);
    expect(s.find((x) => x.type === "gifts")?.content).toEqual({ title: { cs: "", en: "" }, text: { cs: "", en: "" }, show_account: true });
  });
});

describe("vlastní sekce", () => {
  it("zachová platné id, doplní chybějící a zahodí duplicitní", () => {
    const s = normalizeSections([
      { id: "custom-abcd1234", type: "custom", content: { title: { cs: "Doprava" } } },
      { type: "custom", content: { title: { cs: "Bez id" } } },
      { id: "custom-abcd1234", type: "custom" },
      { id: "<script>", type: "custom" },
    ]);
    const customs = s.filter((x) => x.type === "custom");
    expect(customs).toHaveLength(3);
    expect(customs[0].id).toBe("custom-abcd1234");
    expect(new Set(customs.map((x) => x.id)).size).toBe(3);
    expect(customs.every((x) => /^custom-[a-z0-9]+$/.test(x.id))).toBe(true);
  });

  it("omezí počet vlastních sekcí", () => {
    const raw = Array.from({ length: MAX_CUSTOM + 5 }, (_, i) => ({ id: `custom-id${String(i).padStart(4, "0")}`, type: "custom" }));
    expect(normalizeSections(raw).filter((x) => x.type === "custom")).toHaveLength(MAX_CUSTOM);
  });

  it("dress code: 1–5 barev v hex formátu, odkaz na mapu doplní https", () => {
    expect(() => parseSectionContent("dresscode", { colors: ["#aabbcc", "red"] })).toThrow();
    expect(() => parseSectionContent("dresscode", { colors: Array(6).fill("#aabbcc") })).toThrow();
    const hero = parseSectionContent("hero", { info: [{ label: { cs: "Sraz" }, time: "13:30", map: "mapy.cz/s/abc" }] });
    expect(hero.info[0].map).toBe("https://mapy.cz/s/abc");
    expect(parseSectionContent("hero", { info: [{ map: "javascript:alert(1)" }] }).info[0].map).toBe("");
  });
});

describe("lt", () => {
  it("vrátí jazyk webu, jinak druhý jazyk", () => {
    expect(lt({ cs: "Ahoj", en: "" }, "en")).toBe("Ahoj");
    expect(lt({ cs: "Ahoj", en: "Hi" }, "en")).toBe("Hi");
  });
});
