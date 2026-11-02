import { z } from "zod";

/** Proměnné dostupné v prohlížeči i na serveru. */
const publicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
  NEXT_PUBLIC_APP_DOMAIN: z.string().min(1).default("localhost:3000"),
});

/** Tajné proměnné – jen na serveru. */
const serverSchema = publicSchema.extend({
  SUPABASE_SECRET_KEY: z.string().min(1),
});

export function publicEnv() {
  return publicSchema.parse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    NEXT_PUBLIC_APP_DOMAIN: process.env.NEXT_PUBLIC_APP_DOMAIN,
  });
}

export function serverEnv() {
  return serverSchema.parse(process.env);
}

/** Doména aplikace bez nutnosti ostatních proměnných (middleware, odkazy). */
export function appDomain(): string {
  return normalizeDomain(process.env.NEXT_PUBLIC_APP_DOMAIN) || "localhost:3000";
}

/** Odstraní protokol, cestu a lomítka, kdyby někdo zadal celou adresu. */
export function normalizeDomain(value: string | undefined): string {
  return (value ?? "").trim().replace(/^https?:\/\//i, "").replace(/\/.*$/, "").toLowerCase();
}
