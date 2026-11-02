import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { sortSchedule, type ScheduleItem } from "@/lib/schedule";
import { createAdminClient } from "@/lib/supabase/admin";
import { LiveSchedule, type PublicItem } from "./live-schedule";

type Props = { params: Promise<{ token: string }>; searchParams: Promise<{ tisk?: string }> };

export const metadata: Metadata = {
  title: "Harmonogram svatby",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};
export const dynamic = "force-dynamic";

/** Veřejný harmonogram pro svědky a dodavatele. Bez účtu, přístup jen přes token. */
export default async function SharedSchedule({ params, searchParams }: Props) {
  const [{ token }, { tisk }] = await Promise.all([params, searchParams]);
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(token)) notFound();

  const admin = createAdminClient();
  const { data: link } = await admin
    .from("schedule_links")
    .select("wedding_id, vendor_id, weddings!inner(partner1_name, partner2_name, status)")
    .eq("token", token)
    .is("revoked_at", null)
    .maybeSingle();
  const wedding = link?.weddings as unknown as { partner1_name: string; partner2_name: string | null; status: string } | undefined;
  if (!link || !wedding || wedding.status === "deleted") notFound();

  let query = admin
    .from("schedule_items")
    .select("id, starts_at, ends_at, title, location, responsible_name, vendor_id, contact, notes, sort")
    .eq("wedding_id", link.wedding_id);
  if (link.vendor_id) query = query.eq("vendor_id", link.vendor_id);
  const [{ data: items }, { data: vendors }] = await Promise.all([
    query,
    admin.from("vendors").select("id, name, category, contact_name, phone, email").eq("wedding_id", link.wedding_id),
  ]);

  const vendorById = new Map((vendors ?? []).map((v) => [v.id as string, v]));
  const forVendor = link.vendor_id ? vendorById.get(link.vendor_id) : null;
  const publicItems: PublicItem[] = sortSchedule((items ?? []) as ScheduleItem[]).map((i) => {
    const v = i.vendor_id ? vendorById.get(i.vendor_id) : null;
    return {
      ...i,
      // Dodavatel vidí jen své položky, kontakty ostatních dodavatelů mu neposíláme.
      vendor: v && !forVendor ? { name: v.name as string, phone: (v.phone as string | null) ?? null } : null,
    };
  });
  const couple = [wedding.partner1_name, wedding.partner2_name].filter(Boolean).join(" a ");
  const vendorContacts = forVendor
    ? []
    : [...new Set(publicItems.map((i) => i.vendor_id).filter((id): id is string => !!id))]
        .map((id) => vendorById.get(id))
        .filter((v) => !!v)
        .map((v) => ({ name: v.name as string, category: (v.category as string | null) ?? null, contact_name: (v.contact_name as string | null) ?? null, phone: (v.phone as string | null) ?? null, email: (v.email as string | null) ?? null }));

  return (
    <LiveSchedule
      couple={couple}
      audience={forVendor ? (forVendor.name as string) : null}
      items={publicItems}
      vendors={vendorContacts}
      print={tisk === "1"}
    />
  );
}
