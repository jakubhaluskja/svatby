import { linkDomain } from "@/lib/domain";
import { redirect } from "next/navigation";
import { siteUrl } from "@/lib/hosts";
import { requireWedding } from "@/lib/wedding";

/** Náhled webu = skutečný web; nezveřejněný koncept vidí přihlášený člen týmu. */
export default async function PreviewPage() {
  const wedding = await requireWedding();
  redirect(siteUrl(wedding.slug, await linkDomain()));
}
