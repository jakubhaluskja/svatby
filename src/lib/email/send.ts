import "server-only";

/**
 * Odesílání přes Resend (REST API, bez SDK).
 * Bez RESEND_API_KEY se nic neodesílá – aplikace funguje dál a v UI ukáže, že e-maily nejsou zapnuté.
 */
export type OutgoingEmail = {
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string | null;
  headers?: Record<string, string>;
};

export type SendResult = { id: string } | { error: string };

export function emailEnabled(): boolean {
  return !!process.env.RESEND_API_KEY;
}

function sender(name?: string): string {
  const from = process.env.EMAIL_FROM || "Svatby <onboarding@resend.dev>";
  if (!name) return from;
  // Jméno odesílatele podle páru, adresa zůstává ověřená doména platformy.
  const address = from.match(/<([^>]+)>/)?.[1] ?? from;
  return `${name.replace(/["<>\r\n]/g, "")} <${address}>`;
}

function body(m: OutgoingEmail, fromName?: string) {
  return {
    from: sender(fromName),
    to: [m.to],
    subject: m.subject,
    html: m.html,
    text: m.text,
    ...(m.replyTo ? { reply_to: m.replyTo } : {}),
    ...(m.headers ? { headers: m.headers } : {}),
  };
}

async function call(path: string, payload: unknown): Promise<{ ok: boolean; json: unknown; status: number }> {
  const res = await fetch(`https://api.resend.com${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
  });
  let json: unknown = null;
  try {
    json = await res.json();
  } catch {
    json = null;
  }
  return { ok: res.ok, json, status: res.status };
}

/** Odešle jeden e-mail. */
export async function sendEmail(m: OutgoingEmail, fromName?: string): Promise<SendResult> {
  if (!emailEnabled()) return { error: "disabled" };
  try {
    const r = await call("/emails", body(m, fromName));
    const id = (r.json as { id?: string } | null)?.id;
    if (r.ok && id) return { id };
    return { error: (r.json as { message?: string } | null)?.message ?? `HTTP ${r.status}` };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "network" };
  }
}

/** Hromadné odeslání (po 100 kusech, výsledek ve stejném pořadí). */
export async function sendBatch(messages: OutgoingEmail[], fromName?: string): Promise<SendResult[]> {
  if (!emailEnabled()) return messages.map(() => ({ error: "disabled" }));
  const out: SendResult[] = [];
  for (let i = 0; i < messages.length; i += 100) {
    const chunk = messages.slice(i, i + 100);
    try {
      const r = await call("/emails/batch", chunk.map((m) => body(m, fromName)));
      const data = (r.json as { data?: { id: string }[] } | null)?.data;
      if (r.ok && data?.length === chunk.length) out.push(...data.map((d) => ({ id: d.id })));
      else {
        const msg = (r.json as { message?: string } | null)?.message ?? `HTTP ${r.status}`;
        out.push(...chunk.map(() => ({ error: msg })));
      }
    } catch (e) {
      out.push(...chunk.map(() => ({ error: e instanceof Error ? e.message : "network" })));
    }
  }
  return out;
}

/** Ověření podpisu webhooku Resend (Svix): HMAC-SHA256 z „id.timestamp.tělo“. */
export async function verifyWebhook(secret: string, id: string, timestamp: string, payload: string, signatures: string): Promise<boolean> {
  if (!id || !timestamp || !signatures) return false;
  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || Math.abs(Date.now() / 1000 - ts) > 300) return false;
  const key = Uint8Array.from(Buffer.from(secret.replace(/^whsec_/, ""), "base64"));
  const cryptoKey = await crypto.subtle.importKey("raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = await crypto.subtle.sign("HMAC", cryptoKey, new TextEncoder().encode(`${id}.${timestamp}.${payload}`));
  const expected = Buffer.from(mac).toString("base64");
  return signatures.split(" ").some((s) => {
    const [version, sig] = s.split(",");
    if (version !== "v1" || !sig || sig.length !== expected.length) return false;
    let diff = 0;
    for (let i = 0; i < sig.length; i++) diff |= sig.charCodeAt(i) ^ expected.charCodeAt(i);
    return diff === 0;
  });
}
