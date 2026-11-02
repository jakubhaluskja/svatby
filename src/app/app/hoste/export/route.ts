import ExcelJS from "exceljs";
import { dietNotes, guestStatus, highChairs, loadGuestBook, summarize } from "@/lib/guest-data";
import { createClient } from "@/lib/supabase/server";
import { getCurrentWedding } from "@/lib/wedding";

const STATUS = { yes: "Přijde", no: "Nepřijde", pending: "Čeká" } as const;

/** Seznam hostů a podklady pro catering v Excelu. */
export async function GET() {
  const wedding = await getCurrentWedding();
  if (!wedding) return new Response("Nepřihlášen", { status: 401 });

  const supabase = await createClient();
  const book = await loadGuestBook(supabase, wedding.id);
  const category = new Map(book.categories.map((c) => [c.id, c.label]));

  const wb = new ExcelJS.Workbook();
  wb.creator = "Svatby";

  // List 1: všichni hosté
  const guests = wb.addWorksheet("Hosté", { views: [{ state: "frozen", ySplit: 1 }] });
  guests.columns = [
    { header: "Domácnost", key: "household", width: 22 },
    { header: "Jméno", key: "first", width: 14 },
    { header: "Příjmení", key: "last", width: 16 },
    { header: "Kategorie", key: "category", width: 16 },
    ...book.events.map((e) => ({ header: e.name, key: `ev_${e.id}`, width: 14 })),
    { header: "Strava", key: "diet", width: 18 },
    { header: "Alergie", key: "allergies", width: 18 },
    { header: "Dětská židlička", key: "chair", width: 10 },
    { header: "Doprovod", key: "plus", width: 10 },
    { header: "Štítky", key: "tags", width: 20 },
    { header: "Ubytování", key: "lodging", width: 12 },
    { header: "Písnička", key: "song", width: 22 },
    { header: "E-mail", key: "email", width: 24 },
    { header: "Kód", key: "code", width: 9 },
  ];
  for (const h of book.households) {
    for (const g of h.guests) {
      const row: Record<string, string> = {
        household: h.name,
        first: g.first_name,
        last: g.last_name ?? "",
        category: g.age_category_id ? category.get(g.age_category_id) ?? "" : "",
        diet: g.diet ?? "",
        allergies: g.allergies ?? "",
        chair: g.needs_high_chair ? "ano" : "",
        plus: g.is_plus_one ? "ano" : "",
        tags: g.tags.join(", "),
        lodging: h.needs_lodging === null ? "" : h.needs_lodging ? "ano" : "ne",
        song: h.song_wish ?? "",
        email: g.email ?? h.email ?? "",
        code: h.short_code,
      };
      for (const e of book.events) {
        const s = guestStatus(h, g, e.id);
        row[`ev_${e.id}`] = s ? STATUS[s] : "Nepozván";
      }
      guests.addRow(row);
    }
  }
  guests.getRow(1).font = { bold: true };
  guests.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: guests.columnCount } };

  // List 2: catering – počty po kategoriích a strava
  const catering = wb.addWorksheet("Catering");
  for (const s of summarize(book)) {
    const title = catering.addRow([s.event.name]);
    title.font = { bold: true, size: 13 };
    catering.addRow(["Kategorie", "Potvrzeno"]).font = { bold: true };
    for (const c of book.categories) catering.addRow([c.label, s.byCategory.get(c.id) ?? 0]);
    if (s.byCategory.get(null)) catering.addRow(["Bez kategorie", s.byCategory.get(null)]);
    catering.addRow(["Celkem", s.yes]).font = { bold: true };
    catering.addRow(["Dětské židličky", highChairs(book, s.event.id)]);
    const diets = dietNotes(book, s.event.id);
    if (diets.length) {
      catering.addRow([]);
      catering.addRow(["Host", "Strava", "Alergie", "Domácnost"]).font = { bold: true };
      for (const d of diets) catering.addRow([d.guest, d.diet ?? "", d.allergies ?? "", d.household]);
    }
    catering.addRow([]);
  }
  catering.columns = [{ width: 26 }, { width: 18 }, { width: 22 }, { width: 22 }];

  const buffer = await wb.xlsx.writeBuffer();
  const filename = `hoste-${wedding.slug}.xlsx`;
  return new Response(buffer as ArrayBuffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
