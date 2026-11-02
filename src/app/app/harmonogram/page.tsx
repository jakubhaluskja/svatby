import { requestOrigin } from "@/lib/origin";
import { sortSchedule, type ScheduleItem } from "@/lib/schedule";
import { createClient } from "@/lib/supabase/server";
import { utcToZonedParts } from "@/lib/time";
import { moduleLevel, requireWedding } from "@/lib/wedding";
import { ScheduleEditor, type ShareLink, type Vendor } from "./schedule-editor";

export const metadata = { title: "Harmonogram dne D" };

export default async function SchedulePage() {
  const wedding = await requireWedding();
  const supabase = await createClient();
  const [{ data: items }, { data: vendors }, { data: links }, level, origin] = await Promise.all([
    supabase
      .from("schedule_items")
      .select("id, starts_at, ends_at, title, location, responsible_name, vendor_id, contact, notes, sort")
      .eq("wedding_id", wedding.id),
    supabase.from("vendors").select("id, name, category, contact_name, phone, email").eq("wedding_id", wedding.id).order("name"),
    supabase.from("schedule_links").select("id, vendor_id, token").eq("wedding_id", wedding.id).is("revoked_at", null),
    moduleLevel(wedding.id, "checklist"),
    requestOrigin(),
  ]);

  const sorted = sortSchedule((items ?? []) as ScheduleItem[]);
  const local = Object.fromEntries(
    sorted.map((i) => {
      const s = utcToZonedParts(i.starts_at);
      return [i.id, { date: s.date, start: s.time, end: i.ends_at ? utcToZonedParts(i.ends_at).time : "" }];
    }),
  );
  const shareLinks: ShareLink[] = (links ?? []).map((l) => ({ id: l.id, vendor_id: l.vendor_id, url: `${origin}/harmonogram/${l.token}` }));

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8 px-6 py-10 sm:px-10">
      <div className="flex max-w-3xl flex-col gap-2">
        <h1 className="font-display text-4xl font-semibold tracking-tight">Harmonogram dne D</h1>
        <p className="text-ink-soft">
          Minutu po minutě: kdo kdy přijede, kde co probíhá a koho volat. Svědci a dodavatelé ho otevřou odkazem v mobilu.
        </p>
      </div>
      <ScheduleEditor
        items={sorted}
        local={local}
        vendors={(vendors ?? []) as Vendor[]}
        links={shareLinks}
        weddingDate={wedding.wedding_date}
        canEdit={level === "write"}
      />
    </div>
  );
}
