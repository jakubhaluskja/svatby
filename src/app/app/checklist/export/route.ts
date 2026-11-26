import ExcelJS from "exceljs";
import { TASK_CATEGORIES } from "@/lib/checklist";
import { createClient } from "@/lib/supabase/server";
import { getCurrentWedding, moduleLevel } from "@/lib/wedding";

/** Checklist do Excelu. */
export async function GET() {
  const wedding = await getCurrentWedding();
  if (!wedding) return new Response("Nepřihlášen", { status: 401 });
  if ((await moduleLevel(wedding.id, "checklist")) === "none") return new Response("Bez oprávnění", { status: 403 });
  const supabase = await createClient();
  const [{ data: tasks }, { data: members }] = await Promise.all([
    supabase.from("tasks").select("id, parent_id, title, description, category, due_date, done_at, assignee_member_id, assignee_name, sort").eq("wedding_id", wedding.id).order("due_date", { nullsFirst: false }).order("sort"),
    supabase.from("wedding_members").select("id, display_name, invited_email").eq("wedding_id", wedding.id),
  ]);
  const who = new Map((members ?? []).map((m) => [m.id, m.display_name || m.invited_email || ""]));
  const catLabel = new Map(Object.entries(TASK_CATEGORIES as Record<string, { label: string }>).map(([k, v]) => [k, v.label]));
  const parentTitle = new Map((tasks ?? []).map((t) => [t.id, t.title]));

  const wb = new ExcelJS.Workbook();
  wb.creator = "Svatby";
  const s = wb.addWorksheet("Checklist", { views: [{ state: "frozen", ySplit: 1 }] });
  s.columns = [
    { header: "Hotovo", key: "done", width: 8 },
    { header: "Úkol", key: "title", width: 40 },
    { header: "Nadřazený úkol", key: "parent", width: 26 },
    { header: "Kategorie", key: "cat", width: 16 },
    { header: "Termín", key: "due", width: 12 },
    { header: "Kdo", key: "who", width: 18 },
    { header: "Popis", key: "desc", width: 40 },
  ];
  for (const t of tasks ?? []) {
    s.addRow({
      done: t.done_at ? "✓" : "",
      title: t.title,
      parent: t.parent_id ? (parentTitle.get(t.parent_id) ?? "") : "",
      cat: catLabel.get(t.category) ?? t.category ?? "",
      due: t.due_date ?? "",
      who: (t.assignee_member_id ? who.get(t.assignee_member_id) : null) || t.assignee_name || "",
      desc: t.description ?? "",
    });
  }
  s.getRow(1).font = { bold: true };
  s.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: s.columnCount } };
  const buf = await wb.xlsx.writeBuffer();
  return new Response(buf, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="checklist-${wedding.slug}.xlsx"`,
    },
  });
}
