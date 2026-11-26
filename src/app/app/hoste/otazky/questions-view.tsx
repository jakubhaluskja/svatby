"use client";

import { useState, useTransition } from "react";
import { Icon } from "@/components/icons";
import { FormMessage } from "@/components/ui";
import { answerLabel, type Question, type QuestionKind } from "@/lib/rsvp-questions";
import { deleteQuestion, reorderQuestions, saveQuestion, type Result } from "./actions";

type Ev = { id: string; name: string };
type A = { questionId: string; value: string; who: string };

const KIND: Record<QuestionKind, string> = { yesno: "Ano / ne", choice: "Výběr z možností", text: "Vlastní odpověď" };
const SUGGESTIONS: { label: string; kind: QuestionKind; scope: "household" | "guest"; options?: string[] }[] = [
  { label: "Pojedete svatebním autobusem?", kind: "yesno", scope: "household" },
  { label: "Hlavní chod", kind: "choice", scope: "guest", options: ["Maso", "Ryba", "Vegetariánské"] },
  { label: "Zůstanete i na večerní zábavu?", kind: "yesno", scope: "household" },
  { label: "Čím přijedete?", kind: "choice", scope: "household", options: ["Autem", "Vlakem / autobusem", "Ještě nevíme"] },
];
const field = "h-10 w-full rounded-lg border border-line bg-surface px-3 text-[15px] focus:border-eucalyptus focus:outline-none";

function Editor({ q, events, english, onClose }: { q: Partial<Question> | null; events: Ev[]; english: boolean; onClose: () => void }) {
  const [label, setLabel] = useState(q?.label ?? {});
  const [help, setHelp] = useState(q?.help ?? {});
  const [kind, setKind] = useState<QuestionKind>(q?.kind ?? "yesno");
  const [options, setOptions] = useState(q?.options?.length ? q.options : [{ id: "a1" }, { id: "a2" }]);
  const [scope, setScope] = useState(q?.scope ?? "household");
  const [required, setRequired] = useState(q?.required ?? false);
  const [onlyComing, setOnlyComing] = useState(q?.only_coming ?? true);
  const [eventId, setEventId] = useState(q?.event_id ?? "");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      className="flex flex-col gap-4 rounded-2xl bg-surface p-5 shadow-card ring-1 ring-line/70"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await saveQuestion(q?.id ?? null, { label, help, kind, options, scope, required, only_coming: onlyComing, event_id: eventId });
          if (r.ok) onClose();
          else setError(r.error ?? null);
        });
      }}
    >
      <label className="flex flex-col gap-1 text-sm font-medium">
        Otázka
        <input autoFocus required value={label.cs ?? ""} onChange={(e) => setLabel({ ...label, cs: e.target.value })} maxLength={200} className={field} placeholder="Např. Pojedete svatebním autobusem?" />
      </label>
      {english ? (
        <label className="flex flex-col gap-1 text-sm font-medium">
          Anglicky
          <input value={label.en ?? ""} onChange={(e) => setLabel({ ...label, en: e.target.value })} maxLength={200} className={field} />
        </label>
      ) : null}
      <label className="flex flex-col gap-1 text-sm font-medium">
        Vysvětlení pod otázkou (nepovinné)
        <input value={help.cs ?? ""} onChange={(e) => setHelp({ ...help, cs: e.target.value })} maxLength={200} className={field} placeholder="Např. Autobus jede v 18:00 z hlavního nádraží." />
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm font-medium">
          Typ odpovědi
          <select value={kind} onChange={(e) => setKind(e.target.value as QuestionKind)} className={field}>
            {(Object.keys(KIND) as QuestionKind[]).map((k) => (
              <option key={k} value={k}>
                {KIND[k]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Ptát se
          <select value={scope} onChange={(e) => setScope(e.target.value as "household" | "guest")} className={field}>
            <option value="household">Jednou za domácnost</option>
            <option value="guest">Každého hosta zvlášť</option>
          </select>
        </label>
      </div>

      {kind === "choice" ? (
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium">Možnosti</p>
          {options.map((o, i) => (
            <div key={o.id} className="flex items-center gap-2">
              <input
                value={o.cs ?? ""}
                onChange={(e) => setOptions(options.map((x) => (x.id === o.id ? { ...x, cs: e.target.value } : x)))}
                maxLength={80}
                placeholder={`Možnost ${i + 1}`}
                className={field}
              />
              {english ? (
                <input value={o.en ?? ""} onChange={(e) => setOptions(options.map((x) => (x.id === o.id ? { ...x, en: e.target.value } : x)))} maxLength={80} placeholder="anglicky" className={field} />
              ) : null}
              <button type="button" aria-label="Odebrat" disabled={options.length <= 2} onClick={() => setOptions(options.filter((x) => x.id !== o.id))} className="text-ink-soft hover:text-danger disabled:opacity-30">
                <Icon n="close" className="size-4" />
              </button>
            </div>
          ))}
          {options.length < 12 ? (
            <button type="button" onClick={() => setOptions([...options, { id: `o${Date.now().toString(36).slice(-8)}` }])} className="self-start text-sm text-eucalyptus-deep hover:underline">
              + Další možnost
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-col gap-2 text-sm">
        <label className="flex items-center gap-2.5">
          <input type="checkbox" checked={required} onChange={(e) => setRequired(e.target.checked)} className="size-4 accent-eucalyptus" />
          Povinná odpověď
        </label>
        <label className="flex items-center gap-2.5">
          <input type="checkbox" checked={onlyComing} onChange={(e) => setOnlyComing(e.target.checked)} className="size-4 accent-eucalyptus" />
          Ptát se jen těch, kdo přijdou
        </label>
        {events.length > 1 ? (
          <label className="flex flex-wrap items-center gap-2.5">
            Jen pro hosty pozvané na
            <select value={eventId} onChange={(e) => setEventId(e.target.value)} className="h-9 rounded-lg border border-line bg-surface px-2">
              <option value="">všechny události</option>
              {events.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>

      <div className="flex gap-3 border-t border-line pt-4">
        <button type="submit" disabled={pending} className="h-10 rounded-full bg-eucalyptus px-5 text-sm font-medium text-white hover:bg-eucalyptus-deep disabled:opacity-50">
          {pending ? "Ukládám…" : "Uložit otázku"}
        </button>
        <button type="button" onClick={onClose} className="h-10 px-3 text-sm text-ink-soft hover:text-ink">
          Zrušit
        </button>
      </div>
      {error ? <FormMessage>{error}</FormMessage> : null}
    </form>
  );
}

function Results({ q, answers }: { q: Question; answers: A[] }) {
  const mine = answers.filter((a) => a.questionId === q.id);
  if (!mine.length) return <p className="text-sm text-ink-soft">Zatím bez odpovědí.</p>;
  if (q.kind === "text") {
    return (
      <ul className="flex max-h-56 flex-col gap-1.5 overflow-y-auto text-sm">
        {mine.map((a, i) => (
          <li key={i}>
            <span className="font-medium">{a.who}:</span> {a.value}
          </li>
        ))}
      </ul>
    );
  }
  const values = q.kind === "yesno" ? ["yes", "no"] : q.options.map((o) => o.id);
  return (
    <ul className="flex flex-col gap-2 text-sm">
      {values.map((v) => {
        const who = mine.filter((a) => a.value === v);
        const pct = Math.round((who.length / mine.length) * 100);
        return (
          <li key={v} className="flex flex-col gap-1">
            <div className="flex items-center gap-3">
              <span className="w-40 shrink-0 truncate">{answerLabel(q, v)}</span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-paper">
                <div className="h-full rounded-full bg-eucalyptus" style={{ width: `${pct}%` }} />
              </div>
              <span className="w-10 text-right tabular-nums">{who.length}</span>
            </div>
            {who.length ? <p className="pl-1 text-xs text-ink-soft">{who.map((a) => a.who).join(", ")}</p> : null}
          </li>
        );
      })}
    </ul>
  );
}

export function QuestionsView({ canEdit, english, questions, events, answers }: { canEdit: boolean; english: boolean; questions: Question[]; events: Ev[]; answers: A[] }) {
  const [editing, setEditing] = useState<Partial<Question> | "new" | null>(null);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const run = (fn: () => Promise<Result>) =>
    start(async () => {
      const r = await fn();
      setError(r.error ?? null);
    });

  function move(i: number, dir: -1 | 1) {
    const ids = questions.map((q) => q.id);
    [ids[i], ids[i + dir]] = [ids[i + dir], ids[i]];
    run(() => reorderQuestions(ids));
  }

  return (
    <div className="flex flex-col gap-6">
      {questions.length ? (
        <ul className="flex flex-col gap-4">
          {questions.map((q, i) =>
            editing !== "new" && editing?.id === q.id ? (
              <li key={q.id}>
                <Editor q={q} events={events} english={english} onClose={() => setEditing(null)} />
              </li>
            ) : (
              <li key={q.id} className="flex flex-col gap-3 rounded-2xl bg-surface p-5 shadow-card ring-1 ring-line/70">
                <div className="flex flex-wrap items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">
                      {q.label.cs || q.label.en}
                      {q.required ? <span className="text-plum"> *</span> : null}
                    </p>
                    <p className="text-sm text-ink-soft">
                      {KIND[q.kind]} · {q.scope === "guest" ? "každý host" : "za domácnost"}
                      {q.only_coming ? " · jen kdo přijde" : ""}
                      {q.event_id ? ` · ${events.find((e) => e.id === q.event_id)?.name ?? ""}` : ""}
                    </p>
                  </div>
                  {canEdit ? (
                    <div className="flex items-center gap-1 text-sm">
                      <button type="button" aria-label="Výš" disabled={i === 0 || pending} onClick={() => move(i, -1)} className="grid size-8 place-items-center rounded-full text-ink-soft hover:bg-paper disabled:opacity-25">
                        <Icon n="chev" className="size-4 -rotate-90" />
                      </button>
                      <button type="button" aria-label="Níž" disabled={i === questions.length - 1 || pending} onClick={() => move(i, 1)} className="grid size-8 place-items-center rounded-full text-ink-soft hover:bg-paper disabled:opacity-25">
                        <Icon n="chev" className="size-4 rotate-90" />
                      </button>
                      <button type="button" onClick={() => setEditing(q)} className="px-2 text-eucalyptus-deep hover:underline">
                        Upravit
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (window.confirm("Smazat otázku i s odpověďmi?")) run(() => deleteQuestion(q.id));
                        }}
                        className="px-2 text-ink-soft hover:text-danger"
                      >
                        Smazat
                      </button>
                    </div>
                  ) : null}
                </div>
                <Results q={q} answers={answers} />
              </li>
            ),
          )}
        </ul>
      ) : null}
      {error ? <FormMessage>{error}</FormMessage> : null}

      {canEdit ? (
        editing === "new" || (editing && !editing.id) ? (
          <Editor q={editing === "new" ? null : editing} events={events} english={english} onClose={() => setEditing(null)} />
        ) : (
          <div className="flex flex-col gap-3">
            <button type="button" onClick={() => setEditing("new")} className="inline-flex h-11 items-center gap-2 self-start rounded-full bg-eucalyptus px-5 font-medium text-white hover:bg-eucalyptus-deep">
              <Icon n="plus" className="size-4" />
              Přidat otázku
            </button>
            {questions.length < 3 ? (
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="text-ink-soft">Inspirace:</span>
                {SUGGESTIONS.filter((s) => !questions.some((q) => q.label.cs === s.label)).map((s) => (
                  <button
                    key={s.label}
                    type="button"
                    onClick={() =>
                      setEditing({
                        label: { cs: s.label },
                        kind: s.kind,
                        scope: s.scope,
                        options: (s.options ?? []).map((o, i) => ({ id: `s${i}`, cs: o })),
                        only_coming: true,
                        required: false,
                      })
                    }
                    className="rounded-full border border-line px-3 py-1 hover:border-eucalyptus"
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        )
      ) : null}
    </div>
  );
}
