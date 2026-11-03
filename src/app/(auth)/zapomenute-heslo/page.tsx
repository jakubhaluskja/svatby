import { ResetRequestForm } from "../forms";

export const metadata = { title: "Zapomenuté heslo" };

export default function ForgotPasswordPage() {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h1 className="font-serif text-3xl tracking-tight">Zapomenuté heslo</h1>
        <p className="text-ink-soft">Pošleme vám odkaz, přes který si nastavíte nové.</p>
      </div>
      <ResetRequestForm />
    </div>
  );
}
