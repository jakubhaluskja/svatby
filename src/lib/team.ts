/** Moduly a oprávnění spoluorganizátorů (sdílené serverem i klientem). */
export type Level = "none" | "read" | "write" | "own";
export type Permissions = Partial<Record<TeamModule, Level>>;

export const TEAM_MODULES = [
  { key: "checklist", label: "Checklist a harmonogram", short: "checklist" },
  { key: "guests", label: "Hosté a události", short: "hosté" },
  { key: "seating", label: "Zasedací pořádek", short: "zasedací pořádek" },
  { key: "lodging", label: "Ubytování", short: "ubytování" },
  { key: "budget", label: "Rozpočet a dodavatelé", short: "rozpočet" },
  { key: "web", label: "Svatební web", short: "web" },
  { key: "gifts", label: "Dary", short: "dary" },
  { key: "gallery", label: "Fotogalerie", short: "fotogalerie" },
] as const;
export type TeamModule = (typeof TEAM_MODULES)[number]["key"];

export const LEVEL_LABEL: Record<Level, string> = { none: "Nevidí", read: "Jen čte", write: "Upravuje", own: "Jen svůj příspěvek" };

/** Předvolby pro rychlé pozvání. */
export const PRESETS: { key: string; label: string; hint: string; permissions: Permissions }[] = [
  {
    key: "witness",
    label: "Svědek / svědkyně",
    hint: "Pomáhá s přípravami a v den D",
    permissions: { checklist: "write", guests: "read", seating: "read", lodging: "read", budget: "none", web: "read", gifts: "read", gallery: "write" },
  },
  {
    key: "parents",
    label: "Rodiče",
    hint: "Vidí hosty a program, rozpočet jen za svůj příspěvek",
    permissions: { checklist: "read", guests: "read", seating: "read", lodging: "read", budget: "own", web: "read", gifts: "none", gallery: "write" },
  },
  {
    key: "planner",
    label: "Svatební koordinátor/ka",
    hint: "Upravuje vše kromě darů",
    permissions: { checklist: "write", guests: "write", seating: "write", lodging: "write", budget: "write", web: "write", gifts: "none", gallery: "write" },
  },
];

/** Odkaz modulu v aplikaci → modul oprávnění. */
export const PATH_MODULE: [string, TeamModule][] = [
  ["/app/checklist", "checklist"],
  ["/app/harmonogram", "checklist"],
  ["/app/rozpocet", "budget"],
  ["/app/hoste", "guests"],
  ["/app/udalosti", "guests"],
  ["/app/zasedaci-poradek", "seating"],
  ["/app/ubytovani", "lodging"],
  ["/app/web", "web"],
];

export function summarize(p: Permissions): string {
  const parts = TEAM_MODULES.filter((m) => (p[m.key] ?? "none") !== "none").map((m) => {
    const l = p[m.key]!;
    return `${m.short}${l === "read" ? " (čte)" : l === "own" ? " (svůj příspěvek)" : ""}`;
  });
  return parts.length ? parts.join(", ") : "zatím nic";
}
