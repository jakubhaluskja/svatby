"use client";

import { useOptimistic, useTransition } from "react";
import { toggleTask } from "./actions";

export function TaskItem({ id, title, due, done }: { id: string; title: string; due: string | null; done: boolean }) {
  const [optimisticDone, setOptimisticDone] = useOptimistic(done);
  const [, startTransition] = useTransition();

  return (
    <li className="flex items-start gap-3 py-3">
      <input
        type="checkbox"
        aria-label={title}
        checked={optimisticDone}
        onChange={(e) => {
          const value = e.target.checked;
          startTransition(async () => {
            setOptimisticDone(value);
            await toggleTask(id, value);
          });
        }}
        className="mt-0.5 size-[18px] shrink-0 accent-eucalyptus"
      />
      <span className={`flex-1 ${optimisticDone ? "text-ink-soft line-through" : ""}`}>{title}</span>
      {due ? <span className="shrink-0 text-sm tabular-nums text-ink-soft">{due}</span> : null}
    </li>
  );
}
