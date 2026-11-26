import Link from "next/link";
import { sortSchedule, type ScheduleItem } from "@/lib/schedule";
import { createClient } from "@/lib/supabase/server";
import { utcToZonedParts } from "@/lib/time";
import { requireWedding } from "@/lib/wedding";
import { DayView } from "./day-view";

export const metadata = { title: "Den D" };

/** Zobrazení pro svatební den v mobilu: co je teď, co dál, koho volat. */
export default async function DayPage() {
  const wedding = await requireWedding();
  const supabase = await createClient();
  const [{ data: items }, { data: vendors }, { data: events }] = await Promise.all([
    supabase.from("schedule_items").select("id, starts_at, ends_at, title, location, responsible_name, vendor_id, contact, notes, sort").eq("wedding_id", wedding.id),
    supabase.from("vendors").select("id, name, category, contact_name, phone, email").eq("wedding_id", wedding.id).order("name"),
    supabase.from("events").select("id, name, location_name, address, plan_b_active, plan_b_location_name, plan_b_address").eq("wedding_id", wedding.id).order("starts_at", { nullsFirst: false }),
  ]);
  const sorted = sortSchedule((items ?? []) as ScheduleItem[]);
  const vendorById = new Map((vendors ?? []).map((v) => [v.id, v]));

  return (
    <div className="flex max-w-2xl flex-col gap-6 px-5 py-6 sm:px-10 lg:py-10">
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-serif text-4xl tracking-tight">Den D</h1>
        <Link href="/app/harmonogram" className="text-sm text-ink-soft hover:text-ink">
          Upravit harmonogram
        </Link>
      </div>
      <DayView
        items={sorted.map((i) => ({
          id: i.id,
          startsAt: i.starts_at,
          endsAt: i.ends_at,
          date: utcToZonedParts(i.starts_at).date,
          start: utcToZonedParts(i.starts_at).time,
          end: i.ends_at ? utcToZonedParts(i.ends_at).time : null,
          title: i.title,
          location: i.location,
          responsible: i.responsible_name,
          contact: i.contact,
          notes: i.notes,
          vendor: i.vendor_id ? (vendorById.get(i.vendor_id)?.name ?? null) : null,
          vendorPhone: i.vendor_id ? (vendorById.get(i.vendor_id)?.phone ?? null) : null,
        }))}
        vendors={(vendors ?? []).filter((v) => v.phone || v.email).map((v) => ({ id: v.id, name: v.name, category: v.category, person: v.contact_name, phone: v.phone, email: v.email }))}
        places={(events ?? [])
          .map((e) => ({
            name: (e.name as { cs?: string }).cs ?? "",
            place: e.plan_b_active ? e.plan_b_location_name : e.location_name,
            address: e.plan_b_active ? e.plan_b_address : e.address,
            planB: !!e.plan_b_active,
          }))
          .filter((p) => p.place || p.address)}
        weddingDate={wedding.wedding_date}
      />
    </div>
  );
}
