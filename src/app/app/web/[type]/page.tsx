import Link from "next/link";
import { notFound } from "next/navigation";
import { normalizeSections, SECTION_LABELS, SECTION_TYPES, type SectionType } from "@/lib/site-sections";
import { createClient } from "@/lib/supabase/server";
import { requireWedding } from "@/lib/wedding";
import { GiftAccountForm } from "./gift-account-form";
import { SectionEditor } from "./section-editor";

type Props = { params: Promise<{ type: string }> };

export async function generateMetadata({ params }: Props) {
  const { type } = await params;
  return { title: SECTION_LABELS[type as SectionType]?.cs ?? "Sekce webu" };
}

export default async function SectionPage({ params }: Props) {
  const { type } = await params;
  if (!SECTION_TYPES.includes(type as SectionType)) notFound();
  const wedding = await requireWedding();
  const supabase = await createClient();
  const [{ data: draft }, { data: w }, { data: gifts }] = await Promise.all([
    supabase.from("site_pages").select("sections").eq("wedding_id", wedding.id).eq("state", "draft").maybeSingle(),
    supabase.from("weddings").select("locales").eq("id", wedding.id).single(),
    type === "gifts"
      ? supabase.from("gift_settings").select("account_number, account_holder, iban").eq("wedding_id", wedding.id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const section = normalizeSections(draft?.sections).find((s) => s.type === type)!;
  const label = SECTION_LABELS[section.type];

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8 px-6 py-10 sm:px-10">
      <div className="flex flex-col gap-2">
        <Link href="/app/web" className="text-sm text-ink-soft hover:text-ink">Zpět na web</Link>
        <h1 className="font-display text-4xl font-semibold tracking-tight">{label.cs}</h1>
        <p className="text-ink-soft">
          {label.hint}
          {!section.enabled ? " Sekce je teď vypnutá, hosté ji neuvidí." : ""}
        </p>
      </div>
      <SectionEditor section={section} english={(w?.locales ?? []).includes("en")} weddingId={wedding.id} />
      {type === "gifts" ? (
        <GiftAccountForm account={gifts?.account_number ?? ""} holder={gifts?.account_holder ?? ""} iban={gifts?.iban ?? null} />
      ) : null}
    </div>
  );
}
