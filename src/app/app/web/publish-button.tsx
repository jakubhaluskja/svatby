"use client";

import { useState, useTransition } from "react";
import { publishChanges, unpublishSite } from "./actions";

export function PublishButton({ hasChanges, firstPublish = false, canHide = false }: { hasChanges: boolean; firstPublish?: boolean; canHide?: boolean }) {
  const [message, setMessage] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-col items-start gap-2 sm:items-end">
      <div className="flex flex-wrap gap-2">
        {canHide ? (
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const r = await unpublishSite();
                setMessage(r.ok ? "Web je skrytý, vidíte ho jen vy." : r.error ?? null);
              })
            }
            className="h-11 rounded-full px-5 text-[15px] font-medium text-ink-soft ring-1 ring-line hover:text-ink disabled:opacity-50"
          >
            Skrýt web
          </button>
        ) : null}
        <button
          type="button"
          disabled={pending || (!firstPublish && !hasChanges)}
          onClick={() =>
            start(async () => {
              const r = await publishChanges();
              setMessage(r.ok ? (firstPublish ? "Web je online. Hosté ho teď uvidí." : "Změny jsou na webu.") : r.error ?? null);
            })
          }
          className="h-11 rounded-full bg-eucalyptus px-6 font-medium text-white hover:bg-eucalyptus-deep disabled:opacity-50"
        >
          {pending ? "Zveřejňuji…" : firstPublish ? "Zveřejnit web" : hasChanges ? "Zveřejnit změny" : "Vše je zveřejněné"}
        </button>
      </div>
      {message ? <p role="status" className="text-sm text-ink-soft">{message}</p> : null}
    </div>
  );
}
