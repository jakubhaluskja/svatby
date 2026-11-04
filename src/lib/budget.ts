/** Výpočty rozpočtu svatby. Vše se sčítá v korunách; eura se převádí kurzem ČNB. */

export type Currency = "CZK" | "EUR";

export type BudgetCategory = { id: string; name: string; planned_amount: number | null; sort: number };
export type BudgetItem = {
  id: string;
  category_id: string | null;
  vendor_id: string | null;
  contributor_id: string | null;
  name: string;
  currency: Currency;
  estimate_amount: number | null;
  actual_amount: number | null;
  per_person: boolean;
  per_person_event_id: string | null;
  notes: string | null;
  sort: number;
};
export type BudgetRate = { item_id: string; age_category_id: string; price: number };
export type BudgetPayment = {
  id: string;
  item_id: string;
  contributor_id: string | null;
  label: string | null;
  amount: number;
  currency: Currency;
  due_date: string | null;
  paid_at: string | null;
  paid_amount_default_currency: number | null;
};
export type Contributor = { id: string; name: string; pledged_amount: number | null; sort: number };

/** Počet potvrzených hostů události po věkových kategoriích. */
export type Headcount = Record<string, Record<string, number>>; // eventId → ageCategoryId → počet

export const toCzk = (amount: number, currency: Currency, eur: number) => (currency === "EUR" ? amount * eur : amount);

/** Odhad položky v její měně: pevná částka, nebo cena za osobu × potvrzení hosté. */
export function itemEstimate(item: BudgetItem, rates: BudgetRate[], headcount: Headcount): number {
  if (!item.per_person) return item.estimate_amount ?? 0;
  const counts = item.per_person_event_id ? headcount[item.per_person_event_id] ?? {} : {};
  return rates.filter((r) => r.item_id === item.id).reduce((sum, r) => sum + r.price * (counts[r.age_category_id] ?? 0), 0);
}

/** Skutečná cena, jinak odhad (v měně položky). */
export function itemCost(item: BudgetItem, rates: BudgetRate[], headcount: Headcount): number {
  return item.actual_amount ?? itemEstimate(item, rates, headcount);
}

export function paymentCzk(p: BudgetPayment, eur: number): number {
  return p.paid_at && p.paid_amount_default_currency !== null ? p.paid_amount_default_currency : toCzk(p.amount, p.currency, eur);
}

export type ItemSummary = { item: BudgetItem; estimate: number; cost: number; costCzk: number; paidCzk: number; scheduledCzk: number; payments: BudgetPayment[] };

export function summarizeItems(items: BudgetItem[], rates: BudgetRate[], payments: BudgetPayment[], headcount: Headcount, eur: number): ItemSummary[] {
  return items.map((item) => {
    const estimate = itemEstimate(item, rates, headcount);
    const cost = item.actual_amount ?? estimate;
    const own = payments.filter((p) => p.item_id === item.id).sort((a, b) => (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999"));
    return {
      item,
      estimate,
      cost,
      costCzk: toCzk(cost, item.currency, eur),
      paidCzk: own.filter((p) => p.paid_at).reduce((s, p) => s + paymentCzk(p, eur), 0),
      scheduledCzk: own.reduce((s, p) => s + paymentCzk(p, eur), 0),
      payments: own,
    };
  });
}

export type BudgetTotals = { planned: number | null; estimate: number; cost: number; paid: number; remaining: number; overBy: number };

export function totals(summaries: ItemSummary[], eur: number, budgetTotal: number | null, extraCzk = 0): BudgetTotals {
  const estimate = summaries.reduce((s, x) => s + toCzk(x.estimate, x.item.currency, eur), 0) + extraCzk;
  const cost = summaries.reduce((s, x) => s + x.costCzk, 0) + extraCzk;
  const paid = summaries.reduce((s, x) => s + x.paidCzk, 0);
  return { planned: budgetTotal, estimate, cost, paid, remaining: Math.max(0, cost - paid), overBy: budgetTotal !== null ? Math.max(0, cost - budgetTotal) : 0 };
}

export type ContributorSummary = { contributor: Contributor; assigned: number; paid: number };

/** Kolik kdo slíbil, kolik mu připadá položek a kolik už zaplatil. */
export function byContributor(contributors: Contributor[], summaries: ItemSummary[], eur: number): ContributorSummary[] {
  return contributors.map((c) => ({
    contributor: c,
    assigned: summaries.filter((s) => s.item.contributor_id === c.id).reduce((t, s) => t + s.costCzk, 0),
    paid: summaries
      .flatMap((s) => s.payments.map((p) => ({ p, owner: p.contributor_id ?? s.item.contributor_id })))
      .filter(({ p, owner }) => owner === c.id && p.paid_at)
      .reduce((t, { p }) => t + paymentCzk(p, eur), 0),
  }));
}

/** Platby, které ještě nejsou zaplacené, podle termínu (bez termínu na konci). */
export function upcoming(payments: BudgetPayment[]): BudgetPayment[] {
  return payments.filter((p) => !p.paid_at).sort((a, b) => (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999"));
}

/** Pokoje, které platí pár: cena za noc × noci u obsazených pokojů. */
export function lodgingCost(rooms: { price: number | null; currency: Currency; nights: number; paid_by: string; occupied: boolean }[], eur: number): number {
  return rooms.filter((r) => r.paid_by === "couple" && r.occupied && r.price).reduce((s, r) => s + toCzk(r.price! * r.nights, r.currency, eur), 0);
}

export function formatMoney(amount: number, currency: Currency = "CZK"): string {
  return new Intl.NumberFormat("cs-CZ", { style: "currency", currency, maximumFractionDigits: currency === "CZK" ? 0 : 2 }).format(amount);
}

/** Z kurzovního lístku ČNB (denni_kurz.txt) vytáhne kurz eura. */
export function parseCnbEur(text: string): { date: string; rate: number } | null {
  const lines = text.trim().split(/\r?\n/);
  const head = /^(\d{2})\.(\d{2})\.(\d{4})/.exec(lines[0] ?? "");
  const eur = lines.find((l) => /\|EUR\|/.test(l));
  if (!head || !eur) return null;
  const parts = eur.split("|");
  const amount = Number(parts[2]);
  const rate = Number(parts[4].replace(",", "."));
  if (!amount || !rate) return null;
  return { date: `${head[3]}-${head[2]}-${head[1]}`, rate: rate / amount };
}
