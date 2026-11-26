"use client";

import { useState, useTransition } from "react";
import { aiWrite, type AiKind } from "@/app/app/ai-actions";

const TONES = [
  ["warm", "Vřele"],
  ["fun", "Vtipně"],
  ["formal", "Slavnostně"],
  ["short", "Stručně"],
] as const;

/** Tlačítko „Napsat s AI“: krátké zadání → návrh textu, který se vloží do pole. */
export function AiWriter({ kind, locale = "cs", onText, placeholder }: { kind: AiKind; locale?: "cs" | "en"; onText: (text: string) => void; placeholder?: string }) {
  const [open, setOpen] = useState(false);
  const [tone, setTone] = useState<(typeof TONES)[number][0]>("warm");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="inline-flex items-center gap-1.5 self-start text-sm font-medium text-plum hover:underline">
        ✨ Napsat návrh s AI
      </button>
    );
  }
  return (
    <div className="flex flex-col gap-3 rounded-xl bg-plum/6 p-4 ring-1 ring-plum/15">
      <div className="flex flex-wrap gap-1.5">
        {TONES.map(([k, l]) => (
          <button key={k} type="button" onClick={() => setTone(k)} className={`rounded-full px-3 py-1 text-sm ${tone === k ? "bg-plum text-white" : "bg-surface text-ink-soft ring-1 ring-line"}`}>
            {l}
          </button>
        ))}
      </div>
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        rows={2}
        maxLength={1000}
        placeholder={placeholder ?? "Co chcete zmínit? (nepovinné) Např. dress code, autobus v 13:00, poznali jsme se na vodě…"}
        className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-[15px] focus:border-plum focus:outline-none"
      />
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            start(async () => {
              setError(null);
              const r = await aiWrite({ kind, tone, notes, locale });
              if (r.text) {
                onText(r.text);
                setOpen(false);
              } else setError(r.error ?? "Nepodařilo se.");
            })
          }
          className="h-9 rounded-full bg-plum px-4 text-sm font-medium text-white disabled:opacity-60"
        >
          {pending ? "Píšu…" : "Napsat návrh"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="text-sm text-ink-soft hover:text-ink">
          Zavřít
        </button>
        <span className="text-xs text-ink-soft">Návrh nahradí text v poli – pak ho upravte po svém.</span>
      </div>
      {error ? <p className="text-sm text-danger">{error}</p> : null}
    </div>
  );
}
