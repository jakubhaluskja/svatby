import Link from "next/link";
import { Wordmark } from "@/components/ui";
import { requireUser } from "@/lib/wedding";
import { signOut } from "../(auth)/actions";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return (
    <div className="flex min-h-svh flex-col">
      <header className="flex h-16 items-center justify-between border-b border-line bg-surface px-6 sm:px-10">
        <Link href="/app">
          <Wordmark />
        </Link>
        <div className="flex items-center gap-4 text-sm">
          <span className="hidden text-ink-soft sm:inline">{user.email}</span>
          <form action={signOut}>
            <button type="submit" className="text-ink-soft underline-offset-2 hover:text-ink hover:underline">
              Odhlásit se
            </button>
          </form>
        </div>
      </header>
      <div className="flex-1">{children}</div>
    </div>
  );
}
