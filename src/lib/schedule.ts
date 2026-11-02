/** Harmonogram dne D: co se děje teď a co přijde. */

export type ScheduleItem = {
  id: string;
  starts_at: string;
  ends_at: string | null;
  title: string;
  location: string | null;
  responsible_name: string | null;
  vendor_id: string | null;
  contact: string | null;
  notes: string | null;
  sort: number;
};

export function sortSchedule<T extends Pick<ScheduleItem, "starts_at" | "sort">>(items: T[]): T[] {
  return [...items].sort((a, b) => a.starts_at.localeCompare(b.starts_at) || a.sort - b.sort);
}

/**
 * Stav položek vůči času: proběhlé, právě probíhající, další na řadě.
 * Položka bez konce trvá do začátku další položky.
 */
export function scheduleState<T extends Pick<ScheduleItem, "id" | "starts_at" | "ends_at" | "sort">>(
  items: T[],
  now: Date,
  upcomingCount = 2,
): { past: Set<string>; current: Set<string>; next: string[] } {
  const sorted = sortSchedule(items);
  const t = now.getTime();
  const past = new Set<string>();
  const current = new Set<string>();
  sorted.forEach((item, i) => {
    const start = Date.parse(item.starts_at);
    const following = sorted.slice(i + 1).find((x) => Date.parse(x.starts_at) > start);
    const end = item.ends_at ? Date.parse(item.ends_at) : following ? Date.parse(following.starts_at) : start + 60 * 60_000;
    if (t >= end) past.add(item.id);
    else if (t >= start) current.add(item.id);
  });
  const next = sorted.filter((i) => Date.parse(i.starts_at) > t).slice(0, upcomingCount).map((i) => i.id);
  return { past, current, next };
}
