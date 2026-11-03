import { NewPasswordForm } from "../forms";

export const metadata = { title: "Nové heslo" };

export default function NewPasswordPage() {
  return (
    <div className="flex flex-col gap-8">
      <h1 className="font-serif text-3xl tracking-tight">Nastavte si nové heslo</h1>
      <NewPasswordForm />
    </div>
  );
}
