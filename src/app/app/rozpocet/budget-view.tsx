"use client";

import { useMemo, useRef, useState, useTransition, type ReactNode } from "react";
import { CheckCircle } from "@/components/check-circle";
import { Icon } from "@/components/icons";
import { Avatar, Eyebrow, FormMessage } from "@/components/ui";
import {
  byContributor,
  formatMoney,
  lodgingCost,
  summarizeItems,
  toCzk,
  totals,
  upcoming,
  type BudgetCategory,
  type BudgetItem,
  type BudgetPayment,
  type BudgetRate,
  type Contributor,
  type Currency,
  type Headcount,
  type ItemSummary,
} from "@/lib/budget";
import type { EurRate } from "@/lib/cnb";
import { createClient } from "@/lib/supabase/client";
import {
  addVendorFile,
  deleteCategory,
  deleteContributor,
  deleteItem,
  deletePayment,
  deleteVendor,
  deleteVendorFile,
  saveBudgetTotal,
  saveCategory,
  saveContributor,
  saveItem,
  savePayment,
  saveVendor,
  setPaid,
  type Result,
} from "./actions";

export type VendorRow = { id: string; name: string; category: string | null; contact_name: string | null; phone: string | null; email: string | null; website: string | null; notes: string | null };
type FileRow = { id: string; vendor_id: string; name: string; storage_key: string; bytes: number };
type Tab = "prehled" | "platby" | "dodavatele" | "prispevatele";

const field = "h-10 w-full rounded-lg border border-line bg-surface px-3 text-[15px] focus:border-eucalyptus focus:outline-none";
const label = "flex flex-col gap-1 text-sm font-medium";
const kc = (n: number) => formatMoney(Math.round(n));
const shortDate = new Intl.DateTimeFormat("cs-CZ", { day: "numeric", month: "numeric", year: "numeric", timeZone: "UTC" });
const fmtDate = (d: string) => shortDate.format(new Date(`${d}T00:00:00Z`));

type Props = {
  tab: Tab;
  initialItem: string | null;
  today: string;
  canEdit: boolean;
  weddingId: string;
  budgetTotal: number | null;
  eur: EurRate;
  categories: BudgetCategory[];
  items: BudgetItem[];
  rates: BudgetRate[];
  payments: BudgetPayment[];
  contributors: Contributor[];
  vendors: VendorRow[];
  files: FileRow[];
  rooms: { price: number | null; currency: Currency; nights: number; paid_by: string; occupied: boolean }[];
  events: { id: string; name: string }[];
  ageCategories: { id: string; label: string }[];
  headcount: Headcount;
};

export function BudgetView(p: Props) {
  const [tab, setTab] = useState<Tab>(p.tab);
  const [selected, setSelected] = useState<string | "new" | null>(p.initialItem);
  const [newCategory, setNewCategory] = useState<string | null>(null);
  const eur = p.eur.rate;
  const summaries = useMemo(() => summarizeItems(p.items, p.rates, p.payments, p.headcount, eur), [p.items, p.rates, p.payments, p.headcount, eur]);
  const lodging = lodgingCost(p.rooms, eur);
  const t = totals(summaries, eur, p.budgetTotal, lodging);
  const vendorName = new Map(p.vendors.map((v) => [v.id, v.name]));
  const contributorName = new Map(p.contributors.map((c) => [c.id, c.name]));
  const selectedSummary = summaries.find((s) => s.item.id === selected) ?? null;

  const switchTab = (next: Tab) => {
    setTab(next);
    const url = new URL(window.location.href);
    if (next === "prehled") url.searchParams.delete("tab");
    else url.searchParams.set("tab", next);
    window.history.replaceState(null, "", url);
  };

  const panelOpen = tab === "prehled" && (selected === "new" || !!selectedSummary);

  return (
    <div className="flex min-h-svh flex-col xl:flex-row">
      <div className="flex min-w-0 flex-1 flex-col gap-6 px-6 py-8 sm:px-10 lg:py-10">
        <header className="flex flex-col gap-1">
          <h1 className="font-serif text-4xl tracking-tight">Rozpočet</h1>
          <p className="text-sm text-ink-soft">
            Vše v korunách. Eura převádíme kurzem ČNB {p.eur.date ? `z ${fmtDate(p.eur.date)}` : ""} ({eur.toLocaleString("cs-CZ", { maximumFractionDigits: 3 })} Kč){p.eur.fallback ? ", kurz se nepodařilo načíst, počítáme orientačně" : ""}.
          </p>
        </header>

        <Summary totals={t} budgetTotal={p.budgetTotal} canEdit={p.canEdit} />

        <nav aria-label="Části rozpočtu" className="flex flex-wrap gap-2 text-sm">
          {(
            [
              ["prehled", "Položky"],
              ["platby", "Platby"],
              ["dodavatele", "Dodavatelé"],
              ["prispevatele", "Kdo co platí"],
            ] as const
          ).map(([k, l]) => (
            <button key={k} type="button" onClick={() => switchTab(k)} aria-pressed={tab === k} className={`rounded-full px-3.5 py-1.5 ${tab === k ? "bg-surface font-medium shadow-card ring-1 ring-line" : "text-ink-soft hover:text-ink"}`}>
              {l}
              {k === "platby" ? <span className="ml-2 rounded-full bg-paper px-1.5 text-xs tabular-nums">{upcoming(p.payments).length}</span> : null}
            </button>
          ))}
        </nav>

        {tab === "prehled" ? (
          <Overview
            {...p}
            summaries={summaries}
            lodging={lodging}
            vendorName={vendorName}
            contributorName={contributorName}
            selected={selected}
            onSelect={(id, cat) => {
              setSelected(id);
              setNewCategory(cat ?? null);
            }}
          />
        ) : null}
        {tab === "platby" ? <PaymentsTab summaries={summaries} today={p.today} canEdit={p.canEdit} eur={eur} onOpen={(id) => { switchTab("prehled"); setSelected(id); }} /> : null}
        {tab === "dodavatele" ? <VendorsTab vendors={p.vendors} files={p.files} summaries={summaries} canEdit={p.canEdit} weddingId={p.weddingId} /> : null}
        {tab === "prispevatele" ? <ContributorsTab contributors={p.contributors} summaries={summaries} eur={eur} canEdit={p.canEdit} /> : null}
      </div>

      {panelOpen ? (
        <aside className="fixed inset-0 z-40 flex flex-col gap-5 overflow-y-auto bg-surface px-6 py-8 sm:px-7 xl:sticky xl:top-0 xl:h-svh xl:w-[420px] xl:shrink-0 xl:border-l xl:border-line">
          <button type="button" onClick={() => setSelected(null)} className="flex items-center gap-2 self-start text-sm text-ink-soft hover:text-ink">
            <Icon n="close" className="size-4" />
            Zavřít
          </button>
          <ItemDetail
            key={selected ?? "new"}
            summary={selectedSummary}
            defaultCategory={newCategory}
            {...p}
            eur={eur}
            onSaved={(id) => setSelected(id)}
            onDeleted={() => setSelected(null)}
          />
        </aside>
      ) : null}
    </div>
  );
}

function Summary({ totals: t, budgetTotal, canEdit }: { totals: ReturnType<typeof totals>; budgetTotal: number | null; canEdit: boolean }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(budgetTotal?.toString() ?? "");
  const [pending, start] = useTransition();
  const base = Math.max(budgetTotal ?? 0, t.cost, 1);
  return (
    <section className="flex flex-col gap-5 rounded-2xl bg-surface p-6 shadow-card ring-1 ring-line/70">
      <div className="grid grid-cols-2 gap-5 md:grid-cols-4">
        <div>
          <p className="text-sm text-ink-soft">Rozpočet</p>
          {editing ? (
            <form
              className="mt-1 flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                start(async () => {
                  const r = await saveBudgetTotal(value);
                  if (r.ok) setEditing(false);
                });
              }}
            >
              <input autoFocus inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} className={`${field} h-9 w-32`} aria-label="Celkový rozpočet" />
              <button type="submit" disabled={pending} className="h-9 rounded-full bg-ink px-3 text-sm font-medium text-white">Uložit</button>
            </form>
          ) : (
            <button type="button" disabled={!canEdit} onClick={() => setEditing(true)} className="font-display text-2xl font-semibold tabular-nums hover:underline disabled:no-underline sm:text-3xl">
              {budgetTotal !== null ? kc(budgetTotal) : canEdit ? "Nastavit" : "–"}
            </button>
          )}
        </div>
        <Stat label="Odhad celkem" value={kc(t.cost)} note={t.overBy > 0 ? `o ${kc(t.overBy)} přes rozpočet` : undefined} danger={t.overBy > 0} />
        <Stat label="Zaplaceno" value={kc(t.paid)} />
        <Stat label="Zbývá zaplatit" value={kc(t.remaining)} />
      </div>
      <div>
        <div className="relative h-3 overflow-hidden rounded-full bg-paper" role="img" aria-label={`Zaplaceno ${kc(t.paid)} z odhadu ${kc(t.cost)}`}>
          <div className="absolute inset-y-0 left-0 rounded-full bg-eucalyptus/30" style={{ width: `${(t.cost / base) * 100}%` }} />
          <div className="absolute inset-y-0 left-0 rounded-full bg-eucalyptus" style={{ width: `${(t.paid / base) * 100}%` }} />
          {budgetTotal && budgetTotal < t.cost ? <div className="absolute inset-y-0 w-0.5 bg-ink" style={{ left: `${(budgetTotal / base) * 100}%` }} /> : null}
        </div>
        <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-soft">
          <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-eucalyptus" />Zaplaceno</span>
          <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-eucalyptus/30" />Odhad</span>
          {budgetTotal && budgetTotal < t.cost ? <span className="flex items-center gap-1.5"><span className="h-2.5 w-0.5 bg-ink" />Rozpočet</span> : budgetTotal ? <span>Celý pruh je rozpočet</span> : null}
        </p>
      </div>
    </section>
  );
}

function Stat({ label: l, value, note, danger }: { label: string; value: string; note?: string; danger?: boolean }) {
  return (
    <div>
      <p className="text-sm text-ink-soft">{l}</p>
      <p className="font-display text-2xl font-semibold tabular-nums sm:text-3xl">{value}</p>
      {note ? <p className={`text-xs ${danger ? "font-medium text-danger" : "text-ink-soft"}`}>{note}</p> : null}
    </div>
  );
}

function Overview(
  p: Props & {
    summaries: ItemSummary[];
    lodging: number;
    vendorName: Map<string, string>;
    contributorName: Map<string, string>;
    selected: string | null;
    onSelect: (id: string | "new", category?: string | null) => void;
  },
) {
  const eur = p.eur.rate;
  const groups: { cat: BudgetCategory | null; rows: ItemSummary[] }[] = [
    ...p.categories.map((cat) => ({ cat, rows: p.summaries.filter((s) => s.item.category_id === cat.id) })),
    { cat: null, rows: p.summaries.filter((s) => !s.item.category_id || !p.categories.some((c) => c.id === s.item.category_id)) },
  ];
  const [addingCat, setAddingCat] = useState(false);
  const hideEmpty = p.summaries.length > 0;
  const [showEmpty, setShowEmpty] = useState(false);
  const emptyCount = groups.filter((g) => g.cat && g.rows.length === 0).length;

  return (
    <div className="flex flex-col gap-4">
      {p.summaries.length === 0 ? (
        <p className="rounded-2xl bg-eucalyptus-mist px-5 py-4 text-sm text-eucalyptus-deep">
          Začněte položkami, o kterých už víte: místo, catering, fotograf. Stačí odhad, skutečnou cenu doplníte, až budete mít smlouvu. Platby se zálohami se samy objeví v checklistu.
        </p>
      ) : null}
      {groups.map(({ cat, rows }) => {
        if (!cat && rows.length === 0) return null;
        if (cat && rows.length === 0 && hideEmpty && !showEmpty) return null;
        const sum = rows.reduce((s, r) => s + r.costCzk, 0);
        const paid = rows.reduce((s, r) => s + r.paidCzk, 0);
        return (
          <CategoryCard key={cat?.id ?? "none"} cat={cat} sum={sum} paid={paid} canEdit={p.canEdit} onAdd={() => p.onSelect("new", cat?.id ?? null)}>
            {rows.map((r) => (
              <ItemRow key={r.item.id} s={r} eur={eur} active={p.selected === r.item.id} vendor={r.item.vendor_id ? p.vendorName.get(r.item.vendor_id) : undefined} payer={r.item.contributor_id ? p.contributorName.get(r.item.contributor_id) : undefined} onOpen={() => p.onSelect(r.item.id)} />
            ))}
          </CategoryCard>
        );
      })}
      {p.lodging > 0 ? (
        <section className="flex items-center justify-between gap-4 rounded-2xl bg-surface px-5 py-4 shadow-card ring-1 ring-line/70">
          <div>
            <p className="font-medium">Ubytování hostů, které platíte</p>
            <p className="text-sm text-ink-soft">Počítá se samo z obsazených pokojů v modulu Ubytování (cena za noc × počet nocí).</p>
          </div>
          <span className="font-display text-xl font-semibold tabular-nums">{kc(p.lodging)}</span>
        </section>
      ) : null}
      <div className="flex flex-wrap gap-3">
        {p.canEdit ? (
          <button type="button" onClick={() => p.onSelect("new", null)} className="inline-flex h-10 items-center gap-2 rounded-full bg-ink px-4 text-sm font-medium text-white hover:bg-ink/85">
            <Icon n="plus" className="size-4" />
            Přidat položku
          </button>
        ) : null}
        {p.canEdit ? (
          <button type="button" onClick={() => setAddingCat(true)} className="inline-flex h-10 items-center rounded-full px-4 text-sm font-medium ring-1 ring-line hover:ring-eucalyptus">
            Přidat kategorii
          </button>
        ) : null}
        {hideEmpty && emptyCount ? (
          <button type="button" onClick={() => setShowEmpty(!showEmpty)} className="text-sm text-ink-soft underline-offset-2 hover:underline">
            {showEmpty ? "Skrýt prázdné kategorie" : `Ukázat prázdné kategorie (${emptyCount})`}
          </button>
        ) : null}
      </div>
      {addingCat ? <CategoryForm cat={null} onDone={() => setAddingCat(false)} /> : null}
    </div>
  );
}

function CategoryCard({ cat, sum, paid, canEdit, onAdd, children }: { cat: BudgetCategory | null; sum: number; paid: number; canEdit: boolean; onAdd: () => void; children: ReactNode }) {
  const [editing, setEditing] = useState(false);
  const planned = cat?.planned_amount ?? null;
  const over = planned !== null && sum > planned;
  if (editing && cat) return <CategoryForm cat={cat} onDone={() => setEditing(false)} />;
  return (
    <section className="overflow-hidden rounded-2xl bg-surface shadow-card ring-1 ring-line/70">
      <header className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-line px-5 py-3.5">
        <h2 className="font-serif text-xl">{cat?.name ?? "Bez kategorie"}</h2>
        {canEdit && cat ? (
          <button type="button" onClick={() => setEditing(true)} className="text-xs text-ink-soft hover:text-ink">Upravit</button>
        ) : null}
        <span className="ml-auto text-sm tabular-nums">
          <span className="font-medium">{kc(sum)}</span>
          {planned !== null ? <span className={over ? "text-danger" : "text-ink-soft"}> z plánovaných {kc(planned)}</span> : null}
          {paid > 0 ? <span className="text-ink-soft">, zaplaceno {kc(paid)}</span> : null}
        </span>
      </header>
      <ul className="divide-y divide-line">{children}</ul>
      {canEdit ? (
        <button type="button" onClick={onAdd} className="flex w-full items-center gap-2 px-5 py-3 text-sm text-eucalyptus-deep hover:bg-paper">
          <Icon n="plus" className="size-4" />
          Přidat položku
        </button>
      ) : null}
    </section>
  );
}

function CategoryForm({ cat, onDone }: { cat: BudgetCategory | null; onDone: () => void }) {
  const [name, setName] = useState(cat?.name ?? "");
  const [planned, setPlanned] = useState(cat?.planned_amount?.toString() ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <form
      className="flex flex-col gap-3 rounded-2xl bg-surface p-5 shadow-card ring-2 ring-eucalyptus"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await saveCategory(cat?.id ?? null, { name, planned_amount: planned });
          if (r.error) setError(r.error);
          else onDone();
        });
      }}
    >
      <div className="grid gap-3 sm:grid-cols-[1fr_12rem]">
        <label className={label}>
          Kategorie
          <input autoFocus value={name} onChange={(e) => setName(e.target.value)} maxLength={80} className={field} />
        </label>
        <label className={label}>
          Plánujeme utratit (Kč)
          <input inputMode="decimal" value={planned} onChange={(e) => setPlanned(e.target.value)} className={field} />
        </label>
      </div>
      {error ? <FormMessage>{error}</FormMessage> : null}
      <div className="flex gap-3">
        <button type="submit" disabled={pending} className="h-9 rounded-full bg-eucalyptus px-4 text-sm font-medium text-white disabled:opacity-50">{pending ? "Ukládám…" : "Uložit"}</button>
        <button type="button" onClick={onDone} className="px-2 text-sm text-ink-soft hover:text-ink">Zrušit</button>
        {cat ? (
          <button type="button" onClick={() => start(async () => { const r = await deleteCategory(cat.id); if (r.error) setError(r.error); else onDone(); })} className="ml-auto text-sm text-ink-soft hover:text-danger">
            Smazat kategorii
          </button>
        ) : null}
      </div>
    </form>
  );
}

function ItemRow({ s, eur, active, vendor, payer, onOpen }: { s: ItemSummary; eur: number; active: boolean; vendor?: string; payer?: string; onOpen: () => void }) {
  const fullyPaid = s.costCzk > 0 && s.paidCzk >= s.costCzk - 0.5;
  const next = s.payments.find((x) => !x.paid_at && x.due_date);
  return (
    <li>
      <button type="button" onClick={onOpen} className={`flex w-full items-center gap-4 px-5 py-3.5 text-left transition-colors hover:bg-paper ${active ? "bg-eucalyptus-mist/60" : ""}`}>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">{s.item.name}</span>
          <span className="block truncate text-xs text-ink-soft">
            {[vendor, s.item.per_person ? "cena za osobu" : null, next ? `další platba ${fmtDate(next.due_date!)}` : null].filter(Boolean).join(", ")}
          </span>
        </span>
        {payer ? <Avatar name={payer} size="sm" /> : null}
        <span className="shrink-0 text-right sm:w-36">
          <span className="block font-medium tabular-nums">{s.item.currency === "EUR" ? formatMoney(s.cost, "EUR") : kc(s.cost)}</span>
          <span className={`block text-xs ${fullyPaid ? "text-eucalyptus-deep" : "text-ink-soft"}`}>
            {fullyPaid ? "zaplaceno" : s.paidCzk > 0 ? `zaplaceno ${kc(s.paidCzk)}` : s.item.actual_amount === null ? "odhad" : s.item.currency === "EUR" ? `≈ ${kc(toCzk(s.cost, "EUR", eur))}` : "cena dohodnutá"}
          </span>
        </span>
      </button>
    </li>
  );
}

function ItemDetail(
  p: Omit<Props, "eur"> & {
    summary: ItemSummary | null;
    defaultCategory: string | null;
    eur: number;
    onSaved: (id: string) => void;
    onDeleted: () => void;
  },
) {
  const it = p.summary?.item;
  const [name, setName] = useState(it?.name ?? "");
  const [category, setCategory] = useState(it?.category_id ?? p.defaultCategory ?? "");
  const [vendor, setVendor] = useState(it?.vendor_id ?? "");
  const [payer, setPayer] = useState(it?.contributor_id ?? "");
  const [currency, setCurrency] = useState<Currency>(it?.currency ?? "CZK");
  const [estimate, setEstimate] = useState(it?.estimate_amount?.toString() ?? "");
  const [actual, setActual] = useState(it?.actual_amount?.toString() ?? "");
  const [perPerson, setPerPerson] = useState(it?.per_person ?? false);
  const [event, setEvent] = useState(it?.per_person_event_id ?? p.events[0]?.id ?? "");
  const [rates, setRates] = useState<Record<string, string>>(() => Object.fromEntries(p.rates.filter((r) => r.item_id === it?.id).map((r) => [r.age_category_id, String(r.price)])));
  const [notes, setNotes] = useState(it?.notes ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();
  const counts = p.headcount[event] ?? {};
  const perPersonTotal = p.ageCategories.reduce((s, c) => s + (Number(rates[c.id]?.replace(",", ".")) || 0) * (counts[c.id] ?? 0), 0);

  const submit = () =>
    start(async () => {
      setError(null);
      const r: Result = await saveItem(it?.id ?? null, {
        name,
        category_id: category,
        vendor_id: vendor,
        contributor_id: payer,
        currency,
        estimate_amount: perPerson ? null : estimate,
        actual_amount: actual,
        per_person: perPerson,
        per_person_event_id: perPerson ? event : null,
        notes,
        rates: p.ageCategories.map((c) => ({ age_category_id: c.id, price: rates[c.id] ?? "" })),
      });
      if (r.error) setError(r.error);
      else {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
        if (!it && r.id) p.onSaved(r.id);
      }
    });

  return (
    <div className="flex flex-col gap-5">
      <h2 className="font-serif text-[26px] leading-tight">{it ? it.name : "Nová položka"}</h2>
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <fieldset disabled={!p.canEdit} className="flex flex-col gap-4">
          <label className={label}>
            Co to je
            <input autoFocus={!it} value={name} onChange={(e) => setName(e.target.value)} maxLength={120} placeholder="Například Fotograf" className={field} />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className={label}>
              Kategorie
              <select value={category} onChange={(e) => setCategory(e.target.value)} className={field}>
                <option value="">Bez kategorie</option>
                {p.categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </label>
            <label className={label}>
              Kdo platí
              <select value={payer} onChange={(e) => setPayer(e.target.value)} className={field}>
                <option value="">My</option>
                {p.contributors.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </label>
            <label className={`${label} col-span-2`}>
              Dodavatel
              <select value={vendor} onChange={(e) => setVendor(e.target.value)} className={field}>
                <option value="">Žádný</option>
                {p.vendors.map((v) => (
                  <option key={v.id} value={v.id}>{v.name}</option>
                ))}
              </select>
            </label>
          </div>

          <div className="flex gap-1 rounded-full bg-paper p-1 text-sm">
            {[false, true].map((pp) => (
              <button key={String(pp)} type="button" onClick={() => setPerPerson(pp)} aria-pressed={perPerson === pp} className={`flex-1 rounded-full px-3 py-1.5 ${perPerson === pp ? "bg-surface font-medium shadow-card" : "text-ink-soft"}`}>
                {pp ? "Cena za osobu" : "Pevná částka"}
              </button>
            ))}
          </div>

          {perPerson ? (
            <div className="flex flex-col gap-3 rounded-xl bg-paper p-4">
              <label className={label}>
                Počítat hosty z události
                <select value={event} onChange={(e) => setEvent(e.target.value)} className={field}>
                  {p.events.map((e) => (
                    <option key={e.id} value={e.id}>{e.name}</option>
                  ))}
                </select>
              </label>
              {p.ageCategories.map((c) => (
                <label key={c.id} className="grid grid-cols-[1fr_7rem] items-center gap-3 text-sm">
                  <span>
                    {c.label} <span className="text-ink-soft">({counts[c.id] ?? 0} potvrzeno)</span>
                  </span>
                  <input inputMode="decimal" value={rates[c.id] ?? ""} onChange={(e) => setRates({ ...rates, [c.id]: e.target.value })} placeholder="cena" aria-label={`Cena za osobu: ${c.label}`} className={`${field} h-9 text-right`} />
                </label>
              ))}
              <p className="text-sm">
                Teď vychází na <strong className="tabular-nums">{formatMoney(perPersonTotal, currency)}</strong>. Částka se mění s potvrzenými hosty.
              </p>
            </div>
          ) : null}

          <div className="grid grid-cols-[1fr_1fr_6rem] gap-3">
            {!perPerson ? (
              <label className={label}>
                Odhad
                <input inputMode="decimal" value={estimate} onChange={(e) => setEstimate(e.target.value)} className={field} />
              </label>
            ) : (
              <span />
            )}
            <label className={label}>
              Dohodnutá cena
              <input inputMode="decimal" value={actual} onChange={(e) => setActual(e.target.value)} placeholder="ze smlouvy" className={field} />
            </label>
            <label className={label}>
              Měna
              <select value={currency} onChange={(e) => setCurrency(e.target.value as Currency)} className={field}>
                <option value="CZK">Kč</option>
                <option value="EUR">EUR</option>
              </select>
            </label>
          </div>
          <label className={label}>
            Poznámka
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} maxLength={2000} className={`${field} h-auto py-2`} />
          </label>
        </fieldset>
        {error ? <FormMessage>{error}</FormMessage> : null}
        {p.canEdit ? (
          <div className="flex items-center gap-3">
            <button type="submit" disabled={pending} className="h-10 rounded-full bg-ink px-5 text-sm font-medium text-white hover:bg-ink/85 disabled:opacity-50">
              {pending ? "Ukládám…" : it ? "Uložit" : "Přidat položku"}
            </button>
            {saved ? <span role="status" className="text-sm text-eucalyptus-deep">Uloženo</span> : null}
            {it ? (
              <button type="button" onClick={() => start(async () => { const r = await deleteItem(it.id); if (r.error) setError(r.error); else p.onDeleted(); })} className="ml-auto text-sm text-ink-soft hover:text-danger">
                Smazat položku
              </button>
            ) : null}
          </div>
        ) : null}
      </form>

      {it ? <Payments item={it} payments={p.summary!.payments} contributors={p.contributors} canEdit={p.canEdit} eur={p.eur} today={p.today} /> : <p className="text-sm text-ink-soft">Zálohy a splátky přidáte po uložení položky.</p>}
    </div>
  );
}

function Payments({ item, payments, contributors, canEdit, eur, today }: { item: BudgetItem; payments: BudgetPayment[]; contributors: Contributor[]; canEdit: boolean; eur: number; today: string }) {
  const [adding, setAdding] = useState(false);
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-col gap-2 border-t border-line pt-5">
      <div className="flex items-baseline justify-between">
        <Eyebrow>Platby</Eyebrow>
        <span className="text-xs text-ink-soft">s termínem se objeví v checklistu</span>
      </div>
      {payments.map((x) => (
        <div key={x.id} className="group flex items-center gap-3 rounded-xl px-1 py-2">
          <CheckCircle size="sm" label={`Zaplaceno: ${x.label ?? "platba"}`} checked={!!x.paid_at} onChange={(v) => canEdit && start(async () => void (await setPaid(x.id, v)))} />
          <span className="min-w-0 flex-1">
            <span className={`block text-sm ${x.paid_at ? "text-ink-soft" : "font-medium"}`}>{x.label || "Platba"}</span>
            <span className={`block text-xs ${!x.paid_at && x.due_date && x.due_date < today ? "font-medium text-danger" : "text-ink-soft"}`}>
              {x.paid_at ? `zaplaceno ${fmtDate(x.paid_at)}` : x.due_date ? `do ${fmtDate(x.due_date)}` : "bez termínu"}
              {x.contributor_id ? `, platí ${contributors.find((c) => c.id === x.contributor_id)?.name ?? ""}` : ""}
            </span>
          </span>
          <span className="text-sm tabular-nums">
            {formatMoney(x.amount, x.currency)}
            {x.currency === "EUR" ? <span className="block text-right text-xs text-ink-soft">≈ {kc(x.paid_amount_default_currency ?? x.amount * eur)}</span> : null}
          </span>
          {canEdit ? (
            <button type="button" disabled={pending} onClick={() => start(async () => void (await deletePayment(x.id)))} aria-label="Smazat platbu" className="text-ink-soft opacity-0 hover:text-danger group-hover:opacity-100 focus:opacity-100">
              <Icon n="close" className="size-4" />
            </button>
          ) : null}
        </div>
      ))}
      {payments.length === 0 && !adding ? <p className="text-sm text-ink-soft">Zatím žádná záloha ani splátka.</p> : null}
      {adding ? <PaymentForm item={item} contributors={contributors} onDone={() => setAdding(false)} /> : null}
      {canEdit && !adding ? (
        <button type="button" onClick={() => setAdding(true)} className="flex items-center gap-2 self-start py-1 text-sm text-eucalyptus-deep hover:underline">
          <Icon n="plus" className="size-4" />
          Přidat zálohu nebo splátku
        </button>
      ) : null}
    </div>
  );
}

function PaymentForm({ item, contributors, onDone }: { item: BudgetItem; contributors: Contributor[]; onDone: () => void }) {
  const [labelV, setLabel] = useState("Záloha");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState<Currency>(item.currency);
  const [due, setDue] = useState("");
  const [paid, setPaidV] = useState(false);
  const [payer, setPayer] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <form
      className="flex flex-col gap-3 rounded-xl bg-paper p-4"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await savePayment(null, { item_id: item.id, label: labelV, amount, currency, due_date: due, paid_at: paid ? new Date().toISOString().slice(0, 10) : null, contributor_id: payer });
          if (r.error) setError(r.error);
          else onDone();
        });
      }}
    >
      <div className="grid grid-cols-[1fr_7rem_5rem] gap-2">
        <input value={labelV} onChange={(e) => setLabel(e.target.value)} maxLength={80} aria-label="Popis platby" className={`${field} h-9`} />
        <input autoFocus inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="částka" aria-label="Částka" className={`${field} h-9 text-right`} />
        <select value={currency} onChange={(e) => setCurrency(e.target.value as Currency)} aria-label="Měna" className={`${field} h-9`}>
          <option value="CZK">Kč</option>
          <option value="EUR">EUR</option>
        </select>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1 text-xs font-medium">
          Zaplatit do
          <input type="date" value={due} onChange={(e) => setDue(e.target.value)} className={`${field} h-9`} />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium">
          Platí
          <select value={payer} onChange={(e) => setPayer(e.target.value)} className={`${field} h-9`}>
            <option value="">Podle položky</option>
            {contributors.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </label>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={paid} onChange={(e) => setPaidV(e.target.checked)} className="accent-eucalyptus" />
        Už je zaplacená
      </label>
      {error ? <FormMessage>{error}</FormMessage> : null}
      <div className="flex gap-3">
        <button type="submit" disabled={pending} className="h-9 rounded-full bg-eucalyptus px-4 text-sm font-medium text-white disabled:opacity-50">{pending ? "Ukládám…" : "Přidat platbu"}</button>
        <button type="button" onClick={onDone} className="px-2 text-sm text-ink-soft hover:text-ink">Zrušit</button>
      </div>
    </form>
  );
}

function PaymentsTab({ summaries, today, canEdit, eur, onOpen }: { summaries: ItemSummary[]; today: string; canEdit: boolean; eur: number; onOpen: (itemId: string) => void }) {
  const [, start] = useTransition();
  const all = summaries.flatMap((s) => s.payments.map((pay) => ({ pay, item: s.item })));
  const late = all.filter((x) => !x.pay.paid_at && x.pay.due_date && x.pay.due_date < today).sort((a, b) => a.pay.due_date!.localeCompare(b.pay.due_date!));
  const soon = all.filter((x) => !x.pay.paid_at && x.pay.due_date && x.pay.due_date >= today).sort((a, b) => a.pay.due_date!.localeCompare(b.pay.due_date!));
  const undated = all.filter((x) => !x.pay.paid_at && !x.pay.due_date);
  const paid = all.filter((x) => x.pay.paid_at).sort((a, b) => b.pay.paid_at!.localeCompare(a.pay.paid_at!));
  const sumOf = (list: typeof all) => list.reduce((s, x) => s + (x.pay.paid_amount_default_currency ?? toCzk(x.pay.amount, x.pay.currency, eur)), 0);
  const group = (key: string, title: string, list: typeof all, tone?: "danger") =>
    list.length ? (
      <section key={key} className="flex flex-col gap-2">
        <p className={`flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.16em] ${tone ? "text-danger" : "text-ink-soft/80"}`}>
          {title}
          <span className="h-px flex-1 bg-line" />
          <span className="normal-case tracking-normal">{kc(sumOf(list))}</span>
        </p>
        <ul className="flex flex-col gap-2">
          {list.map(({ pay, item }) => (
            <li key={pay.id} className="flex items-center gap-4 rounded-2xl bg-surface px-4 py-3 shadow-card ring-1 ring-line/70">
              <CheckCircle label={`Zaplaceno: ${pay.label ?? item.name}`} checked={!!pay.paid_at} onChange={(v) => canEdit && start(async () => void (await setPaid(pay.id, v)))} />
              <button type="button" onClick={() => onOpen(item.id)} className="min-w-0 flex-1 text-left">
                <span className="block truncate font-medium">{item.name}</span>
                <span className="block text-xs text-ink-soft">{pay.label || "Platba"}</span>
              </button>
              <span className={`hidden w-28 text-right text-sm sm:block ${tone ? "font-medium text-danger" : "text-ink-soft"}`}>{pay.paid_at ? fmtDate(pay.paid_at) : pay.due_date ? fmtDate(pay.due_date) : ""}</span>
              <span className="w-28 text-right font-medium tabular-nums">{formatMoney(pay.amount, pay.currency)}</span>
            </li>
          ))}
        </ul>
      </section>
    ) : null;
  if (all.length === 0) return <p className="text-ink-soft">Zatím žádné platby. Zálohy a doplatky přidáte u položky rozpočtu.</p>;
  return (
    <div className="flex flex-col gap-6">
      {group("late", "Po termínu", late, "danger")}
      {group("soon", "Nadcházející", soon)}
      {group("undated", "Bez termínu", undated)}
      {group("paid", "Zaplacené", paid)}
    </div>
  );
}

function VendorsTab({ vendors, files, summaries, canEdit, weddingId }: { vendors: VendorRow[]; files: FileRow[]; summaries: ItemSummary[]; canEdit: boolean; weddingId: string }) {
  const [editing, setEditing] = useState<string | "new" | null>(null);
  return (
    <div className="flex flex-col gap-4">
      {canEdit ? (
        <button type="button" onClick={() => setEditing("new")} className="inline-flex h-10 items-center gap-2 self-start rounded-full bg-ink px-4 text-sm font-medium text-white hover:bg-ink/85">
          <Icon n="plus" className="size-4" />
          Přidat dodavatele
        </button>
      ) : null}
      {editing === "new" ? <VendorForm vendor={null} onDone={() => setEditing(null)} /> : null}
      {vendors.length === 0 && editing !== "new" ? <p className="text-ink-soft">Fotograf, kapela, catering, květinářka… Tady budete mít jejich kontakty, smlouvy a co jim kdy platit.</p> : null}
      <div className="grid gap-4 lg:grid-cols-2">
        {vendors.map((v) =>
          editing === v.id ? (
            <VendorForm key={v.id} vendor={v} onDone={() => setEditing(null)} />
          ) : (
            <VendorCard key={v.id} v={v} files={files.filter((f) => f.vendor_id === v.id)} rows={summaries.filter((s) => s.item.vendor_id === v.id)} canEdit={canEdit} weddingId={weddingId} onEdit={() => setEditing(v.id)} />
          ),
        )}
      </div>
    </div>
  );
}

function VendorCard({ v, files, rows, canEdit, weddingId, onEdit }: { v: VendorRow; files: FileRow[]; rows: ItemSummary[]; canEdit: boolean; weddingId: string; onEdit: () => void }) {
  const total = rows.reduce((s, r) => s + r.costCzk, 0);
  const paid = rows.reduce((s, r) => s + r.paidCzk, 0);
  const next = upcoming(rows.flatMap((r) => r.payments)).find((x) => x.due_date);
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, start] = useTransition();

  async function upload(file: File) {
    setError(null);
    if (file.size > 20 * 1024 * 1024) return setError("Soubor může mít nejvýš 20 MB.");
    setBusy(true);
    const safe = file.name.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\w.-]+/g, "-").slice(-80);
    const key = `${weddingId}/${v.id}/${crypto.randomUUID()}-${safe}`;
    const { error: err } = await createClient().storage.from("vendor-files").upload(key, file, { contentType: file.type || "application/octet-stream" });
    if (err) {
      setBusy(false);
      return setError("Soubor se nepodařilo nahrát.");
    }
    const r = await addVendorFile(v.id, file.name, key, file.size);
    setBusy(false);
    if (r.error) setError(r.error);
  }

  async function open(f: FileRow) {
    const { data } = await createClient().storage.from("vendor-files").createSignedUrl(f.storage_key, 300);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank", "noopener");
  }

  return (
    <article className="flex flex-col gap-4 rounded-2xl bg-surface p-5 shadow-card ring-1 ring-line/70">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-serif text-xl">{v.name}</h3>
          {v.category ? <p className="text-sm text-ink-soft">{v.category}</p> : null}
        </div>
        {canEdit ? <button type="button" onClick={onEdit} className="text-sm text-ink-soft hover:text-ink">Upravit</button> : null}
      </div>
      <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-ink-soft">
        {v.contact_name ? <span className="flex items-center gap-1.5"><Icon n="user" className="size-4" />{v.contact_name}</span> : null}
        {v.phone ? <a href={`tel:${v.phone.replace(/\s+/g, "")}`} className="flex items-center gap-1.5 hover:text-ink"><Icon n="phone" className="size-4" />{v.phone}</a> : null}
        {v.email ? <a href={`mailto:${v.email}`} className="flex items-center gap-1.5 hover:text-ink"><Icon n="mail" className="size-4" />{v.email}</a> : null}
        {v.website ? <a href={v.website} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 hover:text-ink"><Icon n="globe" className="size-4" />{v.website.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "")}</a> : null}
      </div>
      {rows.length ? (
        <div className="grid grid-cols-3 gap-3 rounded-xl bg-paper px-4 py-3 text-sm">
          <div><p className="text-xs text-ink-soft">Celkem</p><p className="font-medium tabular-nums">{kc(total)}</p></div>
          <div><p className="text-xs text-ink-soft">Zaplaceno</p><p className="font-medium tabular-nums">{kc(paid)}</p></div>
          <div><p className="text-xs text-ink-soft">Další platba</p><p className="font-medium tabular-nums">{next ? fmtDate(next.due_date!) : "–"}</p></div>
        </div>
      ) : null}
      {v.notes ? <p className="whitespace-pre-line text-sm">{v.notes}</p> : null}
      <div className="flex flex-col gap-1.5">
        <Eyebrow>Smlouvy a faktury</Eyebrow>
        {files.map((f) => (
          <div key={f.id} className="group flex items-center gap-2 text-sm">
            <button type="button" onClick={() => open(f)} className="min-w-0 flex-1 truncate text-left underline-offset-2 hover:underline">{f.name}</button>
            <span className="text-xs text-ink-soft">{(f.bytes / 1024 / 1024).toFixed(1)} MB</span>
            {canEdit ? (
              <button type="button" onClick={() => start(async () => void (await deleteVendorFile(f.id)))} aria-label={`Smazat ${f.name}`} className="text-ink-soft opacity-0 hover:text-danger group-hover:opacity-100 focus:opacity-100">
                <Icon n="close" className="size-4" />
              </button>
            ) : null}
          </div>
        ))}
        {files.length === 0 ? <p className="text-sm text-ink-soft">Žádné soubory.</p> : null}
        {canEdit ? (
          <>
            <button type="button" disabled={busy} onClick={() => input.current?.click()} className="flex items-center gap-2 self-start py-1 text-sm text-eucalyptus-deep hover:underline disabled:opacity-50">
              <Icon n="plus" className="size-4" />
              {busy ? "Nahrávám…" : "Nahrát soubor"}
            </button>
            <input ref={input} type="file" className="sr-only" tabIndex={-1} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void upload(f); }} />
          </>
        ) : null}
        {error ? <p className="text-sm text-danger">{error}</p> : null}
      </div>
    </article>
  );
}

function VendorForm({ vendor, onDone }: { vendor: VendorRow | null; onDone: () => void }) {
  const [v, setV] = useState({ name: vendor?.name ?? "", category: vendor?.category ?? "", contact_name: vendor?.contact_name ?? "", phone: vendor?.phone ?? "", email: vendor?.email ?? "", website: vendor?.website ?? "", notes: vendor?.notes ?? "" });
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setV({ ...v, [k]: e.target.value });
  return (
    <form
      className="flex flex-col gap-3 rounded-2xl bg-surface p-5 shadow-card ring-2 ring-eucalyptus"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await saveVendor(vendor?.id ?? null, v);
          if (r.error) setError(r.error);
          else onDone();
        });
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <label className={label}>Název<input autoFocus value={v.name} onChange={set("name")} maxLength={100} placeholder="Foto Novák" className={field} /></label>
        <label className={label}>Obor<input value={v.category} onChange={set("category")} maxLength={60} placeholder="fotograf" className={field} /></label>
        <label className={label}>Kontaktní osoba<input value={v.contact_name} onChange={set("contact_name")} maxLength={80} className={field} /></label>
        <label className={label}>Telefon<input type="tel" value={v.phone} onChange={set("phone")} maxLength={40} className={field} /></label>
        <label className={label}>E-mail<input type="email" value={v.email} onChange={set("email")} maxLength={120} className={field} /></label>
        <label className={label}>Web<input value={v.website} onChange={set("website")} maxLength={200} className={field} /></label>
      </div>
      <label className={label}>Poznámka<textarea value={v.notes} onChange={set("notes")} rows={2} maxLength={2000} className={`${field} h-auto py-2`} /></label>
      {error ? <FormMessage>{error}</FormMessage> : null}
      <div className="flex gap-3">
        <button type="submit" disabled={pending} className="h-9 rounded-full bg-eucalyptus px-4 text-sm font-medium text-white disabled:opacity-50">{pending ? "Ukládám…" : "Uložit"}</button>
        <button type="button" onClick={onDone} className="px-2 text-sm text-ink-soft hover:text-ink">Zrušit</button>
        {vendor ? (
          <button type="button" onClick={() => start(async () => { const r = await deleteVendor(vendor.id); if (r.error) setError(r.error); else onDone(); })} className="ml-auto text-sm text-ink-soft hover:text-danger">
            Smazat dodavatele
          </button>
        ) : null}
      </div>
    </form>
  );
}

function ContributorsTab({ contributors, summaries, eur, canEdit }: { contributors: Contributor[]; summaries: ItemSummary[]; eur: number; canEdit: boolean }) {
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const rows = byContributor(contributors, summaries, eur);
  const ours = summaries.filter((s) => !s.item.contributor_id).reduce((t, s) => t + s.costCzk, 0);
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-ink-soft">Kdo se na svatbě finančně podílí. U položky nebo platby pak vyberete, kdo ji platí.</p>
      <div className="grid gap-4 md:grid-cols-2">
        <article className="flex items-center gap-4 rounded-2xl bg-surface p-5 shadow-card ring-1 ring-line/70">
          <Avatar name="My" />
          <div className="flex-1">
            <p className="font-medium">My</p>
            <p className="text-sm text-ink-soft">Položky bez jiného plátce</p>
          </div>
          <p className="font-display text-xl font-semibold tabular-nums">{kc(ours)}</p>
        </article>
        {rows.map((r) =>
          editing === r.contributor.id ? (
            <ContributorForm key={r.contributor.id} c={r.contributor} onDone={() => setEditing(null)} />
          ) : (
            <article key={r.contributor.id} className="flex flex-col gap-3 rounded-2xl bg-surface p-5 shadow-card ring-1 ring-line/70">
              <div className="flex items-center gap-4">
                <Avatar name={r.contributor.name} />
                <p className="flex-1 font-medium">{r.contributor.name}</p>
                {canEdit ? <button type="button" onClick={() => setEditing(r.contributor.id)} className="text-sm text-ink-soft hover:text-ink">Upravit</button> : null}
              </div>
              <div className="grid grid-cols-3 gap-3 text-sm">
                <div><p className="text-xs text-ink-soft">Přislíbili</p><p className="font-medium tabular-nums">{r.contributor.pledged_amount !== null ? kc(r.contributor.pledged_amount) : "–"}</p></div>
                <div><p className="text-xs text-ink-soft">Platí položky</p><p className="font-medium tabular-nums">{kc(r.assigned)}</p></div>
                <div><p className="text-xs text-ink-soft">Zaplatili</p><p className="font-medium tabular-nums">{kc(r.paid)}</p></div>
              </div>
            </article>
          ),
        )}
      </div>
      {editing === "new" ? <ContributorForm c={null} onDone={() => setEditing(null)} /> : null}
      {canEdit && editing !== "new" ? (
        <button type="button" onClick={() => setEditing("new")} className="inline-flex h-10 items-center gap-2 self-start rounded-full px-4 text-sm font-medium ring-1 ring-line hover:ring-eucalyptus">
          <Icon n="plus" className="size-4" />
          Přidat přispěvatele
        </button>
      ) : null}
    </div>
  );
}

function ContributorForm({ c, onDone }: { c: Contributor | null; onDone: () => void }) {
  const [name, setName] = useState(c?.name ?? "");
  const [pledged, setPledged] = useState(c?.pledged_amount?.toString() ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <form
      className="flex flex-col gap-3 rounded-2xl bg-surface p-5 shadow-card ring-2 ring-eucalyptus"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await saveContributor(c?.id ?? null, { name, pledged_amount: pledged });
          if (r.error) setError(r.error);
          else onDone();
        });
      }}
    >
      <div className="grid gap-3 sm:grid-cols-[1fr_12rem]">
        <label className={label}>Kdo<input autoFocus value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder="Například Janini rodiče" className={field} /></label>
        <label className={label}>Přislíbili (Kč)<input inputMode="decimal" value={pledged} onChange={(e) => setPledged(e.target.value)} className={field} /></label>
      </div>
      {error ? <FormMessage>{error}</FormMessage> : null}
      <div className="flex gap-3">
        <button type="submit" disabled={pending} className="h-9 rounded-full bg-eucalyptus px-4 text-sm font-medium text-white disabled:opacity-50">{pending ? "Ukládám…" : "Uložit"}</button>
        <button type="button" onClick={onDone} className="px-2 text-sm text-ink-soft hover:text-ink">Zrušit</button>
        {c ? (
          <button type="button" onClick={() => start(async () => { const r = await deleteContributor(c.id); if (r.error) setError(r.error); else onDone(); })} className="ml-auto text-sm text-ink-soft hover:text-danger">
            Smazat
          </button>
        ) : null}
      </div>
    </form>
  );
}
