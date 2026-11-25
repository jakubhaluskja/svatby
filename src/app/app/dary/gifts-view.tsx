"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { Icon } from "@/components/icons";
import { PhotoUpload } from "@/components/photo-upload";
import { FormMessage } from "@/components/ui";
import { photoUrl } from "@/lib/media";
import {
  addReceived,
  cancelReservation,
  confirmContribution,
  deleteContribution,
  deleteGift,
  deleteReceived,
  reorderGifts,
  reservationReceived,
  saveGift,
  setReveal,
  type Result,
} from "./actions";

type L = { cs?: string; en?: string };
export type Gift = {
  id: string;
  kind: "item" | "fund" | "group";
  title: L;
  description: L;
  url: string | null;
  price: number | null;
  image_key: string | null;
  target_amount: number | null;
  show_contributors: boolean;
  show_amounts: boolean;
  sort: number;
};
export type Reservation = { id: string; gift_id: string; household_id: string; created_at: string };
export type Contribution = { id: string; gift_id: string; household_id: string | null; display_name: string | null; amount: number; confirmed_at: string | null; created_at: string };
export type Received = { id: string; household_id: string; description: string; amount: number | null; source: "manual" | "reservation" | "contribution"; source_id: string | null; created_at: string };
type Household = { id: string; name: string; email: string | null; thanked: boolean };

type Props = {
  tab: "seznam" | "obdrzene" | "nastaveni";
  weddingId: string;
  canEdit: boolean;
  sectionOn: boolean;
  reveal: boolean;
  hasAccount: boolean;
  gifts: Gift[];
  reservations: Reservation[];
  contributions: Contribution[];
  received: Received[];
  households: Household[];
};

const KIND: Record<Gift["kind"], { label: string; hint: string }> = {
  item: { label: "Věc", hint: "Konkrétní dar, který si jedna domácnost zarezervuje." },
  fund: { label: "Příspěvek", hint: "Na cokoli – svatební cestu, bydlení. Bez cílové částky." },
  group: { label: "Skupinový dar", hint: "Dražší dar, na který se složí víc hostů. S cílovou částkou." },
};

const czk = (n: number) => new Intl.NumberFormat("cs-CZ", { style: "currency", currency: "CZK", maximumFractionDigits: 0 }).format(n);
const field = "h-10 w-full rounded-lg border border-line bg-surface px-3 text-[15px] focus:border-eucalyptus focus:outline-none";
const title = (g: Gift) => g.title.cs || g.title.en || "Bez názvu";

function useAction() {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const run = (fn: () => Promise<Result>, after?: () => void) =>
    start(async () => {
      const r = await fn();
      setError(r.error ?? null);
      if (r.ok) after?.();
    });
  return { pending, error, run };
}

// -----------------------------------------------------------------------------
// Editor daru
// -----------------------------------------------------------------------------
function GiftEditor({ gift, weddingId, onClose }: { gift: Gift | null; weddingId: string; onClose: () => void }) {
  const [kind, setKind] = useState<Gift["kind"]>(gift?.kind ?? "item");
  const [t, setT] = useState<L>(gift?.title ?? {});
  const [d, setD] = useState<L>(gift?.description ?? {});
  const [url, setUrl] = useState(gift?.url ?? "");
  const [price, setPrice] = useState(gift?.price ? String(gift.price) : "");
  const [target, setTarget] = useState(gift?.target_amount ? String(gift.target_amount) : "");
  const [image, setImage] = useState<string | null>(gift?.image_key ?? null);
  const [showContributors, setShowContributors] = useState(gift?.show_contributors ?? false);
  const [showAmounts, setShowAmounts] = useState(gift?.show_amounts ?? true);
  const [en, setEn] = useState(!!(gift?.title.en || gift?.description.en));
  const { pending, error, run } = useAction();

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label={gift ? "Upravit dar" : "Nový dar"}>
      <button type="button" aria-label="Zavřít" onClick={onClose} className="absolute inset-0 bg-ink/30" />
      <form
        className="relative flex h-full w-full max-w-lg flex-col overflow-y-auto bg-surface shadow-pop"
        onSubmit={(e) => {
          e.preventDefault();
          run(
            () =>
              saveGift(gift?.id ?? null, {
                kind,
                title: { cs: t.cs ?? "", en: t.en ?? "" },
                description: { cs: d.cs ?? "", en: d.en ?? "" },
                url,
                price,
                target_amount: target,
                image_key: image,
                show_contributors: showContributors,
                show_amounts: showAmounts,
              }),
            onClose,
          );
        }}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-surface px-6 py-4">
          <h2 className="font-serif text-2xl">{gift ? "Upravit dar" : "Nový dar"}</h2>
          <button type="button" onClick={onClose} aria-label="Zavřít" className="grid size-9 place-items-center rounded-full hover:bg-paper">
            <Icon n="close" />
          </button>
        </div>

        <div className="flex flex-col gap-5 px-6 py-5">
          <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Druh daru">
            {(Object.keys(KIND) as Gift["kind"][]).map((k) => (
              <button
                key={k}
                type="button"
                role="radio"
                aria-checked={kind === k}
                onClick={() => setKind(k)}
                className={`rounded-xl px-3 py-2.5 text-sm font-medium ring-1 ${kind === k ? "bg-eucalyptus-mist text-eucalyptus-deep ring-eucalyptus" : "ring-line hover:ring-eucalyptus/60"}`}
              >
                {KIND[k].label}
              </button>
            ))}
          </div>
          <p className="-mt-3 text-sm text-ink-soft">{KIND[kind].hint}</p>

          <label className="flex flex-col gap-1 text-sm font-medium">
            Název
            <input required={!t.en} value={t.cs ?? ""} onChange={(e) => setT({ ...t, cs: e.target.value })} maxLength={120} className={field} placeholder={kind === "item" ? "Např. Kávovar" : "Např. Svatební cesta na Madeiru"} />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium">
            Popis (nepovinný)
            <textarea value={d.cs ?? ""} onChange={(e) => setD({ ...d, cs: e.target.value })} rows={3} maxLength={400} className={`${field} h-auto py-2`} />
          </label>
          {en ? (
            <>
              <label className="flex flex-col gap-1 text-sm font-medium">
                Název anglicky
                <input value={t.en ?? ""} onChange={(e) => setT({ ...t, en: e.target.value })} maxLength={120} className={field} />
              </label>
              <label className="flex flex-col gap-1 text-sm font-medium">
                Popis anglicky
                <textarea value={d.en ?? ""} onChange={(e) => setD({ ...d, en: e.target.value })} rows={2} maxLength={400} className={`${field} h-auto py-2`} />
              </label>
            </>
          ) : (
            <button type="button" onClick={() => setEn(true)} className="-mt-2 self-start text-sm text-eucalyptus-deep hover:underline">
              + Anglický překlad
            </button>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            {kind === "item" ? (
              <label className="flex flex-col gap-1 text-sm font-medium">
                Orientační cena (Kč)
                <input inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} className={field} />
              </label>
            ) : (
              <label className="flex flex-col gap-1 text-sm font-medium">
                Cílová částka (Kč){kind === "fund" ? " – nepovinná" : ""}
                <input inputMode="decimal" required={kind === "group"} value={target} onChange={(e) => setTarget(e.target.value)} className={field} />
              </label>
            )}
            <label className="flex flex-col gap-1 text-sm font-medium">
              Odkaz {kind === "item" ? "na obchod" : ""} (nepovinný)
              <input value={url} onChange={(e) => setUrl(e.target.value)} className={field} placeholder="https://" />
            </label>
          </div>

          <PhotoUpload weddingId={weddingId} value={image} onChange={setImage} label="Fotka (nepovinná)" />

          {kind !== "item" ? (
            <div className="flex flex-col gap-2 text-sm">
              <label className="flex items-center gap-2.5">
                <input type="checkbox" checked={showAmounts} onChange={(e) => setShowAmounts(e.target.checked)} className="size-4 accent-eucalyptus" />
                Ukazovat hostům, kolik už se vybralo
              </label>
              <label className="flex items-center gap-2.5">
                <input type="checkbox" checked={showContributors} onChange={(e) => setShowContributors(e.target.checked)} className="size-4 accent-eucalyptus" />
                Ukazovat hostům, kdo přispěl
              </label>
            </div>
          ) : null}
          {error ? <FormMessage>{error}</FormMessage> : null}
        </div>

        <div className="sticky bottom-0 mt-auto flex gap-3 border-t border-line bg-surface px-6 py-4">
          <button type="submit" disabled={pending} className="h-10 rounded-full bg-eucalyptus px-5 text-sm font-medium text-white hover:bg-eucalyptus-deep disabled:opacity-50">
            {pending ? "Ukládám…" : "Uložit dar"}
          </button>
          <button type="button" onClick={onClose} className="h-10 rounded-full px-4 text-sm text-ink-soft hover:text-ink">
            Zrušit
          </button>
        </div>
      </form>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Seznam darů
// -----------------------------------------------------------------------------
function GiftRow({
  g,
  index,
  count,
  props,
  names,
  onEdit,
  onMove,
}: {
  g: Gift;
  index: number;
  count: number;
  props: Props;
  names: Map<string, string>;
  onEdit: () => void;
  onMove: (dir: -1 | 1) => void;
}) {
  const { pending, error, run } = useAction();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const res = props.reservations.find((r) => r.gift_id === g.id);
  const contr = props.contributions.filter((c) => c.gift_id === g.id);
  const raised = contr.reduce((a, c) => a + c.amount, 0);
  const confirmed = contr.filter((c) => c.confirmed_at).reduce((a, c) => a + c.amount, 0);
  const receivedRes = res ? props.received.some((r) => r.source === "reservation" && r.source_id === res.id) : false;
  const img = photoUrl(g.image_key);
  const pct = g.target_amount ? Math.min(100, Math.round((raised / g.target_amount) * 100)) : null;

  return (
    <li className="flex flex-col gap-4 px-5 py-4 sm:flex-row">
      <div className="flex shrink-0 items-start gap-3">
        {props.canEdit ? (
          <div className="flex flex-col">
            <button type="button" aria-label="Posunout výš" disabled={index === 0} onClick={() => onMove(-1)} className="grid size-7 place-items-center rounded-full text-ink-soft hover:bg-paper disabled:opacity-25">
              <Icon n="chev" className="size-4 -rotate-90" />
            </button>
            <button type="button" aria-label="Posunout níž" disabled={index === count - 1} onClick={() => onMove(1)} className="grid size-7 place-items-center rounded-full text-ink-soft hover:bg-paper disabled:opacity-25">
              <Icon n="chev" className="size-4 rotate-90" />
            </button>
          </div>
        ) : null}
        <div className="grid size-20 shrink-0 place-items-center overflow-hidden rounded-xl bg-paper text-ink-soft">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {img ? <img src={img} alt="" className="size-full object-cover" /> : <Icon n="gift" className="size-7" />}
        </div>
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex flex-wrap items-start gap-x-3 gap-y-1">
          <div className="min-w-0 flex-1">
            <p className="font-medium">{title(g)}</p>
            <p className="text-sm text-ink-soft">
              {KIND[g.kind].label}
              {g.kind === "item" && g.price ? ` · ${czk(g.price)}` : ""}
              {g.kind !== "item" && g.target_amount ? ` · cíl ${czk(g.target_amount)}` : ""}
              {g.url ? (
                <>
                  {" · "}
                  <a href={g.url} target="_blank" rel="noreferrer" className="underline underline-offset-2">
                    odkaz
                  </a>
                </>
              ) : null}
            </p>
          </div>
          {props.canEdit ? (
            <div className="flex items-center gap-3 text-sm">
              <button type="button" onClick={onEdit} className="text-eucalyptus-deep hover:underline">
                Upravit
              </button>
              {confirmDelete ? (
                <span className="flex items-center gap-2">
                  Smazat?
                  <button type="button" disabled={pending} onClick={() => run(() => deleteGift(g.id))} className="rounded-full bg-danger px-3 py-0.5 font-medium text-white">
                    Ano
                  </button>
                  <button type="button" onClick={() => setConfirmDelete(false)} className="text-ink-soft underline">
                    Ne
                  </button>
                </span>
              ) : (
                <button type="button" onClick={() => setConfirmDelete(true)} className="text-ink-soft hover:text-danger">
                  Smazat
                </button>
              )}
            </div>
          ) : null}
        </div>

        {g.kind === "item" ? (
          !props.reveal ? (
            <p className="text-sm text-ink-soft">Rezervace jsou skryté – překvapení.</p>
          ) : res ? (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
              <span className="rounded-full bg-eucalyptus-mist px-2.5 py-0.5 font-medium text-eucalyptus-deep">Rezervuje: {names.get(res.household_id) ?? "host"}</span>
              {props.canEdit ? (
                <>
                  <label className="flex items-center gap-2">
                    <input type="checkbox" disabled={pending} checked={receivedRes} onChange={(e) => run(() => reservationReceived(res.id, e.target.checked))} className="size-4 accent-eucalyptus" />
                    Dar jsme dostali
                  </label>
                  <button type="button" disabled={pending} onClick={() => run(() => cancelReservation(res.id))} className="text-ink-soft hover:text-danger">
                    Zrušit rezervaci
                  </button>
                </>
              ) : null}
            </div>
          ) : (
            <p className="text-sm text-ink-soft">Volné</p>
          )
        ) : (
          <div className="flex flex-col gap-2">
            {pct !== null ? (
              <div className="h-1.5 w-full max-w-sm overflow-hidden rounded-full bg-paper">
                <div className="h-full rounded-full bg-eucalyptus" style={{ width: `${pct}%` }} />
              </div>
            ) : null}
            <p className="text-sm text-ink-soft">
              Přislíbeno {czk(raised)}
              {g.target_amount ? ` z ${czk(g.target_amount)}` : ""} · dorazilo {czk(confirmed)}
            </p>
            {contr.length ? (
              <ul className="flex flex-col divide-y divide-line/70 rounded-xl ring-1 ring-line/70">
                {contr.map((c) => (
                  <li key={c.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-sm">
                    <span className="min-w-0 flex-1 truncate">{(c.household_id && names.get(c.household_id)) || c.display_name || "Host"}</span>
                    <span className="tabular-nums">{czk(c.amount)}</span>
                    {props.canEdit ? (
                      <>
                        <label className="flex items-center gap-1.5 text-ink-soft">
                          <input type="checkbox" disabled={pending} checked={!!c.confirmed_at} onChange={(e) => run(() => confirmContribution(c.id, e.target.checked))} className="size-4 accent-eucalyptus" />
                          dorazilo na účet
                        </label>
                        <button type="button" aria-label="Smazat příspěvek" disabled={pending} onClick={() => run(() => deleteContribution(c.id))} className="text-ink-soft hover:text-danger">
                          <Icon n="close" className="size-4" />
                        </button>
                      </>
                    ) : c.confirmed_at ? (
                      <span className="text-eucalyptus-deep">dorazilo</span>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        )}
        {error ? <FormMessage>{error}</FormMessage> : null}
      </div>
    </li>
  );
}

function GiftListTab(props: Props) {
  const [editing, setEditing] = useState<Gift | "new" | null>(null);
  const [order, setOrder] = useState(props.gifts.map((g) => g.id));
  const { error, run } = useAction();
  const names = useMemo(() => new Map(props.households.map((h) => [h.id, h.name])), [props.households]);
  const byId = new Map(props.gifts.map((g) => [g.id, g]));
  const list = [...order.filter((id) => byId.has(id)), ...props.gifts.filter((g) => !order.includes(g.id)).map((g) => g.id)].map((id) => byId.get(id)!);

  const reserved = props.reveal ? props.reservations.length : null;
  const pledged = props.contributions.reduce((a, c) => a + c.amount, 0);

  function move(i: number, dir: -1 | 1) {
    const ids = list.map((g) => g.id);
    [ids[i], ids[i + dir]] = [ids[i + dir], ids[i]];
    setOrder(ids);
    run(() => reorderGifts(ids));
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-3 gap-3">
        {[
          ["Darů na seznamu", String(props.gifts.length)],
          ["Zarezervováno", reserved === null ? "skryto" : `${reserved} z ${props.gifts.filter((g) => g.kind === "item").length}`],
          ["Přislíbeno", czk(pledged)],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl bg-surface px-5 py-4 shadow-card ring-1 ring-line/70">
            <p className="text-sm text-ink-soft">{label}</p>
            <p className="mt-1 font-serif text-2xl tabular-nums">{value}</p>
          </div>
        ))}
      </div>

      {props.gifts.length ? (
        <section className="overflow-hidden rounded-2xl bg-surface shadow-card ring-1 ring-line/70">
          <ul className="divide-y divide-line/70">
            {list.map((g, i) => (
              <GiftRow key={g.id} g={g} index={i} count={list.length} props={props} names={names} onEdit={() => setEditing(g)} onMove={(d) => move(i, d)} />
            ))}
          </ul>
        </section>
      ) : (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-line px-6 py-12 text-center">
          <Icon n="gift" className="size-8 text-ink-soft" />
          <p className="max-w-md text-ink-soft">
            Přidejte věci, které by vám udělaly radost, nebo příspěvek třeba na svatební cestu. Hosté si dar zarezervují přes svůj osobní odkaz, takže nic nedostanete
            dvakrát.
          </p>
        </div>
      )}
      {error ? <FormMessage>{error}</FormMessage> : null}

      {props.canEdit ? (
        <button
          type="button"
          onClick={() => setEditing("new")}
          className="inline-flex h-11 items-center gap-2 self-start rounded-full bg-eucalyptus px-5 font-medium text-white hover:bg-eucalyptus-deep"
        >
          <Icon n="plus" className="size-4" />
          Přidat dar
        </button>
      ) : null}

      {editing ? <GiftEditor gift={editing === "new" ? null : editing} weddingId={props.weddingId} onClose={() => setEditing(null)} /> : null}
    </div>
  );
}

// -----------------------------------------------------------------------------
// Obdržené dary a poděkování
// -----------------------------------------------------------------------------
function ReceivedTab(props: Props) {
  const [household, setHousehold] = useState("");
  const [desc, setDesc] = useState("");
  const [amount, setAmount] = useState("");
  const { pending, error, run } = useAction();
  const groups = props.households
    .map((h) => ({ h, items: props.received.filter((r) => r.household_id === h.id) }))
    .filter((g) => g.items.length);
  const toThank = groups.filter((g) => !g.h.thanked).length;
  const SOURCE = { manual: "zapsáno ručně", reservation: "ze seznamu darů", contribution: "příspěvek" } as const;

  return (
    <div className="flex flex-col gap-6">
      <p className="max-w-2xl text-ink-soft">
        Přehled, kdo vám co daroval – podklad pro poděkování. Dary ze seznamu se sem dostanou, když u nich označíte, že dorazily. Ostatní dary (obálky, věci mimo
        seznam) zapište ručně.
      </p>

      {groups.length ? (
        <section className="overflow-hidden rounded-2xl bg-surface shadow-card ring-1 ring-line/70">
          <div className="flex flex-wrap items-center gap-3 border-b border-line px-5 py-3.5 text-sm">
            <span className="font-medium">{groups.length} domácností</span>
            <span className="text-ink-soft">· {toThank ? `${toThank} čeká na poděkování` : "všem poděkováno"}</span>
            {toThank ? (
              <Link href="/app/hoste/emaily?druh=podekovani" className="ml-auto inline-flex items-center gap-1.5 text-eucalyptus-deep hover:underline">
                <Icon n="send" className="size-4" />
                Poslat poděkování
              </Link>
            ) : null}
          </div>
          <ul className="divide-y divide-line/70">
            {groups.map(({ h, items }) => (
              <li key={h.id} className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-start">
                <div className="min-w-0 sm:w-56">
                  <Link href={`/app/hoste/${h.id}`} className="font-medium hover:underline">
                    {h.name}
                  </Link>
                  <p className="text-sm">{h.thanked ? <span className="text-eucalyptus-deep">✓ poděkováno</span> : <span className="text-plum">čeká na poděkování</span>}</p>
                </div>
                <ul className="flex flex-1 flex-col gap-1 text-sm">
                  {items.map((r) => (
                    <li key={r.id} className="flex flex-wrap items-center gap-x-3">
                      <span className="font-medium">{r.description}</span>
                      {r.amount ? <span className="tabular-nums">{czk(r.amount)}</span> : null}
                      <span className="text-ink-soft">{SOURCE[r.source]}</span>
                      {r.source === "manual" && props.canEdit ? (
                        <button type="button" aria-label="Smazat" disabled={pending} onClick={() => run(() => deleteReceived(r.id))} className="text-ink-soft hover:text-danger">
                          <Icon n="close" className="size-3.5" />
                        </button>
                      ) : null}
                    </li>
                  ))}
                </ul>
                {!h.thanked && h.email && props.canEdit ? (
                  <Link href={`/app/hoste/emaily?druh=podekovani&domacnost=${h.id}`} className="self-start text-sm text-eucalyptus-deep hover:underline">
                    Poděkovat
                  </Link>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <p className="rounded-2xl border border-dashed border-line px-6 py-10 text-center text-ink-soft">Zatím žádné obdržené dary.</p>
      )}

      {props.canEdit ? (
        <form
          className="flex flex-col gap-4 rounded-2xl bg-surface p-5 shadow-card ring-1 ring-line/70"
          onSubmit={(e) => {
            e.preventDefault();
            run(
              () => addReceived({ household_id: household, description: desc, amount }),
              () => {
                setDesc("");
                setAmount("");
              },
            );
          }}
        >
          <h2 className="font-medium">Zapsat dar</h2>
          <div className="grid gap-3 sm:grid-cols-[1.2fr_1.5fr_0.8fr_auto] sm:items-end">
            <label className="flex flex-col gap-1 text-sm font-medium">
              Od koho
              <select required value={household} onChange={(e) => setHousehold(e.target.value)} className={field}>
                <option value="">Vyberte domácnost…</option>
                {props.households.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium">
              Co
              <input required value={desc} onChange={(e) => setDesc(e.target.value)} maxLength={200} placeholder="Např. obálka, sada sklenic" className={field} />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium">
              Částka (Kč)
              <input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} className={field} />
            </label>
            <button type="submit" disabled={pending} className="h-10 rounded-full bg-ink px-5 text-sm font-medium text-white hover:bg-ink/85 disabled:opacity-50">
              Přidat
            </button>
          </div>
          {error ? <FormMessage>{error}</FormMessage> : null}
        </form>
      ) : null}
    </div>
  );
}

function SettingsTab(props: Props) {
  const { pending, error, run } = useAction();
  return (
    <div className="flex max-w-2xl flex-col gap-4">
      <section className="flex flex-col gap-3 rounded-2xl bg-surface p-5 shadow-card ring-1 ring-line/70">
        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            disabled={!props.canEdit || pending}
            checked={!props.reveal}
            onChange={(e) => run(() => setReveal(!e.target.checked))}
            className="mt-1 size-4 accent-eucalyptus"
          />
          <span>
            <span className="block font-medium">Překvapení</span>
            <span className="text-sm text-ink-soft">
              Neuvidíte, kdo si který dar zarezervoval. Hosté dál vidí, co je zabrané, takže nic nedostanete dvakrát. Příspěvky na účet vidíte vždy, abyste je mohli
              spárovat s platbami.
            </span>
          </span>
        </label>
      </section>
      <section className="flex flex-wrap items-center gap-3 rounded-2xl bg-surface p-5 shadow-card ring-1 ring-line/70">
        <span className="flex-1">
          <span className="block font-medium">Číslo účtu pro příspěvky</span>
          <span className="text-sm text-ink-soft">
            {props.hasAccount ? "Nastavené – hosté dostanou QR platbu s částkou." : "Zatím nenastavené – hosté nedostanou QR platbu."}
          </span>
        </span>
        <Link href="/app/web/gifts" className="h-10 rounded-full border border-line px-5 text-sm font-medium leading-10 hover:border-eucalyptus">
          {props.hasAccount ? "Změnit" : "Nastavit"}
        </Link>
      </section>
      {error ? <FormMessage>{error}</FormMessage> : null}
    </div>
  );
}

export function GiftsView(props: Props) {
  const tabs = [
    ["seznam", "Seznam darů"],
    ["obdrzene", "Obdržené a poděkování"],
    ["nastaveni", "Nastavení"],
  ] as const;
  return (
    <div className="flex max-w-5xl flex-col gap-8 px-6 py-8 sm:px-10 lg:py-10">
      <div className="flex flex-col gap-2">
        <h1 className="font-serif text-4xl tracking-tight">Dary</h1>
        <p className="max-w-2xl text-ink-soft">Seznam přání na svatebním webu. Peníze posílají hosté rovnou na váš účet, my je nikde nedržíme.</p>
      </div>
      {!props.sectionOn ? (
        <p className="rounded-2xl bg-plum/8 px-5 py-4 text-sm text-plum">
          Sekce Dary je na webu vypnutá, hosté seznam neuvidí.{" "}
          <Link href="/app/web/editor" className="font-medium underline">
            Zapnout v editoru webu
          </Link>
        </p>
      ) : null}
      <nav className="flex flex-wrap gap-1 rounded-full bg-surface p-1 ring-1 ring-line/70 sm:self-start" aria-label="Části">
        {tabs.map(([key, label]) => (
          <Link
            key={key}
            href={key === "seznam" ? "/app/dary" : `/app/dary?tab=${key}`}
            aria-current={props.tab === key ? "page" : undefined}
            className={`rounded-full px-4 py-1.5 text-sm ${props.tab === key ? "bg-ink text-white" : "text-ink-soft hover:text-ink"}`}
          >
            {label}
          </Link>
        ))}
      </nav>
      {props.tab === "seznam" ? <GiftListTab {...props} /> : props.tab === "obdrzene" ? <ReceivedTab {...props} /> : <SettingsTab {...props} />}
    </div>
  );
}
