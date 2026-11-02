"use client";

import { useEffect, useRef, useState } from "react";

export type PickerGuest = { id: string; name: string; detail?: string | null; elsewhere?: boolean };

/**
 * Okno nad místem (židle, lůžko): kdo tu je, výměna, uvolnění a výběr hosta s hledáním.
 * Pozice je vůči nejbližšímu relativně umístěnému rodiči; okno se nevysune mimo něj.
 */
export function GuestPickerPopover({
  left,
  top,
  title,
  occupant,
  candidates,
  canEdit,
  elsewhereLabel,
  onPick,
  onFree,
  onClose,
}: {
  left: number;
  top: number;
  title: string;
  occupant: { id: string; name: string; detail?: string | null } | null;
  candidates: PickerGuest[];
  canEdit: boolean;
  elsewhereLabel: string;
  onPick: (guestId: string) => void;
  onFree: (guestId: string) => void;
  onClose: () => void;
}) {
  const [choosing, setChoosing] = useState(!occupant);
  const [query, setQuery] = useState("");
  const box = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left, top });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    const onDown = (e: PointerEvent) => box.current && !box.current.contains(e.target as Node) && onClose();
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onDown);
    };
  }, [onClose]);

  useEffect(() => {
    const el = box.current;
    const parent = el?.offsetParent as HTMLElement | null;
    if (!el || !parent) return;
    const w = el.offsetWidth;
    const nextLeft = Math.max(w / 2 + 8, Math.min(left, parent.clientWidth - w / 2 - 8));
    setPos({ left: nextLeft, top });
  }, [left, top, choosing]);

  const needle = query.trim().toLowerCase();
  const match = (g: PickerGuest) => !needle || g.name.toLowerCase().includes(needle) || (g.detail ?? "").toLowerCase().includes(needle);
  const free = candidates.filter((g) => !g.elsewhere && match(g));
  const elsewhere = candidates.filter((g) => g.elsewhere && g.id !== occupant?.id && match(g));

  return (
    <div
      ref={box}
      role="dialog"
      aria-label={title}
      style={{ left: pos.left, top: pos.top }}
      className="absolute z-30 flex w-72 -translate-x-1/2 flex-col gap-3 rounded-2xl border border-line bg-surface p-4 shadow-[0_16px_40px_-12px_rgba(30,43,38,0.35)]"
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-medium">{title}</h3>
        <button type="button" onClick={onClose} aria-label="Zavřít" className="size-8 rounded-full text-lg text-ink-soft hover:bg-paper hover:text-ink">
          ×
        </button>
      </div>

      {occupant ? (
        <div className="flex flex-col gap-2 rounded-xl bg-paper px-3 py-2.5">
          <span className="font-medium">{occupant.name}</span>
          {occupant.detail ? <span className="text-sm text-ink-soft">{occupant.detail}</span> : null}
          {canEdit && !choosing ? (
            <div className="flex gap-2 pt-1">
              <button type="button" onClick={() => setChoosing(true)} className="h-9 flex-1 rounded-full bg-eucalyptus text-sm font-medium text-white hover:bg-eucalyptus-deep">
                Vyměnit hosta
              </button>
              <button type="button" onClick={() => onFree(occupant.id)} className="h-9 flex-1 rounded-full border border-line text-sm font-medium hover:border-danger hover:text-danger">
                Uvolnit místo
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      {canEdit && choosing ? (
        <div className="flex min-h-0 flex-col gap-2">
          <input
            autoFocus
            type="search"
            placeholder="Najít hosta"
            aria-label="Najít hosta"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-10 rounded-lg border border-line bg-surface px-3 text-[15px] focus:border-eucalyptus focus:outline-none"
          />
          <ul className="flex max-h-64 flex-col overflow-y-auto">
            {free.map((g) => (
              <li key={g.id}>
                <button type="button" onClick={() => onPick(g.id)} className="flex w-full flex-col rounded-lg px-2.5 py-2 text-left hover:bg-eucalyptus-mist">
                  <span className="text-[15px]">{g.name}</span>
                  {g.detail ? <span className="text-xs text-ink-soft">{g.detail}</span> : null}
                </button>
              </li>
            ))}
            {elsewhere.length ? <li className="px-2.5 pb-1 pt-3 text-xs text-ink-soft">{elsewhereLabel}</li> : null}
            {elsewhere.map((g) => (
              <li key={g.id}>
                <button type="button" onClick={() => onPick(g.id)} className="flex w-full flex-col rounded-lg px-2.5 py-2 text-left text-ink-soft hover:bg-eucalyptus-mist hover:text-ink">
                  <span className="text-[15px]">{g.name}</span>
                  {g.detail ? <span className="text-xs">{g.detail}</span> : null}
                </button>
              </li>
            ))}
            {free.length === 0 && elsewhere.length === 0 ? <li className="px-2.5 py-2 text-sm text-ink-soft">Nikdo neodpovídá hledání.</li> : null}
          </ul>
        </div>
      ) : null}
      {!canEdit && !occupant ? <p className="text-sm text-ink-soft">Místo je volné.</p> : null}
    </div>
  );
}
