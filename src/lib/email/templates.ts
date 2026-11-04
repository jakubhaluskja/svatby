/**
 * Šablony e-mailů (HTML s inline styly + textová verze). Bez závislostí na serveru,
 * aby šly testovat a ukázat v náhledu.
 */
import { escapeHtml } from "@/lib/rich-text";

export type Locale = "cs" | "en";
export type EmailKind = "invitation" | "reminder" | "rsvp_confirmation" | "message" | "thank_you" | "task_reminder";

export type RenderedEmail = { subject: string; html: string; text: string };

export type WeddingInfo = {
  partner1: string;
  partner2: string;
  /** ISO datum svatby (YYYY-MM-DD) */
  date: string | null;
  place: string | null;
  /** ISO čas uzávěrky RSVP */
  deadline: string | null;
  siteUrl: string;
};

export type GuestEmailInput = {
  kind: "invitation" | "reminder" | "message" | "thank_you";
  locale: Locale;
  wedding: WeddingInfo;
  household: string;
  personalUrl: string;
  shortCode: string;
  unsubscribeUrl: string;
  /** Vlastní text páru (prostý text, odstavce oddělené prázdným řádkem). */
  note?: string;
  /** Předmět u zprávy hostům. */
  subject?: string;
};

const COLORS = { ink: "#1e2b26", soft: "#5d6b65", paper: "#f5f7f5", accent: "#4f7263", line: "#dfe5e1" };

const fmtDate = (iso: string, locale: Locale) =>
  new Intl.DateTimeFormat(locale === "cs" ? "cs-CZ" : "en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(`${iso.slice(0, 10)}T12:00:00Z`),
  );

const fmtDeadline = (iso: string, locale: Locale) =>
  new Intl.DateTimeFormat(locale === "cs" ? "cs-CZ" : "en-GB", { day: "numeric", month: "long", timeZone: "Europe/Prague" }).format(new Date(iso));

/** Prostý text → odstavce HTML (escapované). */
export function paragraphs(text: string): string {
  return text
    .trim()
    .split(/\n\s*\n/)
    .filter((p) => p.trim())
    .map((p) => `<p style="margin:0 0 16px">${escapeHtml(p.trim()).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

function button(href: string, label: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 24px"><tr><td style="border-radius:999px;background:${COLORS.accent}">
<a href="${escapeHtml(href)}" style="display:inline-block;padding:13px 28px;font:600 15px/1 Helvetica,Arial,sans-serif;color:#ffffff;text-decoration:none;border-radius:999px">${escapeHtml(label)}</a>
</td></tr></table>`;
}

/** Společný obal e-mailu. */
export function layout(opts: { preheader: string; eyebrow: string; title: string; body: string; footer: string }): string {
  return `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(opts.title)}</title></head>
<body style="margin:0;padding:0;background:${COLORS.paper}">
<span style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(opts.preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${COLORS.paper}"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:20px;border:1px solid ${COLORS.line}">
<tr><td style="padding:40px 40px 8px;font:12px/1.4 Helvetica,Arial,sans-serif;letter-spacing:.18em;text-transform:uppercase;color:${COLORS.accent}">${escapeHtml(opts.eyebrow)}</td></tr>
<tr><td style="padding:0 40px 8px;font:400 30px/1.2 Georgia,'Times New Roman',serif;color:${COLORS.ink}">${escapeHtml(opts.title)}</td></tr>
<tr><td style="padding:16px 40px 16px;font:16px/1.6 Helvetica,Arial,sans-serif;color:${COLORS.ink}">${opts.body}</td></tr>
</table>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px"><tr><td style="padding:20px 24px;font:12px/1.6 Helvetica,Arial,sans-serif;color:${COLORS.soft};text-align:center">${opts.footer}</td></tr></table>
</td></tr></table>
</body></html>`;
}

/** HTML → prostý text pro textovou část e-mailu. */
export function htmlToText(html: string): string {
  return html
    .replace(/<span style="display:none[^>]*>[\s\S]*?<\/span>/, "")
    .replace(/<title>[\s\S]*?<\/title>/, "")
    .replace(/<a [^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g, (_, href, label) => `${label.replace(/<[^>]+>/g, "")}: ${href}`)
    .replace(/<br\s*\/?>/g, "\n")
    .replace(/<\/(p|tr|li|h\d)>/g, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

const T = {
  cs: {
    couple: (w: WeddingInfo) => `${w.partner1} a ${w.partner2}`,
    hello: (h: string) => `Milí ${h},`,
    when: "Kdy",
    where: "Kde",
    code: "Kód pozvánky",
    deadline: (d: string) => `Odpovězte nám prosím do ${d}.`,
    sign: (w: WeddingInfo) => `Těšíme se na vás,<br>${escapeHtml(w.partner1)} a ${escapeHtml(w.partner2)}`,
    love: (w: WeddingInfo) => `S láskou<br>${escapeHtml(w.partner1)} a ${escapeHtml(w.partner2)}`,
    footer: (w: WeddingInfo, unsub: string) =>
      `Tento e-mail vám poslali ${escapeHtml(w.partner1)} a ${escapeHtml(w.partner2)}. <a href="${escapeHtml(unsub)}" style="color:${COLORS.soft}">Nechci další e-maily ke svatbě</a>`,
    invitation: {
      subject: (w: WeddingInfo) => `${w.partner1} a ${w.partner2} vás zvou na svatbu`,
      eyebrow: "Pozvánka na svatbu",
      note: "S radostí vás zveme na naši svatbu. Všechno potřebné najdete na svatebním webu, kde nám prosím také potvrďte, jestli dorazíte.",
      cta: "Otevřít pozvánku a odpovědět",
    },
    reminder: {
      subject: (w: WeddingInfo) => `Připomínka: potvrďte prosím účast na svatbě ${w.partner1} a ${w.partner2}`,
      eyebrow: "Připomínka",
      note: "ještě od vás nemáme odpověď, jestli na svatbu dorazíte. Pomůže nám to s plánováním – zabere to jen minutku.",
      cta: "Odpovědět",
    },
    message: { eyebrow: "Zpráva od novomanželů", cta: "Svatební web" },
    thank_you: {
      subject: (w: WeddingInfo) => `Děkujeme! ${w.partner1} a ${w.partner2}`,
      eyebrow: "Poděkování",
      note: "moc děkujeme, že jste byli u toho a za všechno, čím jste náš den udělali výjimečným.",
    },
  },
  en: {
    couple: (w: WeddingInfo) => `${w.partner1} & ${w.partner2}`,
    hello: (h: string) => `Dear ${h},`,
    when: "When",
    where: "Where",
    code: "Invitation code",
    deadline: (d: string) => `Please reply by ${d}.`,
    sign: (w: WeddingInfo) => `We can't wait to see you,<br>${escapeHtml(w.partner1)} & ${escapeHtml(w.partner2)}`,
    love: (w: WeddingInfo) => `With love,<br>${escapeHtml(w.partner1)} & ${escapeHtml(w.partner2)}`,
    footer: (w: WeddingInfo, unsub: string) =>
      `This e-mail was sent by ${escapeHtml(w.partner1)} & ${escapeHtml(w.partner2)}. <a href="${escapeHtml(unsub)}" style="color:${COLORS.soft}">Unsubscribe from wedding e-mails</a>`,
    invitation: {
      subject: (w: WeddingInfo) => `${w.partner1} & ${w.partner2} invite you to their wedding`,
      eyebrow: "Wedding invitation",
      note: "We would love you to join us on our wedding day. You will find everything on our wedding website, where you can also let us know if you can make it.",
      cta: "Open the invitation and reply",
    },
    reminder: {
      subject: (w: WeddingInfo) => `Reminder: please reply to ${w.partner1} & ${w.partner2}'s wedding invitation`,
      eyebrow: "Reminder",
      note: "we haven't heard back from you yet. Letting us know whether you can come helps us a lot with planning – it only takes a minute.",
      cta: "Reply now",
    },
    message: { eyebrow: "A message from the couple", cta: "Wedding website" },
    thank_you: {
      subject: (w: WeddingInfo) => `Thank you! ${w.partner1} & ${w.partner2}`,
      eyebrow: "Thank you",
      note: "thank you so much for being part of our day and for everything you did to make it so special.",
    },
  },
} as const;

function facts(w: WeddingInfo, l: Locale): string {
  const t = T[l];
  const rows: [string, string][] = [];
  if (w.date) rows.push([t.when, fmtDate(w.date, l)]);
  if (w.place) rows.push([t.where, w.place]);
  if (!rows.length) return "";
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:4px 0 20px;width:100%;border-top:1px solid ${COLORS.line}">${rows
    .map(
      ([k, v]) =>
        `<tr><td style="padding:10px 16px 10px 0;width:60px;border-bottom:1px solid ${COLORS.line};font-size:13px;color:${COLORS.soft}">${escapeHtml(k)}</td><td style="padding:10px 0;border-bottom:1px solid ${COLORS.line}">${escapeHtml(v)}</td></tr>`,
    )
    .join("")}</table>`;
}

/** E-maily hostům (pozvánka, připomínka, zpráva, poděkování). */
export function guestEmail(input: GuestEmailInput): RenderedEmail {
  const { locale: l, wedding: w } = input;
  const t = T[l];
  const hello = `<p style="margin:0 0 16px">${escapeHtml(t.hello(input.household))}</p>`;
  const sign = `<p style="margin:24px 0 0">${t.sign(w)}</p>`;
  const footer = t.footer(w, input.unsubscribeUrl);
  const custom = input.note?.trim();
  let subject: string;
  let html: string;

  if (input.kind === "invitation" || input.kind === "reminder") {
    const c = t[input.kind];
    subject = c.subject(w);
    const intro = custom ? paragraphs(custom) : paragraphs(input.kind === "reminder" ? capitalize(c.note) : c.note);
    const deadline = w.deadline ? `<p style="margin:0 0 8px;color:${COLORS.soft}">${escapeHtml(t.deadline(fmtDeadline(w.deadline, l)))}</p>` : "";
    const code = `<p style="margin:0;font-size:13px;color:${COLORS.soft}">${escapeHtml(t.code)}: <strong style="font-family:Menlo,monospace;letter-spacing:.12em;color:${COLORS.ink}">${escapeHtml(input.shortCode)}</strong></p>`;
    html = layout({
      preheader: input.kind === "invitation" ? t.couple(w) : c.subject(w),
      eyebrow: c.eyebrow,
      title: t.couple(w),
      body: hello + intro + facts(w, l) + deadline + button(input.personalUrl, c.cta) + code + sign,
      footer,
    });
  } else if (input.kind === "message") {
    subject = input.subject?.trim() || t.couple(w);
    html = layout({
      preheader: subject,
      eyebrow: t.message.eyebrow,
      title: subject,
      body: hello + paragraphs(custom ?? "") + button(input.personalUrl, t.message.cta) + `<p style="margin:24px 0 0">${t.love(w)}</p>`,
      footer,
    });
  } else {
    subject = input.subject?.trim() || t.thank_you.subject(w);
    html = layout({
      preheader: subject,
      eyebrow: t.thank_you.eyebrow,
      title: t.couple(w),
      body: hello + paragraphs(custom || capitalize(t.thank_you.note)) + `<p style="margin:24px 0 0">${t.love(w)}</p>`,
      footer,
    });
  }
  return { subject, html, text: htmlToText(html) };
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Potvrzení odpovědi hostovi. */
export type RsvpSummary = {
  locale: Locale;
  wedding: WeddingInfo;
  household: string;
  personalUrl: string;
  events: { name: string; when: string | null; guests: { name: string; status: "yes" | "no" | "pending" }[] }[];
  unsubscribeUrl: string;
};

export function rsvpConfirmation(s: RsvpSummary): RenderedEmail {
  const l = s.locale;
  const t = T[l];
  const status = { yes: l === "cs" ? "přijde" : "attending", no: l === "cs" ? "nepřijde" : "not attending", pending: l === "cs" ? "bez odpovědi" : "no reply" };
  const anyYes = s.events.some((e) => e.guests.some((g) => g.status === "yes"));
  const subject = l === "cs" ? `Děkujeme za odpověď – svatba ${t.couple(s.wedding)}` : `Thanks for your reply – ${t.couple(s.wedding)}'s wedding`;
  const intro =
    l === "cs"
      ? anyYes
        ? "děkujeme, vaši odpověď máme. Moc se na vás těšíme! Tady je shrnutí:"
        : "děkujeme, vaši odpověď máme. Je nám líto, že to nevyjde. Tady je shrnutí:"
      : anyYes
        ? "thank you, we have your reply and can't wait to see you! Here is a summary:"
        : "thank you for letting us know – we'll miss you. Here is a summary:";
  const list = s.events
    .map(
      (e) =>
        `<p style="margin:16px 0 6px;font-weight:600">${escapeHtml(e.name)}${e.when ? ` <span style="font-weight:400;color:${COLORS.soft}">· ${escapeHtml(e.when)}</span>` : ""}</p>` +
        `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%">${e.guests
          .map(
            (g) =>
              `<tr><td style="padding:4px 0">${escapeHtml(g.name)}</td><td style="padding:4px 0;text-align:right;color:${g.status === "yes" ? COLORS.accent : COLORS.soft}">${status[g.status]}</td></tr>`,
          )
          .join("")}</table>`,
    )
    .join("");
  const change = l === "cs" ? "Změnit odpověď" : "Change your reply";
  const html = layout({
    preheader: subject,
    eyebrow: l === "cs" ? "Potvrzení odpovědi" : "Reply received",
    title: t.couple(s.wedding),
    body: `<p style="margin:0 0 16px">${escapeHtml(t.hello(s.household))}</p><p style="margin:0">${escapeHtml(capitalize(intro))}</p>${list}<div style="height:20px"></div>${button(s.personalUrl, change)}`,
    footer: t.footer(s.wedding, s.unsubscribeUrl),
  });
  return { subject, html, text: htmlToText(html) };
}

/** Přehled úkolů pro organizátora (česky – aplikace je česká). */
export type TaskDigest = {
  name: string | null;
  couple: string;
  appUrl: string;
  tasks: { title: string; due: string; overdue: boolean }[];
};

export function taskReminder(d: TaskDigest): RenderedEmail {
  const n = d.tasks.length;
  const subject = n === 1 ? `Úkol ke svatbě: ${d.tasks[0].title}` : `Úkoly ke svatbě na nejbližší dny (${n})`;
  const rows = d.tasks
    .map(
      (t) =>
        `<tr><td style="padding:10px 0;border-bottom:1px solid ${COLORS.line}">${escapeHtml(t.title)}</td><td style="padding:10px 0 10px 12px;border-bottom:1px solid ${COLORS.line};text-align:right;white-space:nowrap;color:${t.overdue ? "#a33" : COLORS.soft}">${escapeHtml(t.overdue ? `po termínu (${fmtDate(t.due, "cs")})` : fmtDate(t.due, "cs"))}</td></tr>`,
    )
    .join("");
  const html = layout({
    preheader: subject,
    eyebrow: "Checklist",
    title: d.couple,
    body:
      `<p style="margin:0 0 16px">${escapeHtml(d.name ? `Ahoj ${d.name},` : "Ahoj,")}</p><p style="margin:0 0 12px">${n === 1 ? "blíží se termín tohoto úkolu:" : "blíží se termín těchto úkolů:"}</p>` +
      `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-top:1px solid ${COLORS.line};margin-bottom:24px">${rows}</table>` +
      button(`${d.appUrl}/app/checklist`, "Otevřít checklist"),
    footer: "Upozornění na úkoly posíláme těm, komu je úkol přiřazený.",
  });
  return { subject, html, text: htmlToText(html) };
}
