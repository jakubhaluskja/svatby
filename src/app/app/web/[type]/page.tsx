import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireWedding } from "@/lib/wedding";
import { GiftAccountForm } from "./gift-account-form";

export const metadata = { title: "Účet pro dary" };

type Props = { params: Promise<{ type: string }> };

/** Texty sekcí se upravují v editoru webu; tady zůstává jen nastavení účtu pro dary. */
export default async function SectionPage({ params }: Props) {
  const { type } = await params;
  if (type !== "gifts") redirect("/app/web/editor");
  const wedding = await requireWedding();
  const supabase = await createClient();
  const { data: gifts } = await supabase.from("gift_settings").select("account_number, account_holder, iban").eq("wedding_id", wedding.id).maybeSingle();

  return (
    <div className="flex max-w-3xl flex-col gap-8 px-6 py-8 sm:px-10 lg:py-10">
      <div className="flex flex-col gap-2">
        <Link href="/app/web" className="text-sm text-ink-soft hover:text-ink">Zpět na web</Link>
        <h1 className="font-serif text-4xl tracking-tight">Účet pro dary</h1>
        <p className="text-ink-soft">Číslo účtu se na webu zobrazí v sekci Dary i s QR platbou. Hosté si částku zvolí sami.</p>
      </div>
      <GiftAccountForm account={gifts?.account_number ?? ""} holder={gifts?.account_holder ?? ""} iban={gifts?.iban ?? null} />
    </div>
  );
}
