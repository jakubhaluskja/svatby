import { describe, expect, it } from "vitest";
import { byContributor, itemEstimate, lodgingCost, parseCnbEur, summarizeItems, totals, upcoming, type BudgetItem, type BudgetPayment } from "./budget";

const item = (p: Partial<BudgetItem>): BudgetItem => ({ id: "i", category_id: null, vendor_id: null, contributor_id: null, name: "x", currency: "CZK", estimate_amount: null, actual_amount: null, per_person: false, per_person_event_id: null, notes: null, sort: 0, ...p });
const pay = (p: Partial<BudgetPayment>): BudgetPayment => ({ id: "p", item_id: "i", contributor_id: null, label: null, amount: 0, currency: "CZK", due_date: null, paid_at: null, paid_amount_default_currency: null, ...p });

describe("rozpočet", () => {
  it("cena za osobu podle potvrzených hostů a věku", () => {
    const it1 = item({ id: "cat", per_person: true, per_person_event_id: "e" });
    const rates = [{ item_id: "cat", age_category_id: "adult", price: 1200 }, { item_id: "cat", age_category_id: "kid", price: 600 }];
    expect(itemEstimate(it1, rates, { e: { adult: 80, kid: 10 } })).toBe(80 * 1200 + 10 * 600);
  });

  it("součty v korunách včetně eur", () => {
    const items = [item({ id: "a", estimate_amount: 10000, actual_amount: 12000 }), item({ id: "b", currency: "EUR", estimate_amount: 1000 })];
    const payments = [pay({ item_id: "a", amount: 5000, paid_at: "2026-10-01" }), pay({ id: "q", item_id: "b", amount: 500, currency: "EUR", paid_at: "2026-10-02", paid_amount_default_currency: 12400 })];
    const s = summarizeItems(items, [], payments, {}, 25);
    const t = totals(s, 25, 30000);
    expect(t.estimate).toBe(10000 + 25000);
    expect(t.cost).toBe(12000 + 25000);
    expect(t.paid).toBe(5000 + 12400);
    expect(t.remaining).toBe(37000 - 17400);
    expect(t.overBy).toBe(7000);
  });

  it("přispěvatelé: přiřazené položky a zaplacené platby", () => {
    const items = [item({ id: "a", estimate_amount: 10000, contributor_id: "rodice" }), item({ id: "b", estimate_amount: 4000 })];
    const payments = [pay({ item_id: "a", amount: 3000, paid_at: "2026-10-01" }), pay({ id: "q", item_id: "b", amount: 4000, paid_at: "2026-10-01", contributor_id: "rodice" })];
    const s = summarizeItems(items, [], payments, {}, 25);
    const [r] = byContributor([{ id: "rodice", name: "Rodiče", pledged_amount: 50000, sort: 0 }], s, 25);
    expect(r.assigned).toBe(10000);
    expect(r.paid).toBe(7000);
  });

  it("nadcházející platby podle termínu", () => {
    expect(upcoming([pay({ id: "1", due_date: "2027-03-01" }), pay({ id: "2" }), pay({ id: "3", due_date: "2027-01-01" }), pay({ id: "4", due_date: "2026-01-01", paid_at: "2026-01-01" })]).map((p) => p.id)).toEqual(["3", "1", "2"]);
  });

  it("ubytování placené párem", () => {
    expect(lodgingCost([{ price: 2000, currency: "CZK", nights: 2, paid_by: "couple", occupied: true }, { price: 100, currency: "EUR", nights: 1, paid_by: "couple", occupied: true }, { price: 5000, currency: "CZK", nights: 1, paid_by: "guest", occupied: true }, { price: 3000, currency: "CZK", nights: 1, paid_by: "couple", occupied: false }], 25)).toBe(4000 + 2500);
  });

  it("kurz eura z lístku ČNB", () => {
    const txt = "03.11.2026 #213\nzemě|měna|množství|kód|kurz\nAustrálie|dolar|1|AUD|15,123\nEMU|euro|1|EUR|24,365\nJaponsko|jen|100|JPY|15,432\n";
    expect(parseCnbEur(txt)).toEqual({ date: "2026-11-03", rate: 24.365 });
    expect(parseCnbEur("nesmysl")).toBeNull();
  });
});
