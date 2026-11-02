import Link from "next/link";
import { AppNav } from "@/components/app-nav";
import { Wordmark } from "@/components/ui";
import { getCurrentWedding, requireUser } from "@/lib/wedding";
import { signOut } from "../(auth)/actions";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const [user, wedding] = await Promise.all([requireUser(), getCurrentWedding()]);
  return (
    <div className="flex min-h-svh flex-col">
      <header className="border-b border-line bg-surface">
        <div className="flex h-16 items-center justify-between gap-6 px-6 sm:px-10">
          <div className="flex min-w-0 items-center gap-6">
            <Link href="/app" className="shrink-0">
              <Wordmark />
            </Link>
            {wedding ? (
              <div className="hidden min-w-0 md:block">
                <AppNav />
              </div>
            ) : null}
          </div>
          <div className="flex shrink-0 items-center gap-4 text-sm">
            <span className="hidden text-ink-soft lg:inline">{user.email}</span>
            <form action={signOut}>
              <button type="submit" className="text-ink-soft underline-offset-2 hover:text-ink hover:underline">
                Odhlásit se
              </button>
            </form>
          </div>
        </div>
        {wedding ? (
          <div className="border-t border-line px-4 py-2 md:hidden">
            <AppNav />
          </div>
        ) : null}
      </header>
      <div className="flex-1">{children}</div>
    </div>
  );
}
