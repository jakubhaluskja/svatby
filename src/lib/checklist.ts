/** Rozdělení úkolů checklistu podle toho, kolik času zbývá do svatby. */

export type ChecklistTask = {
  id: string;
  parent_id: string | null;
  title: string;
  description: string | null;
  due_date: string | null;
  done_at: string | null;
  assignee_member_id: string | null;
  assignee_name: string | null;
  assignee_email: string | null;
  source: string;
  sort: number;
  category?: TaskCategory | null;
};

export const TASK_CATEGORIES = {
  planning: { label: "Plánování", bg: "#eef0ea", fg: "#4a5a53" },
  guests: { label: "Hosté", bg: "#f3e6ec", fg: "#7b3f5c" },
  vendors: { label: "Dodavatelé", bg: "#e3ece7", fg: "#3c5a4d" },
  attire: { label: "Oblečení", bg: "#f6ece2", fg: "#7a4f2c" },
  ceremony: { label: "Obřad", bg: "#efe6f3", fg: "#5e3f7b" },
  web: { label: "Web", bg: "#e5e9f2", fg: "#36466b" },
  day: { label: "Den D", bg: "#f5eedb", fg: "#7a5f1f" },
} as const;
export type TaskCategory = keyof typeof TASK_CATEGORIES;

export type Bucket = { key: string; label: string; tasks: ChecklistTask[] };

const DAY = 86_400_000;
const toDay = (iso: string) => Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)));

/** Období vůči datu svatby (dny před svatbou). */
const PERIODS: { key: string; label: string; from: number }[] = [
  { key: "12m", label: "Rok a víc předem", from: 335 },
  { key: "9m", label: "9 až 12 měsíců předem", from: 245 },
  { key: "6m", label: "6 až 9 měsíců předem", from: 152 },
  { key: "3m", label: "3 až 6 měsíců předem", from: 61 },
  { key: "1m", label: "3 týdny až 2 měsíce předem", from: 22 },
  { key: "3w", label: "Poslední 3 týdny", from: 8 },
  { key: "1w", label: "Poslední týden", from: 1 },
  { key: "d", label: "Den svatby", from: 0 },
  { key: "after", label: "Po svatbě", from: -Infinity },
];

export function periodOf(due: string, weddingDate: string): string {
  const before = Math.round((toDay(weddingDate) - toDay(due)) / DAY);
  return PERIODS.find((p) => before >= p.from)!.key;
}

/** Časová osa: úkoly po obdobích, v každém podle termínu. */
export function timeline(tasks: ChecklistTask[], weddingDate: string | null): Bucket[] {
  const top = tasks.filter((t) => !t.parent_id);
  const sorted = [...top].sort((a, b) => (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999") || a.sort - b.sort);
  if (!weddingDate) {
    const dated = sorted.filter((t) => t.due_date);
    const undated = sorted.filter((t) => !t.due_date);
    return [
      ...(dated.length ? [{ key: "dated", label: "S termínem", tasks: dated }] : []),
      ...(undated.length ? [{ key: "none", label: "Bez termínu", tasks: undated }] : []),
    ];
  }
  const buckets: Bucket[] = PERIODS.map((p) => ({ key: p.key, label: p.label, tasks: [] }));
  const none: Bucket = { key: "none", label: "Bez termínu", tasks: [] };
  for (const t of sorted) {
    if (!t.due_date) none.tasks.push(t);
    else buckets.find((b) => b.key === periodOf(t.due_date!, weddingDate))!.tasks.push(t);
  }
  return [...buckets, none].filter((b) => b.tasks.length > 0);
}

/** Úkoly po termínu (nehotové, termín už minul). */
export function overdue(tasks: ChecklistTask[], today: string): ChecklistTask[] {
  return tasks.filter((t) => !t.parent_id && !t.done_at && t.due_date && t.due_date < today).sort((a, b) => a.due_date!.localeCompare(b.due_date!));
}

/** Úkoly s termínem v nejbližších 7 dnech (včetně dneška). */
export function thisWeek(tasks: ChecklistTask[], today: string): ChecklistTask[] {
  const end = new Date(toDay(today) + 6 * DAY).toISOString().slice(0, 10);
  return tasks
    .filter((t) => !t.parent_id && !t.done_at && t.due_date && t.due_date >= today && t.due_date <= end)
    .sort((a, b) => a.due_date!.localeCompare(b.due_date!));
}

/** Kolik dní do termínu (záporné = po termínu). */
export function daysTo(due: string, today: string): number {
  return Math.round((toDay(due) - toDay(today)) / DAY);
}
