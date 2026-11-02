import Link from "next/link";
import { SignUpForm } from "../forms";

export const metadata = { title: "Registrace" };

export default function SignUpPage() {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-3xl font-semibold tracking-tight">Založte si účet</h1>
        <p className="text-ink-soft">Plánovač je zdarma. Platíte až ve chvíli, kdy web zveřejníte hostům.</p>
      </div>
      <SignUpForm />
      <p className="text-sm text-ink-soft">
        Už máte účet?{" "}
        <Link href="/prihlaseni" className="font-medium text-ink underline underline-offset-2">
          Přihlaste se
        </Link>
      </p>
    </div>
  );
}
