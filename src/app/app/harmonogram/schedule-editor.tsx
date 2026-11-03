"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { Icon } from "@/components/icons";
import { FormMessage } from "@/components/ui";
import type { ScheduleItem } from "@/lib/schedule";
import { createShareLink, deleteItem, revokeShareLink, saveItem, saveVendor, type FormState } from "./actions";

export type Vendor = { id: string; name: string; category: string | null; contact_name: string | null; phone: string | null; email: string | null };
export type ShareLink = { id: string; vendor_id: string | null; url: string };
type Local = { date: string; start: string; end: string };

const field = "h-10 rounded-lg border border-line bg-surface px-3 text-[15px] font-normal focus:border-eucalyptus focus:outline-none";
const label = "flex flex-col gap-1 text-sm font-medium";

export function ScheduleEditor({
  items,
  local,
  vendors,
  links,
  weddingDate,
  canEdit,
}: {
  items: ScheduleItem[];
  local: Record<string, Local>;
  vendors: Vendor[];
  links: ShareLink[];
  weddingDate: string | null;
  canEdit: boolean;
}) {
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [vendorForm, setVendorForm] = useState<string | "new" | null>(null);
  const [, start] = useTransition();
  const vendorName = new Map(vendors.map((v) => [v.id, v.name]));
  const days = [...new Set(items.map((i) => local[i.id].date))].sort();
  const dayLabel = (d: string) =>
    new Intl.DateTimeFormat("cs-CZ", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(`${d}T00:00:00Z`));
  const mainLink = links.find((l) => !l.vendor_id) ?? null;
  const vendorsWithItems = vendors.filter((v) => items.some((i) => i.vendor_id === v.id));
  const last = items.reduce<ScheduleItem | null>((m, i) => (!m || (i.ends_at ?? i.starts_at) > (m.ends_at ?? m.starts_at) ? i : m), null);
  const lastEnd = last ? local[last.id].end || local[last.id].start : null;

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="flex flex-col gap-6">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            [String(items.length), items.length === 1 ? "položka" : items.length < 5 && items.length > 0 ? "položky" : "položek"],
            [items.length ? local[items[0].id].start : "–", "začátek"],
            [lastEnd ?? "–", "konec"],
            [String(vendorsWithItems.length), "dodavatelé"],
          ].map(([v, l]) => (
            <div key={l} className="rounded-xl bg-surface px-4 py-3 shadow-card ring-1 ring-line/70">
              <p className="font-display text-2xl font-semibold tabular-nums">{v}</p>
              <p className="text-sm text-ink-soft">{l}</p>
            </div>
          ))}
        </div>
        {canEdit ? (
          <button type="button" onClick={() => setEditing("new")} className="inline-flex h-10 items-center gap-2 self-start rounded-full bg-ink px-4 text-sm font-medium text-white hover:bg-ink/85">
            <Icon n="plus" className="size-4" />
            Přidat položku
          </button>
        ) : null}
        {editing === "new" ? (
          <ItemForm item={null} local={{ date: weddingDate ?? "", start: "", end: "" }} vendors={vendors} onNewVendor={() => setVendorForm("new")} onDone={() => setEditing(null)} />
        ) : null}

        {items.length === 0 && editing !== "new" ? (
          <p className="text-ink-soft">
            Zatím prázdné. Začněte třeba příjezdem kadeřnice, focením příprav, odjezdem na obřad a příjezdem kapely.
          </p>
        ) : null}

        {days.map((d) => {
          const dayItems = items.filter((i) => local[i.id].date === d);
          return (
            <section key={d} className="flex flex-col gap-4">
              {days.length > 1 ? <h2 className="font-serif text-2xl first-letter:uppercase">{dayLabel(d)}</h2> : null}
              {PARTS.map((part) => {
                const list = dayItems.filter((i) => partOf(local[i.id].start) === part.key);
                if (!list.length) return null;
                return (
                  <div key={part.key} className="flex flex-col gap-3">
                    <p className="flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-soft/80">
                      {part.label}
                      <span className="h-px flex-1 bg-line" />
                    </p>
                    <ol className="relative flex flex-col gap-3 before:absolute before:bottom-3 before:left-[4.95rem] before:top-3 before:w-px before:bg-line sm:before:left-[5.7rem]">
                      {list.map((i) =>
                        editing === i.id ? (
                          <li key={i.id}>
                            <ItemForm item={i} local={local[i.id]} vendors={vendors} onNewVendor={() => setVendorForm("new")} onDone={() => setEditing(null)} />
                          </li>
                        ) : (
                          <li key={i.id} className="relative grid grid-cols-[4rem_1rem_minmax(0,1fr)] items-start gap-2 sm:grid-cols-[4.5rem_1.5rem_minmax(0,1fr)] sm:gap-3">
                            <div className="pt-3.5 text-right tabular-nums">
                              <p className="font-display text-lg font-semibold leading-none sm:text-xl">{local[i.id].start}</p>
                              {local[i.id].end ? <p className="mt-1 text-xs text-ink-soft">do {local[i.id].end}</p> : null}
                            </div>
                            <span className="relative z-10 mt-4 size-3.5 justify-self-center rounded-full bg-eucalyptus ring-4 ring-paper" />
                            <article className="rounded-2xl border-l-[3px] border-eucalyptus bg-surface p-4 shadow-card ring-1 ring-line/70">
                              <div className="flex items-start justify-between gap-3">
                                <h3 className="text-[17px] font-semibold leading-snug">{i.title}</h3>
                                {duration(i) ? <span className="shrink-0 rounded-full bg-eucalyptus-mist px-2.5 py-0.5 text-xs font-medium text-eucalyptus-deep">{duration(i)}</span> : null}
                              </div>
                              {i.location || i.responsible_name || i.vendor_id || i.contact ? (
                                <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-ink-soft">
                                  {i.location ? <span className="flex items-center gap-1.5"><Icon n="pin" className="size-4" />{i.location}</span> : null}
                                  {i.responsible_name ? <span className="flex items-center gap-1.5"><Icon n="user" className="size-4" />{i.responsible_name}</span> : null}
                                  {i.vendor_id && vendorName.get(i.vendor_id) ? <span className="flex items-center gap-1.5"><Icon n="shop" className="size-4" />{vendorName.get(i.vendor_id)}</span> : null}
                                  {i.contact ? <span className="flex items-center gap-1.5"><Icon n="phone" className="size-4" />{i.contact}</span> : null}
                                </div>
                              ) : null}
                              {i.notes ? <p className="mt-3 whitespace-pre-line rounded-lg bg-paper px-3 py-2 text-sm">{i.notes}</p> : null}
                              {canEdit ? (
                                <div className="mt-3 flex gap-4 border-t border-line pt-2.5 text-sm">
                                  <button type="button" onClick={() => setEditing(i.id)} className="text-ink-soft hover:text-ink">Upravit</button>
                                  <button type="button" onClick={() => start(() => deleteItem(i.id))} className="text-ink-soft hover:text-danger">Smazat</button>
                                </div>
                              ) : null}
                            </article>
                          </li>
                        ),
                      )}
                    </ol>
                  </div>
                );
              })}
            </section>
          );
        })}
      </div>

      <aside className="flex flex-col gap-6 lg:sticky lg:top-6 lg:self-start">
        <section className="flex flex-col gap-3 rounded-2xl bg-eucalyptus-mist p-5">
          <h2 className="flex items-center gap-2 font-medium"><Icon n="link" className="size-4" />Sdílení</h2>
          <p className="text-sm text-ink-soft">
            Odkaz pošlete svědkům nebo koordinátorce. Uvidí celý program s kontakty a v den svatby i to, co se děje právě teď. Nepotřebují účet.
          </p>
          <LinkRow link={mainLink} canEdit={canEdit} onCreate={() => start(() => createShareLink(null))} onRevoke={(id) => start(() => revokeShareLink(id))} />
          {vendorsWithItems.length ? (
            <div className="flex flex-col gap-3 border-t border-eucalyptus/20 pt-3">
              <p className="text-sm text-ink-soft">Dodavatelé dostanou odkaz jen se svými položkami.</p>
              {vendorsWithItems.map((v) => (
                <div key={v.id} className="flex flex-col gap-1">
                  <span className="text-sm font-medium">{v.name}</span>
                  <LinkRow
                    link={links.find((l) => l.vendor_id === v.id) ?? null}
                    canEdit={canEdit}
                    onCreate={() => start(() => createShareLink(v.id))}
                    onRevoke={(id) => start(() => revokeShareLink(id))}
                  />
                </div>
              ))}
            </div>
          ) : null}
          {mainLink ? (
            <a href={`${mainLink.url}?tisk=1`} target="_blank" rel="noreferrer" className="text-sm font-medium underline underline-offset-2">
              Vytisknout nebo uložit jako PDF
            </a>
          ) : null}
        </section>

        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="font-serif text-2xl">Dodavatelé</h2>
            {canEdit ? (
              <button type="button" onClick={() => setVendorForm("new")} className="text-sm font-medium text-eucalyptus-deep hover:underline">
                Přidat
              </button>
            ) : null}
          </div>
          {vendorForm === "new" ? <VendorForm vendor={null} onDone={() => setVendorForm(null)} /> : null}
          <ul className="flex flex-col divide-y divide-line">
            {vendors.map((v) =>
              vendorForm === v.id ? (
                <li key={v.id} className="py-2">
                  <VendorForm vendor={v} onDone={() => setVendorForm(null)} />
                </li>
              ) : (
                <li key={v.id} className="flex items-start justify-between gap-3 py-2.5 text-sm">
                  <span>
                    <span className="font-medium">{v.name}</span>
                    {v.category ? <span className="text-ink-soft">, {v.category}</span> : null}
                    <span className="block text-ink-soft">{[v.contact_name, v.phone, v.email].filter(Boolean).join(", ")}</span>
                  </span>
                  {canEdit ? (
                    <button type="button" onClick={() => setVendorForm(v.id)} className="shrink-0 text-ink-soft hover:text-ink">Upravit</button>
                  ) : null}
                </li>
              ),
            )}
            {vendors.length === 0 && vendorForm !== "new" ? <li className="py-2 text-sm text-ink-soft">Fotograf, kapela, catering, vizážistka…</li> : null}
          </ul>
        </section>
      </aside>
    </div>
  );
}

function LinkRow({ link, canEdit, onCreate, onRevoke }: { link: ShareLink | null; canEdit: boolean; onCreate: () => void; onRevoke: (id: string) => void }) {
  const [copied, setCopied] = useState(false);
  if (!link) {
    return canEdit ? (
      <button type="button" onClick={onCreate} className="h-9 self-start rounded-full border border-line bg-surface px-4 text-sm font-medium hover:border-eucalyptus">
        Vytvořit odkaz
      </button>
    ) : (
      <p className="text-sm text-ink-soft">Odkaz zatím není.</p>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      <input readOnly value={link.url} onFocus={(e) => e.target.select()} aria-label="Sdílený odkaz" className="h-9 w-full rounded-lg border border-line bg-surface px-3 text-sm" />
      <div className="flex flex-wrap gap-3 text-sm">
        <button
          type="button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(link.url);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            } catch {}
          }}
          className="font-medium text-eucalyptus-deep hover:underline"
        >
          {copied ? "Zkopírováno" : "Kopírovat"}
        </button>
        <a href={link.url} target="_blank" rel="noreferrer" className="text-ink-soft hover:text-ink">Otevřít</a>
        {canEdit ? (
          <>
            <button type="button" onClick={onCreate} className="text-ink-soft hover:text-ink">Nový odkaz</button>
            <button type="button" onClick={() => onRevoke(link.id)} className="text-ink-soft hover:text-danger">Zrušit</button>
          </>
        ) : null}
      </div>
    </div>
  );
}

function ItemForm({ item, local, vendors, onNewVendor, onDone }: { item: ScheduleItem | null; local: Local; vendors: Vendor[]; onNewVendor: () => void; onDone: () => void }) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveItem.bind(null, item?.id ?? null), {});
  useEffect(() => {
    if (state.ok) onDone();
  }, [state, onDone]);
  return (
    <form action={action} className="flex flex-col gap-3 rounded-xl border border-eucalyptus bg-surface p-4">
      <div className="grid grid-cols-3 gap-3">
        <label className={label}>
          Den
          <input name="date" type="date" required defaultValue={local.date} className={field} />
        </label>
        <label className={label}>
          Od
          <input name="start" type="time" required defaultValue={local.start} className={field} autoFocus={!item} />
        </label>
        <label className={label}>
          Do
          <input name="end" type="time" defaultValue={local.end} className={field} />
        </label>
      </div>
      <label className={label}>
        Co se děje
        <input name="title" required maxLength={160} defaultValue={item?.title} placeholder="Například Příjezd kadeřnice" className={field} />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className={label}>
          Kde
          <input name="location" maxLength={160} defaultValue={item?.location ?? ""} className={field} />
        </label>
        <label className={label}>
          Kdo to má na starost
          <input name="responsible_name" maxLength={80} defaultValue={item?.responsible_name ?? ""} placeholder="Například svědkyně Kateřina" className={field} />
        </label>
        <label className={label}>
          Dodavatel
          <span className="flex gap-2">
            <select name="vendor_id" defaultValue={item?.vendor_id ?? ""} className={`${field} min-w-0 flex-1`}>
              <option value="">Žádný</option>
              {vendors.map((v) => (
                <option key={v.id} value={v.id}>{v.name}</option>
              ))}
            </select>
            <button type="button" onClick={onNewVendor} className="shrink-0 text-sm text-eucalyptus-deep hover:underline">Nový</button>
          </span>
        </label>
        <label className={label}>
          Kontakt
          <input name="contact" maxLength={120} defaultValue={item?.contact ?? ""} placeholder="Telefon" className={field} />
        </label>
      </div>
      <textarea name="notes" rows={2} maxLength={1000} defaultValue={item?.notes ?? ""} placeholder="Poznámka" aria-label="Poznámka" className={`${field} h-auto py-2`} />
      {state.error ? <FormMessage>{state.error}</FormMessage> : null}
      <div className="flex gap-3">
        <button type="submit" disabled={pending} className="h-9 rounded-full bg-eucalyptus px-4 text-sm font-medium text-white hover:bg-eucalyptus-deep disabled:opacity-50">
          {pending ? "Ukládám…" : "Uložit"}
        </button>
        <button type="button" onClick={onDone} className="px-2 text-sm text-ink-soft hover:text-ink">Zrušit</button>
      </div>
    </form>
  );
}

function VendorForm({ vendor, onDone }: { vendor: Vendor | null; onDone: () => void }) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveVendor.bind(null, vendor?.id ?? null), {});
  useEffect(() => {
    if (state.ok) onDone();
  }, [state, onDone]);
  return (
    <form action={action} className="flex flex-col gap-2 rounded-xl border border-eucalyptus bg-surface p-3">
      <input name="name" required maxLength={100} defaultValue={vendor?.name} placeholder="Název, např. Foto Novák" aria-label="Název" className={field} autoFocus />
      <input name="category" maxLength={60} defaultValue={vendor?.category ?? ""} placeholder="Obor, např. fotograf" aria-label="Obor" className={field} />
      <input name="contact_name" maxLength={80} defaultValue={vendor?.contact_name ?? ""} placeholder="Kontaktní osoba" aria-label="Kontaktní osoba" className={field} />
      <div className="grid grid-cols-2 gap-2">
        <input name="phone" type="tel" maxLength={40} defaultValue={vendor?.phone ?? ""} placeholder="Telefon" aria-label="Telefon" className={field} />
        <input name="email" type="email" maxLength={120} defaultValue={vendor?.email ?? ""} placeholder="E-mail" aria-label="E-mail" className={field} />
      </div>
      {state.error ? <FormMessage>{state.error}</FormMessage> : null}
      <div className="flex gap-3">
        <button type="submit" disabled={pending} className="h-9 rounded-full bg-eucalyptus px-4 text-sm font-medium text-white disabled:opacity-50">
          {pending ? "Ukládám…" : "Uložit"}
        </button>
        <button type="button" onClick={onDone} className="px-2 text-sm text-ink-soft hover:text-ink">Zrušit</button>
      </div>
    </form>
  );
}

const PARTS = [
  { key: "morning", label: "Dopoledne" },
  { key: "afternoon", label: "Odpoledne" },
  { key: "evening", label: "Večer" },
] as const;

function partOf(time: string): (typeof PARTS)[number]["key"] {
  const h = Number(time.slice(0, 2));
  return h >= 5 && h < 12 ? "morning" : h >= 12 && h < 17 ? "afternoon" : "evening";
}

function duration(i: ScheduleItem): string | null {
  if (!i.ends_at) return null;
  const m = Math.round((Date.parse(i.ends_at) - Date.parse(i.starts_at)) / 60_000);
  if (m <= 0) return null;
  const h = Math.floor(m / 60);
  return h ? `${h} h${m % 60 ? ` ${m % 60} min` : ""}` : `${m} min`;
}
