import { describe, expect, it } from "vitest";
import { guestEmail, htmlToText, paragraphs, rsvpConfirmation, taskReminder, type WeddingInfo } from "./templates";

const w: WeddingInfo = { partner1: "Jana", partner2: "Petr", date: "2027-06-12", place: "Zámek <Loučeň>", deadline: "2027-05-01T21:59:00Z", siteUrl: "https://x.cz" };
const base = { wedding: w, household: "Novákovi", personalUrl: "https://x.cz/p/abc", shortCode: "AB12CD", unsubscribeUrl: "https://app/odhlaseni/abc" };

describe("e-mailové šablony", () => {
  it("pozvánka obsahuje odkaz, kód, datum a uzávěrku", () => {
    const e = guestEmail({ ...base, kind: "invitation", locale: "cs" });
    expect(e.subject).toBe("Jana a Petr vás zvou na svatbu");
    expect(e.html).toContain('href="https://x.cz/p/abc"');
    expect(e.html).toContain("AB12CD");
    expect(e.html).toContain("12. června 2027");
    expect(e.html).toContain("1. května");
    expect(e.html).toContain("Zámek &lt;Loučeň&gt;");
    expect(e.text).toContain("Otevřít pozvánku a odpovědět: https://x.cz/p/abc");
    expect(e.text).not.toMatch(/<\/?(p|td|table|a)\b/);
  });

  it("vlastní text páru je escapovaný", () => {
    const e = guestEmail({ ...base, kind: "invitation", locale: "cs", note: "Ahoj <b>vy</b>\n\nDruhý odstavec" });
    expect(e.html).toContain("Ahoj &lt;b&gt;vy&lt;/b&gt;");
    expect(e.html.match(/<p style="margin:0 0 16px">/g)!.length).toBeGreaterThanOrEqual(3);
  });

  it("anglická připomínka a zpráva s předmětem", () => {
    expect(guestEmail({ ...base, kind: "reminder", locale: "en" }).subject).toContain("Reminder");
    const m = guestEmail({ ...base, kind: "message", locale: "cs", subject: "Autobus", note: "Odjíždí v 17:00" });
    expect(m.subject).toBe("Autobus");
    expect(m.html).toContain("Odjíždí v 17:00");
    expect(m.html).toContain("Nechci další e-maily");
  });

  it("poděkování bez vlastního textu", () => {
    const e = guestEmail({ ...base, kind: "thank_you", locale: "cs" });
    expect(e.html).toContain("Moc děkujeme");
    expect(e.html).toContain("S láskou");
  });

  it("potvrzení RSVP shrne odpovědi", () => {
    const e = rsvpConfirmation({
      locale: "cs",
      wedding: w,
      household: "Novákovi",
      personalUrl: "https://x.cz/p/abc",
      unsubscribeUrl: "https://u",
      events: [{ name: "Obřad", when: "12. 6. 14:00", guests: [{ name: "Jan", status: "yes" }, { name: "Eva", status: "no" }] }],
    });
    expect(e.html).toContain("přijde");
    expect(e.html).toContain("nepřijde");
    expect(e.html).toContain("těšíme");
  });

  it("úkoly pro organizátora", () => {
    const e = taskReminder({ name: "Jana", couple: "Jana a Petr", appUrl: "https://app", tasks: [{ title: "Objednat dort", due: "2027-01-02", overdue: true }] });
    expect(e.subject).toBe("Úkol ke svatbě: Objednat dort");
    expect(e.html).toContain("po termínu");
    expect(e.html).toContain("https://app/app/checklist");
  });

  it("pomocné převody", () => {
    expect(paragraphs("a\nb\n\nc")).toBe('<p style="margin:0 0 16px">a<br>b</p><p style="margin:0 0 16px">c</p>');
    expect(htmlToText('<p>A &amp; B</p><a href="https://y">Klik</a>')).toBe("A & B\nKlik: https://y");
  });
});
