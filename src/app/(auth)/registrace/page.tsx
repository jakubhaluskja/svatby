import Link from "next/link";
import { SignUpForm } from "../forms";

export const metadata = { title: "Registrace" };

type Props = { searchParams: Promise<{ next?: string; email?: string }> };

export default async function SignUpPage({ searchParams }: Props) {
  const { next, email } = await searchParams;
  const invited = next?.startsWith("/pozvanka/");
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h1 className="font-serif text-3xl tracking-tight">Založte si účet</h1>
        <p className="text-ink-soft">
          {invited ? "Po potvrzení e-mailu vás pustíme rovnou k pozvánce do týmu svatby." : "Plánovač je zdarma. Platíte až ve chvíli, kdy web zveřejníte hostům."}
        </p>
      </div>
      <SignUpForm next={next?.startsWith("/") ? next : undefined} email={email} />
      <p className="text-sm text-ink-soft">
        Už máte účet?{" "}
        <Link href={next ? `/prihlaseni?next=${encodeURIComponent(next)}` : "/prihlaseni"} className="font-medium text-ink underline underline-offset-2">
          Přihlaste se
        </Link>
      </p>
    </div>
  );
}
