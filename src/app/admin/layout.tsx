import Link from "next/link";
import { Icon } from "@/components/icons";
import { Wordmark } from "@/components/ui";
import { requireAdmin } from "@/lib/admin";
import { signOut } from "../(auth)/actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Administrace platformy", robots: { index: false } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();
  return (
    <div className="min-h-svh">
      <header className="sticky top-0 z-30 border-b border-line bg-ink text-white">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-4 px-4 sm:px-6">
          <Link href="/admin" className="flex items-center gap-2">
            <span className="grid size-8 place-items-center rounded-full bg-white/10">
              <Icon n="shield" className="size-4" />
            </span>
            <Wordmark className="!text-white" />
            <span className="hidden text-sm text-white/60 sm:inline">· administrace</span>
          </Link>
          <nav className="ml-auto flex items-center gap-1 text-sm">
            <Link href="/admin" className="rounded-full px-3 py-1.5 text-white/80 hover:bg-white/10 hover:text-white">
              Klienti
            </Link>
            <Link href="/app" className="rounded-full px-3 py-1.5 text-white/80 hover:bg-white/10 hover:text-white">
              Moje svatba
            </Link>
            <span className="hidden px-2 text-white/50 md:inline">{admin.email}</span>
            <form action={signOut}>
              <button type="submit" title="Odhlásit se" aria-label="Odhlásit se" className="grid size-9 place-items-center rounded-full text-white/80 hover:bg-white/10">
                <Icon n="logout" />
              </button>
            </form>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}
