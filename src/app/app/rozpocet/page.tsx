import type { BudgetCategory, BudgetItem, BudgetPayment, BudgetRate, Contributor, Headcount } from "@/lib/budget";
import { eurRate } from "@/lib/cnb";
import { loadGuestBook, summarize } from "@/lib/guest-data";
import { createClient } from "@/lib/supabase/server";
import { utcToZonedParts } from "@/lib/time";
import { moduleLevel, requireWedding } from "@/lib/wedding";
import { BudgetView, type VendorRow } from "./budget-view";

export const metadata = { title: "Rozpočet" };

type Props = { searchParams: Promise<{ tab?: string; polozka?: string }> };

const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));

export default async function BudgetPage({ searchParams }: Props) {
  const { tab, polozka } = await searchParams;
  const wedding = await requireWedding();
  const supabase = await createClient();
  const [cats, items, rates, payments, contributors, vendors, files, rooms, assigned, w, book, rate, level] = await Promise.all([
    supabase.from("budget_categories").select("id, name, planned_amount, sort").eq("wedding_id", wedding.id).order("sort"),
    supabase.from("budget_items").select("id, category_id, vendor_id, contributor_id, name, currency, estimate_amount, actual_amount, per_person, per_person_event_id, notes, sort").eq("wedding_id", wedding.id).order("sort").order("created_at"),
    supabase.from("budget_item_rates").select("item_id, age_category_id, price").eq("wedding_id", wedding.id),
    supabase.from("budget_payments").select("id, item_id, contributor_id, label, amount, currency, due_date, paid_at, paid_amount_default_currency").eq("wedding_id", wedding.id),
    supabase.from("contributors").select("id, name, pledged_amount, sort").eq("wedding_id", wedding.id).order("sort").order("created_at"),
    supabase.from("vendors").select("id, name, category, contact_name, phone, email, website, notes").eq("wedding_id", wedding.id).order("name"),
    supabase.from("vendor_files").select("id, vendor_id, name, storage_key, bytes").eq("wedding_id", wedding.id).order("created_at"),
    supabase.from("rooms").select("id, price, currency, nights, paid_by").eq("wedding_id", wedding.id),
    supabase.from("room_assignments").select("room_id").eq("wedding_id", wedding.id),
    supabase.from("weddings").select("budget_total").eq("id", wedding.id).single(),
    loadGuestBook(supabase, wedding.id),
    eurRate(),
    moduleLevel(wedding.id, "budget"),
  ]);

  const headcount: Headcount = {};
  for (const s of summarize(book)) {
    headcount[s.event.id] = Object.fromEntries([...s.byCategory.entries()].filter(([k]) => k).map(([k, v]) => [k as string, v]));
  }
  const occupied = new Set((assigned.data ?? []).map((a) => a.room_id));

  return (
    <BudgetView
      tab={tab === "platby" || tab === "dodavatele" || tab === "prispevatele" ? tab : "prehled"}
      initialItem={polozka && /^[0-9a-f-]{36}$/.test(polozka) ? polozka : null}
      today={utcToZonedParts(new Date().toISOString()).date}
      canEdit={level === "write"}
      weddingId={wedding.id}
      budgetTotal={num(w.data?.budget_total)}
      eur={rate}
      categories={(cats.data ?? []).map((c) => ({ ...c, planned_amount: num(c.planned_amount) })) as BudgetCategory[]}
      items={(items.data ?? []).map((i) => ({ ...i, estimate_amount: num(i.estimate_amount), actual_amount: num(i.actual_amount) })) as BudgetItem[]}
      rates={(rates.data ?? []).map((r) => ({ ...r, price: Number(r.price) })) as BudgetRate[]}
      payments={(payments.data ?? []).map((p) => ({ ...p, amount: Number(p.amount), paid_amount_default_currency: num(p.paid_amount_default_currency) })) as BudgetPayment[]}
      contributors={(contributors.data ?? []).map((c) => ({ ...c, pledged_amount: num(c.pledged_amount) })) as Contributor[]}
      vendors={(vendors.data ?? []) as VendorRow[]}
      files={(files.data ?? []).map((f) => ({ ...f, bytes: Number(f.bytes) }))}
      rooms={(rooms.data ?? []).map((r) => ({ price: num(r.price), currency: r.currency, nights: r.nights, paid_by: r.paid_by, occupied: occupied.has(r.id) }))}
      events={book.events.map((e) => ({ id: e.id, name: e.name }))}
      ageCategories={book.categories.map((c) => ({ id: c.id, label: c.label }))}
      headcount={headcount}
    />
  );
}
