import { redirect } from "next/navigation";
import { appDomain } from "@/lib/env";
import { siteUrl } from "@/lib/hosts";
import { requireWedding } from "@/lib/wedding";

/** Náhled webu = skutečný web; nezveřejněný koncept vidí přihlášený člen týmu. */
export default async function PreviewPage() {
  const wedding = await requireWedding();
  redirect(siteUrl(wedding.slug, appDomain()));
}
