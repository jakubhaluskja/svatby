"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { PhotoUpload } from "@/components/photo-upload";
import { Button, FormMessage } from "@/components/ui";
import type { LText, Section } from "@/lib/site-sections";
import { saveSection } from "../actions";

const inputCls = "w-full rounded-lg border border-line bg-surface px-3.5 py-2.5 text-[15px] focus:border-eucalyptus focus:outline-none";

function LField({
  label,
  value,
  onChange,
  english,
  rows = 4,
  hint,
  single,
}: {
  label: string;
  value: LText;
  onChange: (v: LText) => void;
  english: boolean;
  rows?: number;
  hint?: string;
  single?: boolean;
}) {
  const Field = (lang: "cs" | "en") =>
    single ? (
      <input aria-label={lang === "en" ? `${label} anglicky` : label} value={value[lang]} onChange={(e) => onChange({ ...value, [lang]: e.target.value })} className={`${inputCls} h-11 py-0`} maxLength={300} />
    ) : (
      <textarea aria-label={lang === "en" ? `${label} anglicky` : label} rows={rows} value={value[lang]} onChange={(e) => onChange({ ...value, [lang]: e.target.value })} className={inputCls} maxLength={5000} />
    );
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-medium">{label}</span>
      <div className={english ? "grid gap-3 sm:grid-cols-2" : ""}>
        <div className="flex flex-col gap-1">
          {english ? <span className="text-xs text-ink-soft">Česky</span> : null}
          {Field("cs")}
        </div>
        {english ? (
          <div className="flex flex-col gap-1">
            <span className="text-xs text-ink-soft">Anglicky</span>
            {Field("en")}
          </div>
        ) : null}
      </div>
      {hint ? <span className="text-sm text-ink-soft">{hint}</span> : null}
    </div>
  );
}

const emptyL = (): LText => ({ cs: "", en: "" });

export function SectionEditor({ section, english, weddingId }: { section: Section; english: boolean; weddingId: string }) {
  const [content, setContent] = useState(section.content as Record<string, unknown>);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function set(patch: Record<string, unknown>) {
    setContent((c) => ({ ...c, ...patch }));
    setSaved(false);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    start(async () => {
      const r = await saveSection(section.type, content);
      if (r.ok) setSaved(true);
      else setError(r.error ?? "Uložení se nepovedlo.");
    });
  }

  const c = content as never as Record<string, LText> & {
    photo: string | null;
    photos: string[];
    show_account: boolean;
    items: Record<string, unknown>[];
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-8">
      {section.type === "hero" ? (
        <>
          <PhotoUpload weddingId={weddingId} label="Úvodní fotka" value={c.photo} onChange={(photo) => set({ photo })} />
          <LField label="Pozdrav pro hosty" value={c.intro} onChange={(intro) => set({ intro })} english={english} rows={3} hint="Například: Budeme se brát a moc rádi vás u toho uvidíme." />
        </>
      ) : null}

      {section.type === "schedule" || section.type === "rsvp" ? (
        <LField
          label="Úvodní text"
          value={c.intro}
          onChange={(intro) => set({ intro })}
          english={english}
          rows={3}
          hint={section.type === "schedule" ? "Program se skládá z událostí. Upravíte je v sekci Události." : "Zobrazí se nad formulářem potvrzení účasti."}
        />
      ) : null}

      {["location", "dresscode", "accommodation"].includes(section.type) ? (
        <LField
          label="Text"
          value={c.text}
          onChange={(text) => set({ text })}
          english={english}
          rows={8}
          hint={
            section.type === "location"
              ? "Kde parkovat, jak dojet vlakem, kdy jede autobus. Adresy míst se berou z událostí."
              : section.type === "dresscode"
                ? "Pište konkrétně: „oblek, šaty ke kolenům, na trávu boty bez jehlových podpatků“."
                : "Hotely v okolí, ceny, do kdy rezervovat, heslo pro svatební slevu."
          }
        />
      ) : null}

      {section.type === "story" ? (
        <>
          <LField label="Váš příběh" value={c.text} onChange={(text) => set({ text })} english={english} rows={8} />
          <div className="flex flex-col gap-4">
            <span className="text-sm font-medium">Fotky (až 6)</span>
            <div className="grid gap-6 sm:grid-cols-2">
              {[...c.photos, null].slice(0, 6).map((p, i) => (
                <PhotoUpload
                  key={p ?? `new-${i}`}
                  weddingId={weddingId}
                  label={`Fotka ${i + 1}`}
                  value={p}
                  onChange={(path) => {
                    const next = [...c.photos];
                    if (path) next[i] = path;
                    else next.splice(i, 1);
                    set({ photos: next.filter(Boolean) });
                  }}
                />
              ))}
            </div>
          </div>
        </>
      ) : null}

      {section.type === "gifts" ? (
        <>
          <LField label="Text" value={c.text} onChange={(text) => set({ text })} english={english} rows={5} hint="Co by vám udělalo radost. Seznam konkrétních darů s rezervací přidáte v modulu Dary." />
          <label className="flex items-start gap-2.5">
            <input type="checkbox" checked={c.show_account} onChange={(e) => set({ show_account: e.target.checked })} className="mt-1 size-4 accent-eucalyptus" />
            <span>
              Zobrazit číslo účtu a QR platbu
              <span className="block text-sm text-ink-soft">Peníze jdou přímo na váš účet. Číslo účtu nastavíte níže.</span>
            </span>
          </label>
        </>
      ) : null}

      {section.type === "faq" ? (
        <ListEditor
          items={c.items}
          onChange={(items) => set({ items })}
          empty={() => ({ q: emptyL(), a: emptyL() })}
          addLabel="Přidat otázku"
          render={(item, update) => (
            <>
              <LField label="Otázka" single value={item.q as LText} onChange={(q) => update({ q })} english={english} />
              <LField label="Odpověď" value={item.a as LText} onChange={(a) => update({ a })} english={english} rows={3} />
            </>
          )}
        />
      ) : null}

      {section.type === "contacts" ? (
        <ListEditor
          items={c.items}
          onChange={(items) => set({ items })}
          empty={() => ({ name: "", role: emptyL(), phone: "", email: "" })}
          addLabel="Přidat kontakt"
          render={(item, update) => (
            <>
              <div className="grid gap-3 sm:grid-cols-3">
                <label className="flex flex-col gap-1.5 text-sm font-medium">
                  Jméno
                  <input value={item.name as string} onChange={(e) => update({ name: e.target.value })} className={`${inputCls} h-11 py-0 font-normal`} maxLength={80} />
                </label>
                <label className="flex flex-col gap-1.5 text-sm font-medium">
                  Telefon
                  <input type="tel" value={item.phone as string} onChange={(e) => update({ phone: e.target.value })} className={`${inputCls} h-11 py-0 font-normal`} maxLength={40} />
                </label>
                <label className="flex flex-col gap-1.5 text-sm font-medium">
                  E-mail
                  <input type="email" value={item.email as string} onChange={(e) => update({ email: e.target.value })} className={`${inputCls} h-11 py-0 font-normal`} maxLength={120} />
                </label>
              </div>
              <LField label="Role" single value={item.role as LText} onChange={(role) => update({ role })} english={english} hint="Například svědkyně nebo koordinátorka." />
            </>
          )}
        />
      ) : null}

      {error ? <FormMessage>{error}</FormMessage> : null}
      {saved ? <FormMessage tone="info">Uloženo do konceptu. Hostům se změny ukážou po zveřejnění.</FormMessage> : null}

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Ukládám…" : "Uložit"}
        </Button>
        <Link href="/app/web" className="px-4 text-ink-soft hover:text-ink">
          Zpět na web
        </Link>
      </div>
    </form>
  );
}

function ListEditor({
  items,
  onChange,
  empty,
  addLabel,
  render,
}: {
  items: Record<string, unknown>[];
  onChange: (items: Record<string, unknown>[]) => void;
  empty: () => Record<string, unknown>;
  addLabel: string;
  render: (item: Record<string, unknown>, update: (patch: Record<string, unknown>) => void) => React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4">
      {items.map((item, i) => (
        <div key={i} className="flex flex-col gap-4 rounded-xl border border-line bg-surface p-4">
          {render(item, (patch) => onChange(items.map((x, j) => (j === i ? { ...x, ...patch } : x))))}
          <div className="flex gap-3 text-sm">
            <button type="button" disabled={i === 0} onClick={() => { const n = [...items]; [n[i - 1], n[i]] = [n[i], n[i - 1]]; onChange(n); }} className="text-ink-soft hover:text-ink disabled:invisible">
              Posunout výš
            </button>
            <button type="button" onClick={() => onChange(items.filter((_, j) => j !== i))} className="text-ink-soft hover:text-danger">
              Odebrat
            </button>
          </div>
        </div>
      ))}
      <button type="button" onClick={() => onChange([...items, empty()])} className="self-start rounded-full border border-dashed border-ink-soft/40 px-4 py-2 text-sm hover:border-eucalyptus hover:text-eucalyptus-deep">
        {addLabel}
      </button>
    </div>
  );
}
