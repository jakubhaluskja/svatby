/**
 * Bohatý text webu: jen odstavce, zalomení, tučné, kurzíva a odkazy.
 * Bez DOM, funguje na serveru i v prohlížeči. Vše ostatní se zahodí nebo escapuje.
 */

const ESC: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
export const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ESC[c]);

const decode = (s: string) =>
  s
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");

function safeHref(raw: string): string | null {
  const href = decode(raw).trim();
  if (/^(https?:\/\/|mailto:|tel:)/i.test(href) && !/[\s<>"']/.test(href)) return href;
  if (/^www\.[^\s<>"']+$/i.test(href)) return `https://${href}`;
  return null;
}

const INLINE: Record<string, string> = { strong: "strong", b: "strong", em: "em", i: "em" };
const BLOCK = new Set(["p", "div", "h1", "h2", "h3", "li", "blockquote"]);

/** Vyčistí HTML z editoru do povolené podmnožiny; výsledek je vždy seznam odstavců <p>. */
export function sanitizeRich(input: string): string {
  if (!input) return "";
  if (!/[<&]/.test(input)) return plainToRich(input);
  const tokens = input.replace(/<!--[\s\S]*?-->/g, "").split(/(<[^>]*>)/);
  const paras: string[] = [];
  let cur = "";
  const open: string[] = [];
  const closeAll = () => {
    for (let i = open.length - 1; i >= 0; i--) cur += `</${open[i]}>`;
  };
  const flush = () => {
    closeAll();
    const text = cur.replace(/(<br>)+$/g, "").trim();
    if (text.replace(/<[^>]+>/g, "").trim() || /<br>/.test(text)) paras.push(text);
    cur = "";
    const reopen = [...open];
    for (const t of reopen) cur += t === "a" ? "" : `<${t}>`;
    if (reopen.includes("a")) open.splice(open.indexOf("a"), 1);
  };
  let skip = 0;
  for (const tok of tokens) {
    if (!tok) continue;
    if (tok.startsWith("<")) {
      const m = /^<\s*(\/)?\s*([a-z0-9]+)([^>]*)>$/i.exec(tok);
      if (!m) continue;
      const closing = !!m[1];
      const name = m[2].toLowerCase();
      if (name === "script" || name === "style") {
        skip += closing ? -1 : 1;
        skip = Math.max(0, skip);
        continue;
      }
      if (skip) continue;
      if (name === "br") cur += "<br>";
      else if (BLOCK.has(name)) flush();
      else if (INLINE[name]) {
        const tag = INLINE[name];
        if (!closing && !open.includes(tag)) {
          open.push(tag);
          cur += `<${tag}>`;
        } else if (closing && open.includes(tag)) {
          const at = open.lastIndexOf(tag);
          for (let i = open.length - 1; i >= at; i--) cur += `</${open[i]}>`;
          const rest = open.splice(at);
          rest.shift();
          for (const t of rest) {
            open.push(t);
            cur += `<${t}>`;
          }
        }
      } else if (name === "a") {
        if (!closing && !open.includes("a")) {
          const hm = /href\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(m[3]);
          const href = hm ? safeHref(hm[2] ?? hm[3] ?? hm[4] ?? "") : null;
          if (href) {
            open.push("a");
            const ext = /^https?:/i.test(href);
            cur += `<a href="${escapeHtml(href)}"${ext ? ' target="_blank" rel="noopener noreferrer"' : ""}>`;
          }
        } else if (closing && open.includes("a")) {
          const at = open.lastIndexOf("a");
          for (let i = open.length - 1; i >= at; i--) cur += `</${open[i]}>`;
          const rest = open.splice(at);
          rest.shift();
          for (const t of rest) {
            open.push(t);
            cur += `<${t}>`;
          }
        }
      }
      continue;
    }
    if (skip) continue;
    cur += escapeHtml(decode(tok));
  }
  flush();
  return paras.map((p) => `<p>${p}</p>`).join("");
}

/** Starý prostý text (odstavce oddělené prázdným řádkem) na bohatý text. */
export function plainToRich(text: string): string {
  return text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${escapeHtml(p).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

/** Text bez značek (náhledy, délka, prázdnost). */
export function richToPlain(html: string): string {
  if (!/[<&]/.test(html)) return html;
  return decode(html.replace(/<br\s*\/?>/gi, "\n").replace(/<\/p>\s*<p>/gi, "\n\n").replace(/<[^>]+>/g, "")).trim();
}
