import Link from "next/link";
import { SiteHero } from "@/components/site/site-hero";
import { createClient } from "@/lib/supabase/server";
import { requireWedding } from "@/lib/wedding";

export const metadata = { title: "Náhled webu" };

export default async function PreviewPage() {
  const wedding = await requireWedding();
  const supabase = await createClient();
  const [{ data: page }, { data: event }] = await Promise.all([
    supabase.from("site_pages").select("template").eq("wedding_id", wedding.id).eq("state", "draft").maybeSingle(),
    supabase.from("events").select("location_name").eq("wedding_id", wedding.id).order("sort").limit(1).maybeSingle(),
  ]);

  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between gap-4 border-b border-line bg-surface px-6 py-3 text-sm sm:px-10">
        <span className="text-ink-soft">Náhled. Web zatím vidíte jen vy.</span>
        <Link href="/app" className="font-medium underline underline-offset-2">
          Zpět na přehled
        </Link>
      </div>
      <SiteHero
        partner1={wedding.partner1_name}
        partner2={wedding.partner2_name}
        date={wedding.wedding_date}
        place={event?.location_name ?? null}
        template={page?.template ?? wedding.template}
        locale={wedding.default_locale}
      />
    </div>
  );
}
