"use client";

import { useActionState, useEffect, useMemo, useOptimistic, useState, useTransition } from "react";
import { FormMessage } from "@/components/ui";
import { daysTo, overdue, thisWeek, timeline, type ChecklistTask } from "@/lib/checklist";
import { toggleTask } from "../actions";
import { deleteTask, saveTask, type TaskFormState } from "./actions";

type Member = { id: string; name: string };
type View = "timeline" | "week" | "overdue" | "done";

const shortDate = new Intl.DateTimeFormat("cs-CZ", { day: "numeric", month: "numeric", year: "numeric", timeZone: "UTC" });
const fmt = (iso: string) => shortDate.format(new Date(`${iso}T00:00:00Z`));

function relative(due: string, today: string): { text: string; late: boolean } {
  const d = daysTo(due, today);
  if (d === 0) return { text: "dnes", late: false };
  if (d === 1) return { text: "zítra", late: false };
  if (d > 1) return { text: d < 5 ? `za ${d} dny` : d < 60 ? `za ${d} dní` : fmt(due), late: false };
  const n = -d;
  return { text: n === 1 ? "včera" : `${n} ${n < 5 ? "dny" : "dní"} po termínu`, late: true };
}

export function ChecklistView({ tasks, weddingDate, today, members, canEdit }: { tasks: ChecklistTask[]; weddingDate: string | null; today: string; members: Member[]; canEdit: boolean }) {
  const [view, setView] = useState<View>("timeline");
  const [who, setWho] = useState("");
  const [adding, setAdding] = useState(false);
  const [done, setDone] = useOptimistic(
    new Map(tasks.map((t) => [t.id, !!t.done_at])),
    (state, a: { id: string; value: boolean }) => new Map(state).set(a.id, a.value),
  );
  const [, start] = useTransition();
  const memberName = useMemo(() => new Map(members.map((m) => [m.id, m.name])), [members]);

  const withDone = tasks.map((t) => ({ ...t, done_at: done.get(t.id) ? t.done_at ?? "now" : null }));
  const filtered = withDone.filter((t) => !who || (who === "external" ? !!t.assignee_name : t.assignee_member_id === who));
  const subtasks = (id: string) => withDone.filter((t) => t.parent_id === id);
  const top = withDone.filter((t) => !t.parent_id);
  const total = top.length;
  const finished = top.filter((t) => t.done_at).length;
  const late = overdue(filtered, today);
  const week = thisWeek(filtered, today);
  const externals = [...new Set(tasks.map((t) => t.assignee_name).filter(Boolean))];

  const toggle = (id: string, value: boolean) =>
    start(async () => {
      setDone({ id, value });
      await toggleTask(id, value);
    });

  const assigneeLabel = (t: ChecklistTask) => (t.assignee_member_id ? memberName.get(t.assignee_member_id) ?? null : t.assignee_name);

  const list = (items: ChecklistTask[]) => (
    <ul className="divide-y divide-line border-y border-line">
      {items.map((t) => (
        <TaskRow
          key={t.id}
          task={t}
          subtasks={subtasks(t.id)}
          today={today}
          assignee={assigneeLabel(t)}
          members={members}
          canEdit={canEdit}
          onToggle={toggle}
        />
      ))}
    </ul>
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <div className="h-2 overflow-hidden rounded-full bg-line" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={finished} aria-label="Hotové úkoly">
          <div className="h-full rounded-full bg-eucalyptus transition-[width]" style={{ width: `${total ? (finished / total) * 100 : 0}%` }} />
        </div>
        <p className="text-sm text-ink-soft">
          Hotovo {finished} z {total}
          {late.length ? <span className="text-plum">, {late.length} po termínu</span> : null}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <nav aria-label="Pohled" className="flex flex-wrap gap-1">
          {(
            [
              ["timeline", "Časová osa"],
              ["week", `Tento týden (${week.length})`],
              ["overdue", `Po termínu (${late.length})`],
              ["done", "Hotovo"],
            ] as const
          ).map(([key, label]) => (
            <button key={key} type="button" onClick={() => setView(key)} aria-pressed={view === key} className={`rounded-full px-3.5 py-1.5 text-sm ${view === key ? "bg-ink text-white" : "text-ink-soft hover:text-ink"}`}>
              {label}
            </button>
          ))}
        </nav>
        {members.length > 1 || externals.length ? (
          <select value={who} onChange={(e) => setWho(e.target.value)} aria-label="Odpovědná osoba" className="h-9 rounded-full border border-line bg-surface px-3 text-sm">
            <option value="">Všichni</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
            {externals.length ? <option value="external">Ostatní lidé</option> : null}
          </select>
        ) : null}
        {canEdit ? (
          <button type="button" onClick={() => setAdding(true)} className="ml-auto h-10 rounded-full bg-eucalyptus px-5 text-sm font-medium text-white hover:bg-eucalyptus-deep">
            Přidat úkol
          </button>
        ) : null}
      </div>

      {adding ? <TaskForm task={null} parentId={null} members={members} defaultDate="" onDone={() => setAdding(false)} /> : null}

      {view === "timeline"
        ? timeline(filtered.filter((t) => !t.done_at), weddingDate).map((b) => (
            <section key={b.key} className="flex flex-col gap-2">
              <h2 className="font-display text-xl font-semibold tracking-tight">{b.label}</h2>
              {list(b.tasks)}
            </section>
          ))
        : null}
      {view === "timeline" && filtered.every((t) => t.done_at || t.parent_id) ? <p className="text-ink-soft">Všechny úkoly jsou hotové.</p> : null}
      {view === "week" ? (week.length ? list(week) : <p className="text-ink-soft">Tento týden nic nespěchá.</p>) : null}
      {view === "overdue" ? (late.length ? list(late) : <p className="text-ink-soft">Nic není po termínu.</p>) : null}
      {view === "done" ? (() => {
        const items = filtered.filter((t) => !t.parent_id && t.done_at);
        return items.length ? list(items) : <p className="text-ink-soft">Zatím nic hotového. První odškrtnutí potěší.</p>;
      })() : null}
    </div>
  );
}

function TaskRow({
  task,
  subtasks,
  today,
  assignee,
  members,
  canEdit,
  onToggle,
}: {
  task: ChecklistTask;
  subtasks: ChecklistTask[];
  today: string;
  assignee: string | null;
  members: Member[];
  canEdit: boolean;
  onToggle: (id: string, value: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [addingSub, setAddingSub] = useState(false);
  const [, start] = useTransition();
  const rel = task.due_date && !task.done_at ? relative(task.due_date, today) : null;
  const subDone = subtasks.filter((s) => s.done_at).length;

  if (editing) {
    return (
      <li className="py-3">
        <TaskForm task={task} parentId={task.parent_id} members={members} defaultDate={task.due_date ?? ""} onDone={() => setEditing(false)} />
      </li>
    );
  }

  return (
    <li className="flex flex-col py-3">
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          aria-label={task.title}
          checked={!!task.done_at}
          disabled={!canEdit}
          onChange={(e) => onToggle(task.id, e.target.checked)}
          className="mt-1 size-[18px] shrink-0 accent-eucalyptus"
        />
        <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="flex min-w-0 flex-1 flex-col text-left">
          <span className={task.done_at ? "text-ink-soft line-through" : ""}>{task.title}</span>
          <span className="flex flex-wrap gap-x-3 text-sm text-ink-soft">
            {rel ? <span className={rel.late ? "font-medium text-plum" : ""}>{rel.text}</span> : null}
            {task.due_date && task.done_at ? <span>{fmt(task.due_date)}</span> : null}
            {assignee ? <span>{assignee}</span> : null}
            {subtasks.length ? <span>{subDone}/{subtasks.length} kroků</span> : null}
          </span>
        </button>
      </div>
      {open ? (
        <div className="ml-[30px] mt-2 flex flex-col gap-3">
          {task.description ? <p className="whitespace-pre-line text-sm text-ink-soft">{task.description}</p> : null}
          {subtasks.length ? (
            <ul className="flex flex-col gap-1.5">
              {subtasks.map((s) => (
                <li key={s.id} className="flex items-center gap-2.5 text-sm">
                  <input type="checkbox" aria-label={s.title} checked={!!s.done_at} disabled={!canEdit} onChange={(e) => onToggle(s.id, e.target.checked)} className="size-4 accent-eucalyptus" />
                  <span className={s.done_at ? "text-ink-soft line-through" : ""}>{s.title}</span>
                  {canEdit ? (
                    <button type="button" onClick={() => start(() => deleteTask(s.id))} className="ml-auto text-xs text-ink-soft hover:text-danger">Smazat</button>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}
          {addingSub ? <TaskForm task={null} parentId={task.id} members={members} defaultDate="" compact onDone={() => setAddingSub(false)} /> : null}
          {canEdit ? (
            <div className="flex gap-4 text-sm">
              <button type="button" onClick={() => setEditing(true)} className="text-ink-soft hover:text-ink">Upravit</button>
              <button type="button" onClick={() => setAddingSub(true)} className="text-ink-soft hover:text-ink">Přidat dílčí krok</button>
              <button type="button" onClick={() => start(() => deleteTask(task.id))} className="text-ink-soft hover:text-danger">Smazat</button>
            </div>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

function TaskForm({
  task,
  parentId,
  members,
  defaultDate,
  compact,
  onDone,
}: {
  task: ChecklistTask | null;
  parentId: string | null;
  members: Member[];
  defaultDate: string;
  compact?: boolean;
  onDone: () => void;
}) {
  const [state, action, pending] = useActionState<TaskFormState, FormData>(saveTask.bind(null, task?.id ?? null, parentId), {});
  const [assignee, setAssignee] = useState(task?.assignee_member_id ? `member:${task.assignee_member_id}` : task?.assignee_name ? "external" : "");
  useEffect(() => {
    if (state.ok) onDone();
  }, [state, onDone]);
  const field = "h-10 rounded-lg border border-line bg-surface px-3 text-[15px] font-normal focus:border-eucalyptus focus:outline-none";

  return (
    <form action={action} className="flex flex-col gap-3 rounded-xl border border-eucalyptus bg-surface p-4">
      <input name="title" required maxLength={200} defaultValue={task?.title} placeholder={compact ? "Dílčí krok" : "Co je potřeba udělat"} aria-label="Úkol" className={field} autoFocus />
      {!compact ? (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="flex flex-col gap-1 text-sm font-medium">
              Termín
              <input name="due_date" type="date" defaultValue={defaultDate} className={field} />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium">
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
              <div className="grid grid-cols-2 gap-2">
                <label className="flex flex-col gap-1 text-sm font-medium">
                  Jméno
                  <input name="assignee_name" defaultValue={task?.assignee_name ?? ""} maxLength={80} className={field} />
                </label>
                <label className="flex flex-col gap-1 text-sm font-medium">
                  E-mail
                  <input name="assignee_email" type="email" defaultValue={task?.assignee_email ?? ""} maxLength={120} className={field} />
                </label>
              </div>
            ) : null}
          </div>
          <textarea name="description" rows={2} maxLength={2000} defaultValue={task?.description ?? ""} placeholder="Poznámka" aria-label="Poznámka" className={`${field} h-auto py-2`} />
        </>
      ) : null}
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
