import { describe, expect, it } from "vitest";
import { isValidSlug, parseHost } from "./hosts";

const D = "anoberu.cz";

describe("parseHost", () => {
  it("kořenová doména a www patří aplikaci", () => {
    expect(parseHost("anoberu.cz", D)).toEqual({ kind: "app" });
    expect(parseHost("www.anoberu.cz", D)).toEqual({ kind: "app" });
    expect(parseHost("ANOBERU.CZ.", D)).toEqual({ kind: "app" });
  });

  it("subdoména je svatba", () => {
    expect(parseHost("jana-a-petr.anoberu.cz", D)).toEqual({ kind: "site", slug: "jana-a-petr" });
    expect(parseHost("jana-a-petr.localhost:3000", D)).toEqual({ kind: "site", slug: "jana-a-petr" });
  });

  it("rezervované a neplatné subdomény patří aplikaci", () => {
    expect(parseHost("admin.anoberu.cz", D)).toEqual({ kind: "app" });
    expect(parseHost("a.b.anoberu.cz", D)).toEqual({ kind: "app" });
    expect(parseHost("-x.anoberu.cz", D)).toEqual({ kind: "app" });
  });

  it("cizí hostname je vlastní doména", () => {
    expect(parseHost("novakovi.cz", D)).toEqual({ kind: "custom", hostname: "novakovi.cz" });
    expect(parseHost("www.novakovi.cz:443", D)).toEqual({ kind: "custom", hostname: "www.novakovi.cz" });
  });

  it("localhost a Vercel náhledy patří aplikaci", () => {
    expect(parseHost("localhost:3000", D)).toEqual({ kind: "app" });
    expect(parseHost("svatby-git-main.vercel.app", D)).toEqual({ kind: "app" });
    expect(parseHost(null, D)).toEqual({ kind: "app" });
  });
});

describe("isValidSlug", () => {
  it("ověřuje tvar a rezervovaná slova", () => {
    expect(isValidSlug("jana-a-petr")).toBe(true);
    expect(isValidSlug("abc")).toBe(true);
    expect(isValidSlug("ab")).toBe(false);
    expect(isValidSlug("a")).toBe(false);
    expect(isValidSlug("jana-")).toBe(false);
    expect(isValidSlug("Jana")).toBe(false);
    expect(isValidSlug("admin")).toBe(false);
  });
});
