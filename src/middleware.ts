import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { parseHost, usesPathSites } from "@/lib/hosts";
import { appDomain } from "@/lib/env";

/**
 * Multi-tenant routing:
 *  - subdoména  jana-a-petr.app.cz/...  → /site/jana-a-petr/...
 *  - vlastní doména novakovi.cz/...     → /site/novakovi.cz/...
 *    (slug nesmí obsahovat tečku, takže hostname se od slugu pozná)
 *  - doména aplikace                     → beze změny, obnova přihlášení
 */
export async function middleware(request: NextRequest) {
  const target = parseHost(request.headers.get("host"), appDomain());
  const url = request.nextUrl.clone();

  if (target.kind !== "app") {
    const site = target.kind === "site" ? target.slug : target.hostname;
    url.pathname = `/site/${encodeURIComponent(site)}${url.pathname === "/" ? "" : url.pathname}`;
    return NextResponse.rewrite(url);
  }

  // Interní cesta /site/* je přímo dostupná jen tam, kde nejsou subdomény (Vercel náhled, vývoj).
  if (url.pathname.startsWith("/site/") && !usesPathSites(appDomain()) && process.env.NODE_ENV === "production") {
    url.pathname = "/404";
    return NextResponse.rewrite(url);
  }

  return refreshSession(request);
}

async function refreshSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!supabaseUrl || !publishableKey) return response;

  const supabase = createServerClient(supabaseUrl, publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Administrace páru vyžaduje přihlášení.
  if (!user && request.nextUrl.pathname.startsWith("/app")) {
    const login = request.nextUrl.clone();
    login.pathname = "/prihlaseni";
    login.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(login);
  }

  return response;
}

export const config = {
  matcher: [
    // vše kromě statických souborů a obrázků
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico)$).*)",
  ],
};
