import Link from "next/link";
import { Wordmark } from "@/components/ui";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-svh max-w-3xl flex-col justify-center gap-8 px-6">
      <Wordmark />
      <h1 className="font-display text-4xl font-semibold tracking-tight sm:text-6xl">
        Svatební web, potvrzení účasti a plánovač na jednom místě
      </h1>
      <p className="max-w-xl text-lg text-ink-soft">
        Plánování je zdarma. Platíte jednou, až web zveřejníte hostům.
      </p>
      <div className="flex flex-wrap gap-3">
        <Link href="/registrace" className="inline-flex h-11 items-center rounded-full bg-eucalyptus px-6 font-medium text-white hover:bg-eucalyptus-deep">
          Založit svatbu zdarma
        </Link>
        <Link href="/prihlaseni" className="inline-flex h-11 items-center rounded-full px-6 font-medium text-ink-soft hover:bg-eucalyptus-mist hover:text-ink">
          Přihlásit se
        </Link>
      </div>
    </main>
  );
}
