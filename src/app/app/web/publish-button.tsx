"use client";

import { useState, useTransition } from "react";
import { publishChanges } from "./actions";

export function PublishButton({ hasChanges }: { hasChanges: boolean }) {
  const [message, setMessage] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-col items-start gap-2 sm:items-end">
      <button
        type="button"
        disabled={pending || !hasChanges}
        onClick={() =>
          start(async () => {
            const r = await publishChanges();
            setMessage(r.ok ? "Změny jsou na webu." : r.error ?? null);
          })
        }
        className="h-11 rounded-full bg-eucalyptus px-6 font-medium text-white hover:bg-eucalyptus-deep disabled:opacity-50"
      >
        {pending ? "Zveřejňuji…" : hasChanges ? "Zveřejnit změny" : "Vše je zveřejněné"}
      </button>
      {message ? <p role="status" className="text-sm text-ink-soft">{message}</p> : null}
    </div>
  );
}
