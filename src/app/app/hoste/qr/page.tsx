import Link from "next/link";
import QRCode from "qrcode";
import { appDomain } from "@/lib/env";
import { householdUrl, siteUrl } from "@/lib/hosts";
import { createClient } from "@/lib/supabase/server";
import { requireWedding } from "@/lib/wedding";
import { PrintButton } from "../print-button";

export const metadata = { title: "QR kódy k tisku" };

export default async function QrPage() {
  const wedding = await requireWedding();
  const supabase = await createClient();
  const { data: households } = await supabase
    .from("households")
    .select("id, name, token, short_code")
    .eq("wedding_id", wedding.id)
    .order("sort");

  const domain = appDomain();
  const site = siteUrl(wedding.slug, domain).replace(/^https?:\/\//, "");
  const codes = await Promise.all(
    (households ?? []).map(async (h) => ({
      ...h,
      svg: await QRCode.toString(householdUrl(wedding.slug, h.token, domain), {
        type: "svg",
        margin: 0,
        errorCorrectionLevel: "M",
        color: { dark: "#1e2b26", light: "#ffffff" },
      }),
    })),
  );

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-8 px-6 py-10 sm:px-10 print:max-w-none print:p-0">
      <div className="flex flex-wrap items-end justify-between gap-4 print:hidden">
        <div className="flex flex-col gap-2">
          <Link href="/app/hoste" className="text-sm text-ink-soft hover:text-ink">Zpět na hosty</Link>
          <h1 className="font-display text-4xl font-semibold tracking-tight">QR kódy k tisku</h1>
          <p className="max-w-xl text-ink-soft">
            Každá domácnost má vlastní kód. Po naskenování se hostům otevře jejich pozvání. Vytiskněte je, nebo je uložte jako PDF a vložte do grafiky oznámení.
          </p>
        </div>
        <PrintButton />
      </div>

      {codes.length === 0 ? (
        <p className="text-ink-soft">Nejdřív přidejte hosty.</p>
      ) : (
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 print:grid-cols-3 print:gap-0">
          {codes.map((c) => (
            <li key={c.id} className="flex break-inside-avoid flex-col items-center gap-3 rounded-2xl border border-line bg-surface p-5 text-center print:rounded-none print:border-dashed">
              <div className="w-36" dangerouslySetInnerHTML={{ __html: c.svg }} />
              <span className="font-medium">{c.name}</span>
              <span className="text-xs text-ink-soft">
                {site}, kód <span className="font-mono tracking-wider text-ink">{c.short_code}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
