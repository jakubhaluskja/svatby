import ExcelJS from "exceljs";
import { createClient } from "@/lib/supabase/server";
import { getCurrentWedding, moduleLevel } from "@/lib/wedding";

/** Rozpočet do Excelu: položky a platby. */
export async function GET() {
  const wedding = await getCurrentWedding();
  if (!wedding) return new Response("Nepřihlášen", { status: 401 });
  if ((await moduleLevel(wedding.id, "budget")) === "none") return new Response("Bez oprávnění", { status: 403 });
  const supabase = await createClient();
  const [{ data: cats }, { data: items }, { data: payments }, { data: vendors }] = await Promise.all([
    supabase.from("budget_categories").select("id, name, planned_amount, sort").eq("wedding_id", wedding.id).order("sort"),
    supabase.from("budget_items").select("id, category_id, vendor_id, name, currency, estimate_amount, actual_amount, per_person, notes, sort").eq("wedding_id", wedding.id).order("sort"),
    supabase.from("budget_payments").select("item_id, label, amount, currency, due_date, paid_at").eq("wedding_id", wedding.id).order("due_date", { nullsFirst: false }),
    supabase.from("vendors").select("id, name").eq("wedding_id", wedding.id),
  ]);
  const catName = new Map((cats ?? []).map((c) => [c.id, c.name]));
  const vendorName = new Map((vendors ?? []).map((v) => [v.id, v.name]));
  const itemName = new Map((items ?? []).map((i) => [i.id, i.name]));
  const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));

  const wb = new ExcelJS.Workbook();
  wb.creator = "Svatby";
  const s1 = wb.addWorksheet("Položky", { views: [{ state: "frozen", ySplit: 1 }] });
  s1.columns = [
    { header: "Kategorie", key: "cat", width: 20 },
    { header: "Položka", key: "name", width: 28 },
    { header: "Dodavatel", key: "vendor", width: 22 },
    { header: "Měna", key: "cur", width: 7 },
    { header: "Odhad", key: "est", width: 12, style: { numFmt: "#,##0" } },
    { header: "Skutečnost", key: "act", width: 12, style: { numFmt: "#,##0" } },
    { header: "Zaplaceno", key: "paid", width: 12, style: { numFmt: "#,##0" } },
    { header: "Za osobu", key: "pp", width: 9 },
    { header: "Poznámka", key: "notes", width: 30 },
  ];
  for (const i of items ?? []) {
    const paid = (payments ?? []).filter((p) => p.item_id === i.id && p.paid_at).reduce((a, p) => a + Number(p.amount), 0);
    s1.addRow({
      cat: i.category_id ? (catName.get(i.category_id) ?? "") : "",
      name: i.name,
      vendor: i.vendor_id ? (vendorName.get(i.vendor_id) ?? "") : "",
      cur: i.currency,
      est: num(i.estimate_amount),
      act: num(i.actual_amount),
      paid: paid || null,
      pp: i.per_person ? "ano" : "",
      notes: i.notes ?? "",
    });
  }
  s1.getRow(1).font = { bold: true };
  s1.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: s1.columnCount } };

  const s2 = wb.addWorksheet("Platby", { views: [{ state: "frozen", ySplit: 1 }] });
  s2.columns = [
    { header: "Položka", key: "item", width: 28 },
    { header: "Platba", key: "label", width: 20 },
    { header: "Částka", key: "amount", width: 12, style: { numFmt: "#,##0" } },
    { header: "Měna", key: "cur", width: 7 },
    { header: "Splatnost", key: "due", width: 12 },
    { header: "Zaplaceno", key: "paid", width: 12 },
  ];
  for (const p of payments ?? []) {
    s2.addRow({ item: itemName.get(p.item_id) ?? "", label: p.label ?? "", amount: Number(p.amount), cur: p.currency, due: p.due_date ?? "", paid: p.paid_at ?? "" });
  }
  s2.getRow(1).font = { bold: true };

  const buf = await wb.xlsx.writeBuffer();
  return new Response(buf, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="rozpocet-${wedding.slug}.xlsx"`,
    },
  });
}
