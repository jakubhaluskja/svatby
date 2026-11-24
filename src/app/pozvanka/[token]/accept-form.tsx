"use client";

import { useActionState } from "react";
import { FormMessage } from "@/components/ui";
import { acceptInvite } from "./actions";

export function AcceptForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(acceptInvite.bind(null, token), {});
  return (
    <form action={action} className="flex flex-col gap-3">
      <button type="submit" disabled={pending} className="h-11 rounded-full bg-eucalyptus px-6 font-medium text-white hover:bg-eucalyptus-deep disabled:opacity-50">
        {pending ? "Přijímám…" : "Přijmout pozvánku"}
      </button>
      {state.error ? <FormMessage>{state.error}</FormMessage> : null}
    </form>
  );
}
