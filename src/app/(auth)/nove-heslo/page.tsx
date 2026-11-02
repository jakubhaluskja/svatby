import { NewPasswordForm } from "../forms";

export const metadata = { title: "Nové heslo" };

export default function NewPasswordPage() {
  return (
    <div className="flex flex-col gap-8">
      <h1 className="font-display text-3xl font-semibold tracking-tight">Nastavte si nové heslo</h1>
      <NewPasswordForm />
    </div>
  );
}
