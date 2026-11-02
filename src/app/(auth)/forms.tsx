"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button, Field, FormMessage } from "@/components/ui";
import {
  requestPasswordReset,
  signIn,
  signUp,
  updatePassword,
  type AuthState,
} from "./actions";

const initial: AuthState = {};

export function SignUpForm() {
  const [state, action, pending] = useActionState(signUp, initial);

  if (state.info) return <FormMessage tone="info">{state.info}</FormMessage>;

  return (
    <form action={action} className="flex flex-col gap-5">
      <Field label="Vaše jméno" name="full_name" autoComplete="name" defaultValue={state.fields?.full_name} />
      <Field label="E-mail" name="email" type="email" autoComplete="email" required defaultValue={state.fields?.email} />
      <Field
        label="Heslo"
        name="password"
        type="password"
        autoComplete="new-password"
        required
        minLength={8}
        hint="Aspoň 8 znaků."
      />
      <label className="flex items-start gap-2.5 text-sm text-ink-soft">
        <input type="checkbox" name="terms" required className="mt-0.5 size-4 accent-eucalyptus" />
        <span>
          Souhlasím s <Link href="/podminky" className="text-ink underline underline-offset-2">obchodními podmínkami</Link> a
          beru na vědomí <Link href="/soukromi" className="text-ink underline underline-offset-2">zásady ochrany osobních údajů</Link>.
        </span>
      </label>
      {state.error ? <FormMessage>{state.error}</FormMessage> : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Zakládám účet…" : "Založit účet"}
      </Button>
    </form>
  );
}

export function SignInForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState(signIn, initial);
  return (
    <form action={action} className="flex flex-col gap-5">
      <input type="hidden" name="next" value={next ?? "/app"} />
      <Field label="E-mail" name="email" type="email" autoComplete="email" required defaultValue={state.fields?.email} />
      <Field label="Heslo" name="password" type="password" autoComplete="current-password" required />
      <Link href="/zapomenute-heslo" className="-mt-2 self-end text-sm text-ink-soft underline underline-offset-2 hover:text-ink">
        Zapomenuté heslo
      </Link>
      {state.error ? <FormMessage>{state.error}</FormMessage> : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Přihlašuji…" : "Přihlásit se"}
      </Button>
    </form>
  );
}

export function ResetRequestForm() {
  const [state, action, pending] = useActionState(requestPasswordReset, initial);
  if (state.info) return <FormMessage tone="info">{state.info}</FormMessage>;
  return (
    <form action={action} className="flex flex-col gap-5">
      <Field label="E-mail" name="email" type="email" autoComplete="email" required />
      {state.error ? <FormMessage>{state.error}</FormMessage> : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Odesílám…" : "Poslat odkaz"}
      </Button>
    </form>
  );
}

export function NewPasswordForm() {
  const [state, action, pending] = useActionState(updatePassword, initial);
  return (
    <form action={action} className="flex flex-col gap-5">
      <Field label="Nové heslo" name="password" type="password" autoComplete="new-password" required minLength={8} hint="Aspoň 8 znaků." />
      {state.error ? <FormMessage>{state.error}</FormMessage> : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Ukládám…" : "Uložit heslo"}
      </Button>
    </form>
  );
}
