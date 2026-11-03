"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Icon, type IconName } from "@/components/icons";
import { Wordmark } from "@/components/ui";

type Item = { href: string; label: string; icon: IconName; exact?: boolean; badge?: "tasks" | "guests" };

const GROUPS: { label: string | null; items: Item[] }[] = [
  { label: null, items: [{ href: "/app", label: "Přehled", icon: "home", exact: true }] },
  {
    label: "Plánování",
    items: [
      { href: "/app/checklist", label: "Checklist", icon: "check", badge: "tasks" },
      { href: "/app/harmonogram", label: "Harmonogram", icon: "clock" },
    ],
  },
  {
    label: "Hosté",
    items: [
      { href: "/app/hoste", label: "Hosté", icon: "users", badge: "guests" },
      { href: "/app/udalosti", label: "Události", icon: "calendar" },
      { href: "/app/zasedaci-poradek", label: "Zasedací pořádek", icon: "seat" },
      { href: "/app/ubytovani", label: "Ubytování", icon: "bed" },
    ],
  },
  { label: "Pro hosty", items: [{ href: "/app/web", label: "Svatební web", icon: "globe" }] },
];

export type SidebarProps = {
  couple: string;
  dateLine: string | null;
  userName: string;
  userRole: string;
  badges: { tasks: number; guests: number };
  signOut: () => Promise<void>;
};

function NavList({ badges, onNavigate }: { badges: SidebarProps["badges"]; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Moduly" className="flex flex-col gap-5">
      {GROUPS.map((g) => (
        <div key={g.label ?? "main"} className="flex flex-col gap-0.5">
          {g.label ? <p className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-soft/70">{g.label}</p> : null}
          {g.items.map((item) => {
            const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
            const badge = item.badge ? badges[item.badge] : 0;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className={`flex h-10 items-center gap-3 rounded-xl px-3 text-[15px] transition-colors ${
                  active ? "bg-ink font-medium text-white" : "text-ink-soft hover:bg-paper hover:text-ink"
                }`}
              >
                <Icon n={item.icon} />
                {item.label}
                {badge > 0 ? (
                  <span className={`ml-auto rounded-full px-2 text-xs tabular-nums ${active ? "bg-white/15" : "bg-paper"}`}>{badge}</span>
                ) : null}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

function WeddingCard({ couple, dateLine }: Pick<SidebarProps, "couple" | "dateLine">) {
  return (
    <div className="rounded-2xl bg-eucalyptus-mist px-4 py-3.5">
      <p className="font-serif text-lg leading-tight">{couple}</p>
      <p className="mt-0.5 text-[13px] text-eucalyptus-deep">{dateLine ?? "Datum zatím nevíte"}</p>
    </div>
  );
}

function UserBox({ userName, userRole, signOut }: Pick<SidebarProps, "userName" | "userRole" | "signOut">) {
  const initials = userName
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
  return (
    <div className="flex items-center gap-3 border-t border-line px-6 py-4">
      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-plum text-sm font-medium text-white">{initials}</span>
      <span className="min-w-0 text-sm">
        <span className="block truncate font-medium">{userName}</span>
        <span className="text-ink-soft">{userRole}</span>
      </span>
      <form action={signOut} className="ml-auto">
        <button type="submit" title="Odhlásit se" aria-label="Odhlásit se" className="grid size-9 place-items-center rounded-full text-ink-soft hover:bg-paper hover:text-ink">
          <Icon n="logout" />
        </button>
      </form>
    </div>
  );
}

/** Boční menu na počítači, vysouvací menu na mobilu. */
export function Sidebar(props: SidebarProps) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const brand = (
    <Link href="/app" className="flex items-center gap-2">
      <span className="grid size-8 place-items-center rounded-full bg-eucalyptus text-white">
        <Icon n="heart" className="size-4" />
      </span>
      <Wordmark />
    </Link>
  );

  return (
    <>
      {/* mobil */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-line bg-surface/95 px-4 backdrop-blur lg:hidden print:hidden">
        {brand}
        <button type="button" onClick={() => setOpen(true)} aria-label="Otevřít menu" aria-expanded={open} className="grid size-10 place-items-center rounded-full hover:bg-paper">
          <Icon n="menu" />
        </button>
      </header>
      {open ? (
        <div className="fixed inset-0 z-40 lg:hidden print:hidden">
          <button type="button" aria-label="Zavřít menu" onClick={() => setOpen(false)} className="absolute inset-0 bg-ink/30" />
          <div className="absolute inset-y-0 left-0 flex w-[288px] max-w-[85vw] flex-col overflow-y-auto bg-surface shadow-pop">
            <div className="flex h-14 items-center justify-between px-4">
              {brand}
              <button type="button" onClick={() => setOpen(false)} aria-label="Zavřít menu" className="grid size-10 place-items-center rounded-full hover:bg-paper">
                <Icon n="close" />
              </button>
            </div>
            <div className="px-4">
              <WeddingCard couple={props.couple} dateLine={props.dateLine} />
            </div>
            <div className="mt-5 px-3 pb-6">
              <NavList badges={props.badges} onNavigate={() => setOpen(false)} />
            </div>
            <div className="mt-auto">
              <UserBox userName={props.userName} userRole={props.userRole} signOut={props.signOut} />
            </div>
          </div>
        </div>
      ) : null}

      {/* počítač */}
      <aside className="sticky top-0 hidden h-svh w-[264px] shrink-0 flex-col border-r border-line bg-surface lg:flex print:hidden">
        <div className="flex h-[72px] items-center px-6">{brand}</div>
        <div className="px-4">
          <WeddingCard couple={props.couple} dateLine={props.dateLine} />
        </div>
        <div className="mt-5 flex-1 overflow-y-auto px-3 pb-6">
          <NavList badges={props.badges} />
        </div>
        <UserBox userName={props.userName} userRole={props.userRole} signOut={props.signOut} />
      </aside>
    </>
  );
}
