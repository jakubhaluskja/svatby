import { z } from "zod";

/** Proměnné dostupné v prohlížeči i na serveru. */
const publicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  NEXT_PUBLIC_APP_DOMAIN: z.string().min(1).default("localhost:3000"),
});

/** Tajné proměnné – jen na serveru. */
const serverSchema = publicSchema.extend({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
});

export function publicEnv() {
  return publicSchema.parse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_APP_DOMAIN: process.env.NEXT_PUBLIC_APP_DOMAIN,
  });
}

export function serverEnv() {
  return serverSchema.parse(process.env);
}

/** Doména aplikace bez nutnosti ostatních proměnných (middleware, odkazy). */
export function appDomain(): string {
  return process.env.NEXT_PUBLIC_APP_DOMAIN || "localhost:3000";
}
