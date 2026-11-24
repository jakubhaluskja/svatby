import { redirect } from "next/navigation";
import { linkDomain } from "@/lib/domain";
import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentWedding, requireUser } from "@/lib/wedding";
import { Wizard } from "./wizard";

export const metadata = { title: "Založení svatby" };

export default async function CreateWeddingPage() {
  if (await getCurrentWedding()) redirect("/app");
  const [domain, user] = await Promise.all([linkDomain(), requireUser()]);
  // Pozvaný do týmu, který se zaregistroval mimo odkaz z pozvánky.
  const { data: invite } = user.email
    ? await createAdminClient()
        .from("wedding_members")
        .select("invite_token, weddings!inner(partner1_name, partner2_name)")
        .eq("invited_email", user.email)
        .is("accepted_at", null)
        .gte("invited_at", new Date(Date.now() - 30 * 86_400_000).toISOString())
        .limit(1)
        .maybeSingle()
    : { data: null };
  const w = invite?.weddings as unknown as { partner1_name: string; partner2_name: string } | undefined;
  return (
    <>
      {invite && w ? (
        <div className="mx-auto mt-6 flex max-w-2xl flex-wrap items-center gap-3 rounded-2xl bg-eucalyptus-mist px-5 py-4 text-eucalyptus-deep">
          <p className="flex-1">
            Máte pozvánku do týmu svatby{" "}
            <strong>
              {w.partner1_name} & {w.partner2_name}
            </strong>
            . Nechcete zakládat vlastní?
          </p>
          <Link href={`/pozvanka/${invite.invite_token}`} className="rounded-full bg-eucalyptus px-4 py-2 text-sm font-medium text-white">
            Zobrazit pozvánku
          </Link>
        </div>
      ) : null}
      <Wizard appDomain={domain} />
    </>
  );
}
