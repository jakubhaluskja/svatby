"use client";

import { useOptimistic, useTransition } from "react";
import type { RsvpStatus } from "@/lib/guest-data";
import { setResponse } from "../actions";

export function ResponseSelect({
  householdId,
  guestId,
  eventId,
  status,
  label,
}: {
  householdId: string;
  guestId: string;
  eventId: string;
  status: RsvpStatus;
  label: string;
}) {
  const [value, setValue] = useOptimistic(status);
  const [, start] = useTransition();
  const tone = value === "yes" ? "border-eucalyptus text-eucalyptus-deep" : value === "no" ? "border-plum/40 text-plum" : "border-line text-ink-soft";
  return (
    <select
      aria-label={label}
      value={value}
      onChange={(e) => {
        const next = e.target.value as RsvpStatus;
        start(async () => {
          setValue(next);
          await setResponse(householdId, guestId, eventId, next);
        });
      }}
      className={`h-9 rounded-full border bg-surface px-3 text-sm ${tone}`}
    >
      <option value="pending">Čeká</option>
      <option value="yes">Přijde</option>
      <option value="no">Nepřijde</option>
    </select>
  );
}
