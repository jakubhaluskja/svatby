"use client";

import Link from "next/link";
import { useOptimistic, useTransition } from "react";
import { CheckCircle } from "@/components/check-circle";
import { Avatar } from "@/components/ui";
import { toggleTask } from "./actions";

export function TaskItem({ id, title, due, overdue, done, assignee }: { id: string; title: string; due: string | null; overdue?: boolean; done: boolean; assignee?: string | null }) {
  const [optimisticDone, setOptimisticDone] = useOptimistic(done);
  const [, startTransition] = useTransition();

  return (
    <li className="flex items-center gap-4 rounded-xl px-4 py-3 ring-1 ring-line/70">
      <CheckCircle
        label={title}
        checked={optimisticDone}
        onChange={(value) =>
          startTransition(async () => {
            setOptimisticDone(value);
            await toggleTask(id, value);
          })
        }
      />
      <Link href={`/app/checklist?ukol=${id}`} className={`min-w-0 flex-1 truncate ${optimisticDone ? "text-ink-soft line-through" : "font-medium hover:underline"}`}>
        {title}
      </Link>
      {due ? <span className={`shrink-0 text-sm tabular-nums ${overdue && !optimisticDone ? "font-medium text-danger" : "text-ink-soft"}`}>{due}</span> : null}
      {assignee ? <Avatar name={assignee} /> : null}
    </li>
  );
}
