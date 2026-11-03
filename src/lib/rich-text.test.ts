import { describe, expect, it } from "vitest";
import { plainToRich, richToPlain, sanitizeRich } from "./rich-text";

describe("sanitizeRich", () => {
  it("prostý text převede na odstavce", () => {
    expect(sanitizeRich("Ahoj\nsvěte\n\nDruhý")).toBe("<p>Ahoj<br>světe</p><p>Druhý</p>");
  });
  it("povolí tučné, kurzívu a odkaz", () => {
    expect(sanitizeRich('<p><b>Tučně</b> a <i>šikmo</i> <a href="https://mapy.cz">mapa</a></p>')).toBe(
      '<p><strong>Tučně</strong> a <em>šikmo</em> <a href="https://mapy.cz" target="_blank" rel="noopener noreferrer">mapa</a></p>',
    );
  });
  it("zahodí skripty, atributy a nebezpečné odkazy", () => {
    const out = sanitizeRich('<p onclick="x()">A<script>alert(1)</script><a href="javascript:alert(1)">b</a><img src=x onerror=y></p>');
    expect(out).toBe("<p>Ab</p>");
  });
  it("escapuje text", () => {
    expect(sanitizeRich("<p>1 &lt; 2 &amp; &quot;x&quot;</p>")).toBe("<p>1 &lt; 2 &amp; &quot;x&quot;</p>");
  });
  it("div z contentEditable dělá odstavce", () => {
    expect(sanitizeRich("První<div>Druhý</div><div><br></div>")).toBe("<p>První</p><p>Druhý</p><p><br></p>".replace("<p><br></p>", ""));
  });
  it("uzavře neuzavřené značky", () => {
    expect(sanitizeRich("<p><strong>a</p>")).toBe("<p><strong>a</strong></p>");
  });
});

describe("převody", () => {
  it("prostý text a zpět", () => {
    expect(richToPlain(plainToRich("A\n\nB"))).toBe("A\n\nB");
  });
});
