import "server-only";
import { createHash } from "node:crypto";

/**
 * Zjistí, zda heslo uniklo při známých únicích dat (Have I Been Pwned).
 * Posílá se jen prvních 5 znaků SHA-1 otisku (k-anonymita), heslo neopouští server.
 * Když služba neodpoví, registraci neblokujeme.
 */
export async function isPwnedPassword(password: string): Promise<boolean> {
  const hash = createHash("sha1").update(password).digest("hex").toUpperCase();
  const prefix = hash.slice(0, 5);
  const suffix = hash.slice(5);
  try {
    const res = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
      headers: { "Add-Padding": "true" },
      signal: AbortSignal.timeout(2500),
      cache: "no-store",
    });
    if (!res.ok) return false;
    const body = await res.text();
    return body.split("\n").some((line) => {
      const [s, count] = line.trim().split(":");
      return s === suffix && Number(count) > 0;
    });
  } catch {
    return false;
  }
}
