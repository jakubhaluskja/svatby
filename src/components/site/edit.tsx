"use client";

import Image from "next/image";
import { createContext, useContext, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import type { Locale } from "@/lib/i18n";
import { photoUrl } from "@/lib/media";
import { escapeHtml, richToPlain, sanitizeRich } from "@/lib/rich-text";
import { lt, type LText, type Section, type SectionType } from "@/lib/site-sections";

/** Kontext úprav webu. Na veřejném webu je editing=false a vše se jen zobrazí. */
export type EditApi = {
  editing: boolean;
  locale: Locale;
  update: (type: SectionType, patch: Record<string, unknown>) => void;
  upload: (file: File) => Promise<string | null>;
  sectionControls?: (s: Section) => ReactNode;
};

const Ctx = createContext<EditApi>({ editing: false, locale: "cs", update: () => {}, upload: async () => null });
export const EditProvider = Ctx.Provider;
export const useEdit = () => useContext(Ctx);

const useIso = typeof window === "undefined" ? useEffect : useLayoutEffect;

/** Je v textu něco vidět? */
export function hasText(v: LText | undefined, locale: Locale) {
  return richToPlain(lt(v, locale)).trim().length > 0;
}

/** Bohatý text (odstavce, tučné, kurzíva, odkazy). */
export function RichText({
  type,
  field,
  value,
  onValue,
  className = "",
  style,
  placeholder = "Napište text…",
}: {
  type?: SectionType;
  field?: string;
  value: LText | undefined;
  /** Vlastní zápis (položky seznamů); jinak se zapíše do sekce type.field */
  onValue?: (v: LText) => void;
  className?: string;
  style?: CSSProperties;
  placeholder?: string;
}) {
  const { editing, locale, update } = useEdit();
  const html = sanitizeRich(lt(value, locale));
  if (!editing) {
    if (!html) return null;
    return <div className={`site-rich ${className}`} style={style} dangerouslySetInnerHTML={{ __html: html }} />;
  }
  const write = (next: string) => {
    const v = { cs: value?.cs ?? "", en: value?.en ?? "", [locale]: next } as LText;
    if (onValue) onValue(v);
    else if (type && field) update(type, { [field]: v });
  };
  return <RichEditor key={locale} initial={value?.[locale] ? html : ""} onChange={write} className={className} style={style} placeholder={placeholder} />;
}

function RichEditor({ initial, onChange, className, style, placeholder }: { initial: string; onChange: (html: string) => void; className: string; style?: CSSProperties; placeholder: string }) {
  const el = useRef<HTMLDivElement>(null);
  const [focused, setFocused] = useState(false);
  const [linking, setLinking] = useState<string | null>(null);
  const saved = useRef<Range | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useIso(() => {
    if (el.current) el.current.innerHTML = initial;
    // jen při připojení: další změny řídí uživatel
  }, []);
  const emit = (now = false) => {
    if (timer.current) clearTimeout(timer.current);
    const run = () => el.current && onChange(sanitizeRich(el.current.innerHTML));
    if (now) run();
    else timer.current = setTimeout(run, 400);
  };
  const cmd = (name: string, arg?: string) => {
    el.current?.focus();
    if (saved.current) {
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(saved.current);
    }
    document.execCommand(name, false, arg);
    emit();
  };
  return (
    <div className="relative">
      <div
        ref={el}
        contentEditable
        suppressContentEditableWarning
        data-placeholder={placeholder}
        onFocus={() => setFocused(true)}
        onBlur={() => {
          emit(true);
          setTimeout(() => setFocused(false), 150);
        }}
        onInput={() => emit()}
        onKeyUp={() => {
          const sel = window.getSelection();
          if (sel && sel.rangeCount) saved.current = sel.getRangeAt(0).cloneRange();
        }}
        onMouseUp={() => {
          const sel = window.getSelection();
          if (sel && sel.rangeCount) saved.current = sel.getRangeAt(0).cloneRange();
        }}
        onPaste={(e) => {
          e.preventDefault();
          const text = e.clipboardData.getData("text/plain");
          document.execCommand("insertHTML", false, escapeHtml(text).replace(/\n/g, "<br>"));
        }}
        className={`site-rich site-editable ${className}`}
        style={style}
      />
      {focused || linking !== null ? (
        <div
          onMouseDown={(e) => e.preventDefault()}
          className="absolute left-0 top-full z-30 mt-2 flex items-center gap-0.5 rounded-xl bg-white p-1 text-[14px] text-[#1e2b26] shadow-[0_18px_40px_-12px_rgba(30,43,38,.35)] ring-1 ring-[#d9e1dc]"
          style={{ fontFamily: "var(--font-geist-sans), sans-serif", fontStyle: "normal", letterSpacing: 0, textTransform: "none" }}
        >
          {linking === null ? (
            <>
              <button type="button" onClick={() => cmd("bold")} className="grid size-8 place-items-center rounded-lg font-bold hover:bg-[#f5f7f5]" aria-label="Tučně">B</button>
              <button type="button" onClick={() => cmd("italic")} className="grid size-8 place-items-center rounded-lg italic hover:bg-[#f5f7f5]" aria-label="Kurzíva">I</button>
              <button type="button" onClick={() => setLinking("https://")} className="h-8 rounded-lg px-2.5 hover:bg-[#f5f7f5]">Odkaz</button>
              <button type="button" onClick={() => cmd("unlink")} className="h-8 rounded-lg px-2.5 text-[#4a5a53] hover:bg-[#f5f7f5]">Zrušit odkaz</button>
            </>
          ) : (
            <form
              className="flex items-center gap-1"
              onSubmit={(e) => {
                e.preventDefault();
                const href = linking.trim();
                setLinking(null);
                if (href && href !== "https://") cmd("createLink", href);
              }}
            >
              <input autoFocus value={linking} onChange={(e) => setLinking(e.target.value)} onKeyDown={(e) => e.key === "Escape" && setLinking(null)} className="h-8 w-56 rounded-lg bg-[#f5f7f5] px-2 outline-none" aria-label="Adresa odkazu" />
              <button type="submit" className="h-8 rounded-lg bg-[#1e2b26] px-3 text-white">Vložit</button>
            </form>
          )}
        </div>
      ) : null}
    </div>
  );
}

/** Jednořádkový text (nadpisy, štítky). */
export function LineText({
  type,
  field,
  value,
  fallback = "",
  onValue,
  as: Tag = "span",
  className = "",
  style,
}: {
  type?: SectionType;
  field?: string;
  value: LText | undefined;
  fallback?: string;
  onValue?: (v: LText) => void;
  as?: "span" | "h1" | "h2" | "h3" | "p";
  className?: string;
  style?: CSSProperties;
}) {
  const { editing, locale, update } = useEdit();
  const text = richToPlain(lt(value, locale)) || fallback;
  if (!editing) return text ? <Tag className={className} style={style}>{text}</Tag> : null;
  return (
    <LineEditor
      key={locale}
      Tag={Tag}
      initial={text}
      className={className}
      style={style}
      onChange={(t) => {
        const v = { cs: value?.cs ?? "", en: value?.en ?? "", [locale]: t === fallback ? "" : t } as LText;
        if (onValue) onValue(v);
        else if (type && field) update(type, { [field]: v });
      }}
    />
  );
}

function LineEditor({ Tag, initial, onChange, className, style }: { Tag: "span" | "h1" | "h2" | "h3" | "p"; initial: string; onChange: (t: string) => void; className: string; style?: CSSProperties }) {
  const el = useRef<HTMLElement>(null);
  useIso(() => {
    if (el.current) el.current.textContent = initial;
  }, []);
  const read = () => (el.current?.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 200);
  return (
    <Tag
      ref={el as never}
      contentEditable
      suppressContentEditableWarning
      onInput={() => onChange(read())}
      onBlur={() => onChange(read())}
      onKeyDown={(e: React.KeyboardEvent) => {
        if (e.key === "Enter") {
          e.preventDefault();
          (e.currentTarget as HTMLElement).blur();
        }
      }}
      onPaste={(e: React.ClipboardEvent) => {
        e.preventDefault();
        document.execCommand("insertText", false, e.clipboardData.getData("text/plain").replace(/\s+/g, " "));
      }}
      className={`site-editable ${className}`}
      style={style}
    />
  );
}

/** Prostý text bez jazyka (jméno, telefon, e-mail kontaktu). */
export function FieldText({ value, onValue, placeholder, className = "", as: Tag = "span", style }: { value: string; onValue: (v: string) => void; placeholder: string; className?: string; as?: "span" | "p" | "h3"; style?: CSSProperties }) {
  const { editing } = useEdit();
  if (!editing) return value ? <Tag className={className} style={style}>{value}</Tag> : null;
  return <PlainField Tag={Tag} initial={value} placeholder={placeholder} onChange={onValue} className={className} style={style} />;
}

function PlainField({ Tag, initial, placeholder, onChange, className, style }: { Tag: "span" | "p" | "h3"; initial: string; placeholder: string; onChange: (v: string) => void; className: string; style?: CSSProperties }) {
  const el = useRef<HTMLElement>(null);
  useIso(() => {
    if (el.current) el.current.textContent = initial;
  }, []);
  return (
    <Tag
      ref={el as never}
      contentEditable
      suppressContentEditableWarning
      data-placeholder={placeholder}
      onInput={() => onChange((el.current?.textContent ?? "").trim().slice(0, 120))}
      onKeyDown={(e: React.KeyboardEvent) => e.key === "Enter" && (e.preventDefault(), (e.currentTarget as HTMLElement).blur())}
      className={`site-editable ${className}`}
      style={style}
    />
  );
}

/** Fotka webu. V editoru jde vyměnit klepnutím, bez fotky ukáže místo pro ni. */
export function SitePhoto({
  path,
  onPath,
  className = "",
  style,
  sizes = "(min-width: 1024px) 50vw, 100vw",
  priority,
  placeholder,
  label = "fotku",
}: {
  path: string | null;
  onPath?: (p: string | null) => void;
  className?: string;
  style?: CSSProperties;
  sizes?: string;
  priority?: boolean;
  /** Vzhled prázdného místa v editoru */
  placeholder?: ReactNode;
  label?: string;
}) {
  const { editing, upload } = useEdit();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const url = photoUrl(path);
  if (!editing && !url) return null;
  const pos = className.includes("absolute") ? "" : "relative";
  return (
    <div className={`${pos} overflow-hidden ${className}`} style={style}>
      {url ? <Image src={url} alt="" fill priority={priority} sizes={sizes} className="object-cover" /> : (placeholder ?? <div className="absolute inset-0 bg-black/10" />)}
      {editing && onPath ? (
        <div className="absolute inset-x-0 bottom-3 z-10 flex justify-center gap-2" style={{ fontFamily: "var(--font-geist-sans), sans-serif", fontStyle: "normal" }}>
          <button
            type="button"
            onClick={() => input.current?.click()}
            disabled={busy}
            className="rounded-full bg-white/95 px-3.5 py-1.5 text-[13px] font-medium text-[#1e2b26] shadow-lg ring-1 ring-black/5 hover:bg-white"
          >
            {busy ? "Nahrávám…" : url ? `Vyměnit ${label}` : `Přidat ${label}`}
          </button>
          {url ? (
            <button type="button" onClick={() => onPath(null)} className="rounded-full bg-white/95 px-3 py-1.5 text-[13px] text-[#a33a2f] shadow-lg ring-1 ring-black/5">
              Odebrat
            </button>
          ) : null}
          <input
            ref={input}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            tabIndex={-1}
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              setBusy(true);
              const p = await upload(f);
              setBusy(false);
              e.target.value = "";
              if (p) onPath(p);
            }}
          />
        </div>
      ) : null}
    </div>
  );
}

/** Obal sekce: v editoru přidá ovládání (posun, skrytí). */
export function Sec({ s, children, className = "", style, id }: { s: Section; children: ReactNode; className?: string; style?: CSSProperties; id?: string }) {
  const { editing, sectionControls } = useEdit();
  return (
    <section id={id ?? s.type} data-section={s.type} className={`${editing ? "site-sec-edit group/sec relative" : ""} ${className}`} style={style}>
      {editing && sectionControls ? sectionControls(s) : null}
      {children}
    </section>
  );
}

/** Tlačítko v editoru pro přidání položky seznamu. */
export function AddButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  const { editing } = useEdit();
  if (!editing) return null;
  return (
    <button
      type="button"
      onClick={onClick}
      className="mx-auto mt-4 flex items-center gap-1.5 rounded-full border border-dashed px-4 py-2 text-[14px] opacity-80 hover:opacity-100"
      style={{ fontFamily: "var(--font-geist-sans), sans-serif", fontStyle: "normal", borderColor: "currentColor" }}
    >
      + {children}
    </button>
  );
}

/** Odstranění položky seznamu v editoru. */
export function RemoveButton({ onClick, label }: { onClick: () => void; label: string }) {
  const { editing } = useEdit();
  if (!editing) return null;
  return (
    <button type="button" onClick={onClick} aria-label={label} title={label} className="absolute -right-2 -top-2 z-10 grid size-7 place-items-center rounded-full bg-white text-[15px] text-[#a33a2f] shadow ring-1 ring-black/10">
      ×
    </button>
  );
}
