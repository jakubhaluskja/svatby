import "server-only";
import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { serverEnv } from "@/lib/env";

/** Hash hesla webu: scrypt$<sůl>$<hash> */
export function hashSitePassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 32).toString("hex");
  return `scrypt$${salt}$${hash}`;
}

export function verifySitePassword(password: string, stored: string | null): boolean {
  if (!stored) return false;
  const [scheme, salt, hash] = stored.split("$");
  if (scheme !== "scrypt" || !salt || !hash) return false;
  const candidate = scryptSync(password, salt, 32);
  const expected = Buffer.from(hash, "hex");
  return expected.length === candidate.length && timingSafeEqual(candidate, expected);
}

export function unlockCookieName(weddingId: string): string {
  return `web_${weddingId.slice(0, 8)}`;
}

/** Hodnota cookie po zadání hesla. Změnou hesla přestane platit. */
export function unlockToken(weddingId: string, passwordHash: string): string {
  return createHmac("sha256", serverEnv().SUPABASE_SECRET_KEY).update(`${weddingId}:${passwordHash}`).digest("base64url");
}

export function isUnlocked(weddingId: string, passwordHash: string | null, cookieValue: string | undefined): boolean {
  if (!passwordHash) return true;
  if (!cookieValue) return false;
  const expected = Buffer.from(unlockToken(weddingId, passwordHash));
  const actual = Buffer.from(cookieValue);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
