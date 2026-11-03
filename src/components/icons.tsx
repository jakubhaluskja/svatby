/** Jednoduché tahové ikony aplikace (24×24). */

export type IconName = "home" | "users" | "calendar" | "check" | "clock" | "seat" | "bed" | "wallet" | "globe" | "gift" | "image" | "settings" | "plus" | "search" | "pin" | "user" | "phone" | "undo" | "redo" | "chev" | "heart" | "mail" | "link" | "menu" | "close" | "logout" | "eye" | "shop" | "drag";
const P: Record<IconName, React.ReactNode> = {
  home: <><path d="M4 11 12 4l8 7" /><path d="M6 10v9h12v-9" /></>,
  users: <><circle cx="9" cy="8.5" r="3" /><path d="M3.5 19c.8-3.2 3-4.6 5.5-4.6s4.7 1.4 5.5 4.6" /><path d="M15.5 5.8a3 3 0 0 1 0 5.4M17 14.6c1.8.5 3 1.9 3.5 4.4" /></>,
  calendar: <><rect x="4" y="5.5" width="16" height="14" rx="2" /><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4" /></>,
  check: <><rect x="4" y="4" width="16" height="16" rx="3" /><path d="m8.5 12 2.5 2.5 4.5-5" /></>,
  clock: <><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></>,
  seat: <><path d="M7 4h10v7H7z" /><path d="M5.5 11h13v3h-13zM7 14v6M17 14v6" /></>,
  bed: <><path d="M3.5 18V7M3.5 14h17v4M20.5 14v-3a3 3 0 0 0-3-3H11v6" /><circle cx="7.5" cy="10.5" r="1.8" /></>,
  wallet: <><rect x="3.5" y="6" width="17" height="13" rx="2.5" /><path d="M3.5 10h17M16 14.5h1.5" /></>,
  globe: <><circle cx="12" cy="12" r="8.5" /><path d="M3.5 12h17M12 3.5c2.5 2.6 3.5 5.4 3.5 8.5s-1 5.9-3.5 8.5c-2.5-2.6-3.5-5.4-3.5-8.5s1-5.9 3.5-8.5Z" /></>,
  gift: <><rect x="4" y="9" width="16" height="11" rx="1.5" /><path d="M3 9h18M12 9v11M12 9c-1.5-3.5-5.5-4-5.5-1.5S12 9 12 9Zm0 0c1.5-3.5 5.5-4 5.5-1.5S12 9 12 9Z" /></>,
  image: <><rect x="3.5" y="5" width="17" height="14" rx="2" /><circle cx="9" cy="10" r="1.8" /><path d="m4 17 5-4.5 4 3.5 2.5-2 4.5 3.5" /></>,
  settings: <><circle cx="12" cy="12" r="3" /><path d="M12 3.5v2.2M12 18.3v2.2M3.5 12h2.2M18.3 12h2.2M6 6l1.6 1.6M16.4 16.4 18 18M6 18l1.6-1.6M16.4 7.6 18 6" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  search: <><circle cx="11" cy="11" r="6" /><path d="m20 20-4.5-4.5" /></>,
  pin: <><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21Z" /><circle cx="12" cy="9.5" r="2.5" /></>,
  user: <><circle cx="12" cy="8" r="3.5" /><path d="M5 20c1.2-3.6 4-5 7-5s5.8 1.4 7 5" /></>,
  phone: <path d="M6.5 3.5h3l1.5 4-2 1.3a11 11 0 0 0 6.2 6.2l1.3-2 4 1.5v3a2 2 0 0 1-2.2 2A17 17 0 0 1 4.5 5.7a2 2 0 0 1 2-2.2Z" />,
  undo: <><path d="M9 7 4.5 11.5 9 16" /><path d="M5 11.5h9a5 5 0 0 1 0 10h-2" /></>,
  redo: <><path d="m15 7 4.5 4.5L15 16" /><path d="M19 11.5h-9a5 5 0 0 0 0 10h2" /></>,
  chev: <path d="m9 6 6 6-6 6" />,
  heart: <path d="M12 19.5s-7.5-4.4-7.5-10A4.2 4.2 0 0 1 12 7a4.2 4.2 0 0 1 7.5 2.5c0 5.6-7.5 10-7.5 10Z" />,
  mail: <><rect x="3.5" y="5.5" width="17" height="13" rx="2" /><path d="m4 7 8 6 8-6" /></>,
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  close: <path d="M6 6l12 12M18 6 6 18" />,
  logout: <><path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4" /><path d="M10 16l-4-4 4-4M6 12h10" /></>,
  eye: <><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" /><circle cx="12" cy="12" r="2.8" /></>,
  shop: <><path d="M4 9h16l-1 11H5L4 9Z" /><path d="M8.5 9V7a3.5 3.5 0 0 1 7 0v2" /></>,
  drag: <><circle cx="9" cy="6" r="1" /><circle cx="15" cy="6" r="1" /><circle cx="9" cy="12" r="1" /><circle cx="15" cy="12" r="1" /><circle cx="9" cy="18" r="1" /><circle cx="15" cy="18" r="1" /></>,
  link: <><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" /><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" /></>,
};
export function Icon({ n, className = "size-[18px]" }: { n: IconName; className?: string }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>{P[n]}</svg>;
}
