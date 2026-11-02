"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/app", label: "Přehled", exact: true },
  { href: "/app/hoste", label: "Hosté" },
  { href: "/app/udalosti", label: "Události" },
  { href: "/app/checklist", label: "Checklist" },
  { href: "/app/harmonogram", label: "Harmonogram" },
  { href: "/app/zasedaci-poradek", label: "Zasedací pořádek" },
  { href: "/app/ubytovani", label: "Ubytování" },
  { href: "/app/web", label: "Web" },
];

export function AppNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Moduly" className="flex gap-1 overflow-x-auto">
      {ITEMS.map((item) => {
        const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm transition-colors ${
              active ? "bg-eucalyptus-mist font-medium text-eucalyptus-deep" : "text-ink-soft hover:text-ink"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
