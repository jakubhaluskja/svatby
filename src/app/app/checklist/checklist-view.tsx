"use client";

import { useActionState, useEffect, useMemo, useOptimistic, useState, useTransition } from "react";
import { CheckCircle } from "@/components/check-circle";
import { Icon } from "@/components/icons";
import { Avatar, Eyebrow, FormMessage } from "@/components/ui";
import { daysTo, overdue, TASK_CATEGORIES, thisWeek, timeline, type ChecklistTask, type TaskCategory } from "@/lib/checklist";
import { toggleTask } from "../actions";
import { deleteTask, saveTask, type TaskFormState } from "./actions";

type Member = { id: string; name: string };
type View = "all" | "week" | "overdue" | "done";

const shortDate = new Intl.DateTimeFormat("cs-CZ", { day: "numeric", month: "numeric", timeZone: "UTC" });
const longDate = new Intl.DateTimeFormat("cs-CZ", { weekday: "long", day: "numeric", month: "numeric", year: "numeric", timeZone: "UTC" });
const d = (iso: string) => new Date(`${iso}T00:00:00Z`);

function dueLabel(due: string, today: string): { text: string; late: boolean } {
  const n = daysTo(due, today);
  if (n === 0) return { text: "dnes", late: false };
  if (n === 1) return { text: "zítra", late: false };
  if (n < 0) return { text: shortDate.format(d(due)), late: true };
  return { text: shortDate.format(d(due)), late: false };
}

export function ChecklistView({
  tasks,
  weddingDate,
  today,
  members,
  canEdit,
  initialTask,
}: {
  tasks: ChecklistTask[];
  weddingDate: string | null;
  today: string;
  members: Member[];
  canEdit: boolean;
  initialTask: string | null;
}) {
  const [view, setView] = useState<View>("all");
  const [who, setWho] = useState("");
  const [cat, setCat] = useState<TaskCategory | "">("");
  const [adding, setAdding] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(initialTask);
  const [done, setDone] = useOptimistic(
    new Map(tasks.map((t) => [t.id, !!t.done_at])),
    (state, a: { id: string; value: boolean }) => new Map(state).set(a.id, a.value),
  );
  const [, start] = useTransition();
  const memberName = useMemo(() => new Map(members.map((m) => [m.id, m.name])), [members]);

  const withDone = tasks.map((t) => ({ ...t, done_at: done.get(t.id) ? t.done_at ?? "now" : null }));
  const filtered = withDone.filter((t) => (!who || (who === "external" ? !!t.assignee_name : t.assignee_member_id === who)) && (!cat || t.category === cat));
  const subtasks = (id: string) => withDone.filter((t) => t.parent_id === id);
  const top = withDone.filter((t) => !t.parent_id);
  const finished = top.filter((t) => t.done_at).length;
  const late = overdue(filtered, today);
  const week = thisWeek(filtered, today);
  const doneList = filtered.filter((t) => !t.parent_id && t.done_at);
  const externals = [...new Set(tasks.map((t) => t.assignee_name).filter(Boolean))];
  const selected = withDone.find((t) => t.id === selectedId && !t.parent_id) ?? null;
  const daysLeft = weddingDate ? daysTo(weddingDate, today) : null;

  const toggle = (id: string, value: boolean) =>
    start(async () => {
      setDone({ id, value });
      await toggleTask(id, value);
    });
  const assigneeOf = (t: ChecklistTask) => (t.assignee_member_id ? memberName.get(t.assignee_member_id) ?? null : t.assignee_name);

  const row = (t: ChecklistTask) => {
    const subs = subtasks(t.id);
    const due = t.due_date ? dueLabel(t.due_date, today) : null;
    const who = assigneeOf(t);
    const c = t.category ? TASK_CATEGORIES[t.category] : null;
    const active = t.id === selectedId;
    return (
      <li key={t.id} className={`flex items-center gap-3 rounded-2xl bg-surface px-4 py-3.5 shadow-card ring-1 transition-shadow sm:gap-4 ${active ? "ring-2 ring-eucalyptus" : "ring-line/70 hover:ring-eucalyptus/40"}`}>
        <CheckCircle label={t.title} checked={!!t.done_at} onChange={(v) => canEdit && toggle(t.id, v)} />
        <button type="button" onClick={() => setSelectedId(t.id)} className="flex min-w-0 flex-1 flex-col text-left">
          <span className={`truncate ${t.done_at ? "text-ink-soft line-through" : "font-medium"}`}>{t.title}</span>
          {subs.length ? (
            <span className="text-xs text-ink-soft">
              {subs.filter((s) => s.done_at).length}/{subs.length} podúkolů
            </span>
          ) : null}
        </button>
        {c ? (
          <span className="hidden shrink-0 rounded-md px-2 py-0.5 text-xs font-medium sm:inline" style={{ background: c.bg, color: c.fg }}>
            {c.label}
          </span>
        ) : null}
        {due && !t.done_at ? <span className={`w-12 shrink-0 text-right text-sm tabular-nums ${due.late ? "font-medium text-danger" : "text-ink-soft"}`}>{due.text}</span> : null}
        {who ? <Avatar name={who} /> : <span className="hidden size-7 sm:block" />}
      </li>
    );
  };

  const group = (key: string, label: string, items: ChecklistTask[], tone?: "danger") => (
    <section key={key} className="flex flex-col gap-2">
      <p className={`flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.16em] ${tone ? "text-danger" : "text-ink-soft/80"}`}>
        {label}
        <span className="h-px flex-1 bg-line" />
      </p>
      <ul className="flex flex-col gap-2">{items.map(row)}</ul>
    </section>
  );

  const lateIds = new Set(late.map((t) => t.id));
  const buckets = timeline(filtered.filter((t) => !t.done_at && !lateIds.has(t.id)), weddingDate);

  return (
    <div className="flex min-h-svh flex-col xl:flex-row">
      <div className="flex min-w-0 flex-1 flex-col gap-5 px-6 py-8 sm:px-10 lg:py-10">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="font-serif text-4xl tracking-tight">Checklist</h1>
            <p className="mt-2 text-sm text-ink-soft">Termíny se posouvají podle data svatby.</p>
          </div>
          {canEdit ? (
            <button type="button" onClick={() => setAdding(true)} className="inline-flex h-10 items-center gap-2 self-start rounded-full bg-ink px-4 text-sm font-medium text-white hover:bg-ink/85 sm:self-auto">
              <Icon n="plus" className="size-4" />
              Přidat úkol
            </button>
          ) : null}
        </header>

        <div className="flex flex-wrap items-center gap-2 text-sm">
          {(
            [
              ["all", "Vše", filtered.filter((t) => !t.parent_id && !t.done_at).length],
              ["week", "Tento týden", week.length],
              ["overdue", "Po termínu", late.length],
              ["done", "Hotovo", doneList.length],
            ] as const
          ).map(([key, label, n]) => (
            <button
              key={key}
              type="button"
              onClick={() => setView(key)}
              aria-pressed={view === key}
              className={`flex items-center gap-2 rounded-full px-3.5 py-1.5 ${view === key ? "bg-surface font-medium shadow-card ring-1 ring-line" : "text-ink-soft hover:text-ink"}`}
            >
              {label}
              <span className={`rounded-full px-1.5 text-xs tabular-nums ${key === "overdue" && n > 0 ? "bg-danger/10 text-danger" : "bg-paper"}`}>{n}</span>
            </button>
          ))}
          <span className="ml-auto flex flex-wrap gap-2">
            <select value={cat} onChange={(e) => setCat(e.target.value as TaskCategory | "")} aria-label="Kategorie" className="h-9 rounded-full bg-surface px-3 text-sm ring-1 ring-line">
              <option value="">Všechny kategorie</option>
              {Object.entries(TASK_CATEGORIES).map(([k, c]) => (
                <option key={k} value={k}>{c.label}</option>
              ))}
            </select>
            {members.length > 1 || externals.length ? (
              <select value={who} onChange={(e) => setWho(e.target.value)} aria-label="Kdo úkol řeší" className="h-9 rounded-full bg-surface px-3 text-sm ring-1 ring-line">
                <option value="">Řeší kdokoli</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
                {externals.length ? <option value="external">Ostatní lidé</option> : null}
              </select>
            ) : null}
          </span>
        </div>

        {adding ? <TaskForm task={null} parentId={null} members={members} onDone={() => setAdding(false)} /> : null}

        <div className="flex flex-col gap-6">
          {view === "all" ? (
            <>
              {late.length ? group("late", "Po termínu", late, "danger") : null}
              {buckets.map((b) => group(b.key, b.label, b.tasks))}
              {!late.length && !buckets.length ? <p className="text-ink-soft">Všechny úkoly jsou hotové.</p> : null}
            </>
          ) : null}
          {view === "week" ? (week.length ? group("week", "Příštích 7 dní", week) : <p className="text-ink-soft">Tento týden nic nespěchá.</p>) : null}
          {view === "overdue" ? (late.length ? group("late", "Po termínu", late, "danger") : <p className="text-ink-soft">Nic není po termínu.</p>) : null}
          {view === "done" ? (doneList.length ? group("done", "Hotové úkoly", doneList) : <p className="text-ink-soft">Zatím nic hotového. První odškrtnutí potěší.</p>) : null}
        </div>
      </div>

      {/* Souhrn a detail úkolu */}
      <aside
        className={`flex-col gap-6 border-line bg-surface px-6 py-8 sm:px-7 xl:sticky xl:top-0 xl:flex xl:h-svh xl:w-[380px] xl:shrink-0 xl:overflow-y-auto xl:border-l ${
          selected ? "fixed inset-0 z-40 flex overflow-y-auto xl:static" : "hidden"
        }`}
      >
        {selected ? (
          <button type="button" onClick={() => setSelectedId(null)} className="flex items-center gap-2 self-start text-sm text-ink-soft hover:text-ink xl:hidden">
            <Icon n="close" className="size-4" />
            Zavřít
          </button>
        ) : null}
        <div className="grid grid-cols-3 gap-3">
          <div>
            <p className="text-xs text-ink-soft">Celkem</p>
            <p className="font-display text-2xl font-semibold tabular-nums">{top.length}</p>
          </div>
          <div>
            <p className="text-xs text-ink-soft">Hotovo</p>
            <p className="font-display text-2xl font-semibold tabular-nums">{finished}</p>
          </div>
          <div>
            <p className="text-xs text-ink-soft">Do svatby</p>
            <p className="font-display text-2xl font-semibold tabular-nums">{daysLeft !== null && daysLeft >= 0 ? `${daysLeft} d` : "–"}</p>
          </div>
        </div>
        <div>
          <div className="flex justify-between text-xs text-ink-soft">
            <span>Postup</span>
            <span>{top.length ? Math.round((finished / top.length) * 100) : 0} %</span>
          </div>
          <div className="mt-1.5 h-2 rounded-full bg-paper" role="progressbar" aria-valuemin={0} aria-valuemax={top.length} aria-valuenow={finished} aria-label="Hotové úkoly">
            <div className="h-full rounded-full bg-eucalyptus transition-[width]" style={{ width: `${top.length ? (finished / top.length) * 100 : 0}%` }} />
          </div>
        </div>
        <div className="h-px bg-line" />
        {selected ? (
          <TaskDetail
            key={selected.id}
            task={selected}
            subtasks={subtasks(selected.id)}
            assignee={assigneeOf(selected)}
            members={members}
            canEdit={canEdit}
            onToggle={toggle}
            onDeleted={() => setSelectedId(null)}
          />
        ) : (
          <p className="text-sm text-ink-soft">Klikněte na úkol a uvidíte podrobnosti, podúkoly a poznámky.</p>
        )}
      </aside>
    </div>
  );
}

function TaskDetail({
  task,
  subtasks,
  assignee,
  members,
  canEdit,
  onToggle,
  onDeleted,
}: {
  task: ChecklistTask;
  subtasks: ChecklistTask[];
  assignee: string | null;
  members: Member[];
  canEdit: boolean;
  onToggle: (id: string, value: boolean) => void;
  onDeleted: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [addingSub, setAddingSub] = useState(false);
  const [, start] = useTransition();
  const c = task.category ? TASK_CATEGORIES[task.category] : null;

  if (editing) return <TaskForm task={task} parentId={task.parent_id} members={members} onDone={() => setEditing(false)} />;

  return (
    <div className="flex flex-col gap-5">
      {c ? (
        <span className="self-start rounded-md px-2 py-0.5 text-xs font-medium" style={{ background: c.bg, color: c.fg }}>
          {c.label}
        </span>
      ) : null}
      <div className="flex items-start gap-3">
        <span className="mt-1.5">
          <CheckCircle label={task.title} checked={!!task.done_at} onChange={(v) => canEdit && onToggle(task.id, v)} />
        </span>
        <h2 className={`font-serif text-[26px] leading-tight ${task.done_at ? "text-ink-soft line-through" : ""}`}>{task.title}</h2>
      </div>
      <dl className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-ink-soft">Termín</dt>
          <dd className="font-medium first-letter:uppercase">{task.due_date ? longDate.format(d(task.due_date)) : "Bez termínu"}</dd>
        </div>
        <div>
          <dt className="text-ink-soft">Řeší</dt>
          <dd className="mt-0.5 flex items-center gap-2 font-medium">
            {assignee ? (
              <>
                <Avatar name={assignee} size="sm" />
                <span className="truncate">{assignee}</span>
              </>
            ) : (
              "Nikdo konkrétní"
            )}
          </dd>
        </div>
      </dl>

      <div className="flex flex-col gap-1.5">
        <Eyebrow>Podúkoly</Eyebrow>
        {subtasks.map((s) => (
          <div key={s.id} className="group flex items-center gap-3 rounded-lg py-1.5 text-sm">
            <CheckCircle size="sm" label={s.title} checked={!!s.done_at} onChange={(v) => canEdit && onToggle(s.id, v)} />
            <span className={`flex-1 ${s.done_at ? "text-ink-soft line-through" : ""}`}>{s.title}</span>
            {canEdit ? (
              <button type="button" onClick={() => start(() => deleteTask(s.id))} aria-label={`Smazat ${s.title}`} className="text-ink-soft opacity-0 hover:text-danger group-hover:opacity-100 focus:opacity-100">
                <Icon n="close" className="size-4" />
              </button>
            ) : null}
          </div>
        ))}
        {addingSub ? <TaskForm task={null} parentId={task.id} members={members} compact onDone={() => setAddingSub(false)} /> : null}
        {canEdit && !addingSub ? (
          <button type="button" onClick={() => setAddingSub(true)} className="flex items-center gap-2 self-start py-1 text-sm text-eucalyptus-deep hover:underline">
            <Icon n="plus" className="size-4" />
            Přidat podúkol
          </button>
        ) : null}
      </div>

      {task.description ? (
        <div className="flex flex-col gap-1.5">
          <Eyebrow>Poznámka</Eyebrow>
          <p className="whitespace-pre-line rounded-xl bg-paper p-3 text-sm">{task.description}</p>
        </div>
      ) : null}

      {canEdit ? (
        <div className="flex gap-2">
          <button type="button" onClick={() => setEditing(true)} className="h-9 rounded-full bg-ink px-4 text-sm font-medium text-white hover:bg-ink/85">
            Upravit
          </button>
          <button
            type="button"
            onClick={() =>
              start(async () => {
                await deleteTask(task.id);
                onDeleted();
              })
            }
            className="h-9 rounded-full px-4 text-sm text-ink-soft ring-1 ring-line hover:text-danger"
          >
            Smazat
          </button>
        </div>
      ) : null}
    </div>
  );
}

function TaskForm({ task, parentId, members, compact, onDone }: { task: ChecklistTask | null; parentId: string | null; members: Member[]; compact?: boolean; onDone: () => void }) {
  const [state, action, pending] = useActionState<TaskFormState, FormData>(saveTask.bind(null, task?.id ?? null, parentId), {});
  const [assignee, setAssignee] = useState(task?.assignee_member_id ? `member:${task.assignee_member_id}` : task?.assignee_name ? "external" : "");
  useEffect(() => {
    if (state.ok) onDone();
  }, [state, onDone]);
  const field = "h-10 w-full rounded-lg border border-line bg-surface px-3 text-[15px] font-normal focus:border-eucalyptus focus:outline-none";
  const label = "flex flex-col gap-1 text-sm font-medium";

  return (
    <form action={action} className="flex flex-col gap-3 rounded-2xl bg-surface p-4 shadow-card ring-2 ring-eucalyptus">
      <input name="title" required maxLength={200} defaultValue={task?.title} placeholder={compact ? "Podúkol" : "Co je potřeba udělat"} aria-label="Úkol" className={field} autoFocus />
      {!compact ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className={label}>
              Termín
              <input name="due_date" type="date" defaultValue={task?.due_date ?? ""} className={field} />
            </label>
            <label className={label}>
              Kategorie
              <select name="category" defaultValue={task?.category ?? ""} className={field}>
                <option value="">Bez kategorie</option>
                {Object.entries(TASK_CATEGORIES).map(([k, c]) => (
                  <option key={k} value={k}>{c.label}</option>
                ))}
              </select>
            </label>
            <label className={`${label} sm:col-span-2`}>
              Kdo to má na starost
              <select name="assignee" value={assignee} onChange={(e) => setAssignee(e.target.value)} className={field}>
                <option value="">Nikdo konkrétní</option>
                {members.map((m) => (
                  <option key={m.id} value={`member:${m.id}`}>{m.name}</option>
                ))}
                <option value="external">Někdo jiný…</option>
              </select>
            </label>
            {assignee === "external" ? (
              <>
                <label className={label}>
                  Jméno
                  <input name="assignee_name" defaultValue={task?.assignee_name ?? ""} maxLength={80} className={field} />
                </label>
                <label className={label}>
                  E-mail
                  <input name="assignee_email" type="email" defaultValue={task?.assignee_email ?? ""} maxLength={120} className={field} />
                </label>
              </>
            ) : null}
          </div>
          <textarea name="description" rows={3} maxLength={2000} defaultValue={task?.description ?? ""} placeholder="Poznámka" aria-label="Poznámka" className={`${field} h-auto py-2`} />
        </>
      ) : null}
      {state.error ? <FormMessage>{state.error}</FormMessage> : null}
      <div className="flex gap-3">
        <button type="submit" disabled={pending} className="h-9 rounded-full bg-eucalyptus px-4 text-sm font-medium text-white hover:bg-eucalyptus-deep disabled:opacity-50">
          {pending ? "Ukládám…" : "Uložit"}
        </button>
        <button type="button" onClick={onDone} className="px-2 text-sm text-ink-soft hover:text-ink">
          Zrušit
        </button>
      </div>
    </form>
  );
}
