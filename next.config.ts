import type { NextConfig } from "next";

const supabaseHost = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").hostname;
  } catch {
    return "*.supabase.co";
  }
})();

const nextConfig: NextConfig = {
  experimental: {
    // Navigace zpět na už navštívenou stránku je okamžitá; akce s revalidatePath cache zneplatní.
    staleTimes: { dynamic: 30 },
    optimizePackageImports: ["@supabase/supabase-js", "zod"],
  },
  images: {
    remotePatterns: [{ protocol: "https", hostname: supabaseHost, pathname: "/storage/v1/object/public/**" }],
  },
};

export default nextConfig;
