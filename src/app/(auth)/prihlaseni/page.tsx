import Link from "next/link";
import { FormMessage } from "@/components/ui";
import { SignInForm } from "../forms";

export const metadata = { title: "Přihlášení" };

type Props = { searchParams: Promise<{ next?: string; chyba?: string }> };

export default async function SignInPage({ searchParams }: Props) {
  const { next, chyba } = await searchParams;
  return (
    <div className="flex flex-col gap-8">
      <h1 className="font-display text-3xl font-semibold tracking-tight">Přihlášení</h1>
      {chyba === "odkaz" ? (
        <FormMessage>Odkaz z e-mailu už neplatí nebo byl použitý. Pokud jste e-mail potvrdili, stačí se přihlásit.</FormMessage>
      ) : null}
      <SignInForm next={next} />
      <p className="text-sm text-ink-soft">
        Ještě nemáte účet?{" "}
        <Link href="/registrace" className="font-medium text-ink underline underline-offset-2">
          Zaregistrujte se
        </Link>
      </p>
    </div>
  );
}
