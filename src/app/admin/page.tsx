import Link from "next/link";
import { Icon } from "@/components/icons";
import { Card, Eyebrow } from "@/components/ui";
import { PACKAGE_LABEL, REASON_LABEL, STATUS_LABEL, requireAdmin } from "@/lib/admin";
import { createClient } from "@/lib/supabase/server";

export type ClientRow = {
  id: string;
  slug: string;
  partner1_name: string;
  partner2_name: string;
  wedding_date: string | null;
  status: string;
  package: string;
  published_free: boolean;
  web_expires_at: string | null;
  suspended_at: string | null;
  suspended_reason: string | null;
  created_at: string;
  owner_id: string | null;
  owner_email: string | null;
  owner_name: string | null;
  last_sign_in_at: string | null;
  households: number;
  guests: number;
  members: number;
};

const FILTERS = [
  { key: "vse", label: "Všichni" },
  { key: "aktivni", label: "Aktivní" },
  { key: "zverejnene", label: "Zveřejněný web" },
  { key: "pozastavene", label: "Pozastavení" },
] as const;
type Filter = (typeof FILTERS)[number]["key"];

const dateFmt = new Intl.DateTimeFormat("cs-CZ", { day: "numeric", month: "numeric", year: "numeric", timeZone: "Europe/Prague" });
const fmt = (v: string | null) => (v ? dateFmt.format(new Date(v.length === 10 ? `${v}T12:00:00Z` : v)) : "–");

function norm(s: string) {
  return s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

type Props = { searchParams: Promise<{ q?: string; stav?: string }> };

export default async function AdminClients({ searchParams }: Props) {
  await requireAdmin();
  const { q = "", stav } = await searchParams;
  const filter: Filter = FILTERS.some((f) => f.key === stav) ? (stav as Filter) : "vse";
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_clients");
  const all = (data ?? []) as ClientRow[];

  const monthAgo = Date.now() - 30 * 86_400_000;
  const stats = [
    { label: "Klientů celkem", value: all.length },
    { label: "Aktivních", value: all.filter((c) => !c.suspended_at).length },
    { label: "Zveřejněných webů", value: all.filter((c) => c.status === "published" && !c.suspended_at).length },
    { label: "Nových za 30 dní", value: all.filter((c) => Date.parse(c.created_at) > monthAgo).length },
  ];

  const needle = norm(q.trim());
  const rows = all.filter((c) => {
    if (filter === "aktivni" && c.suspended_at) return false;
    if (filter === "pozastavene" && !c.suspended_at) return false;
    if (filter === "zverejnene" && (c.status !== "published" || c.suspended_at)) return false;
    if (!needle) return true;
    return norm(`${c.partner1_name} ${c.partner2_name} ${c.slug} ${c.owner_email ?? ""} ${c.owner_name ?? ""}`).includes(needle);
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Eyebrow>Administrace platformy</Eyebrow>
        <h1 className="mt-1 font-serif text-3xl">Klienti</h1>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label} className="px-5 py-4">
            <p className="text-sm text-ink-soft">{s.label}</p>
            <p className="mt-1 font-serif text-3xl tabular-nums">{s.value}</p>
          </Card>
        ))}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex flex-wrap gap-1 rounded-full bg-surface p-1 ring-1 ring-line/70">
          {FILTERS.map((f) => (
            <Link
              key={f.key}
              href={{ pathname: "/admin", query: { ...(q ? { q } : {}), ...(f.key === "vse" ? {} : { stav: f.key }) } }}
              className={`rounded-full px-3.5 py-1.5 text-sm ${filter === f.key ? "bg-ink text-white" : "text-ink-soft hover:text-ink"}`}
            >
              {f.label}
            </Link>
          ))}
        </div>
        <form className="relative sm:ml-auto sm:w-80" action="/admin">
          {filter !== "vse" ? <input type="hidden" name="stav" value={filter} /> : null}
          <Icon n="search" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-soft" />
          <input
            name="q"
            defaultValue={q}
            placeholder="Hledat jméno, e-mail, adresu webu"
            className="h-10 w-full rounded-full border border-line bg-surface pr-4 pl-9 text-[15px] focus:border-eucalyptus focus:outline-none"
          />
        </form>
      </div>

      {error ? <p className="text-danger">Seznam klientů se nepodařilo načíst.</p> : null}

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead className="border-b border-line bg-paper/60 text-xs uppercase tracking-wider text-ink-soft">
              <tr>
                <th className="px-5 py-3 font-semibold">Svatba</th>
                <th className="px-3 py-3 font-semibold">Vlastník</th>
                <th className="px-3 py-3 font-semibold">Datum svatby</th>
                <th className="px-3 py-3 font-semibold">Web</th>
                <th className="px-3 py-3 text-right font-semibold">Hosté</th>
                <th className="px-3 py-3 font-semibold">Poslední přihlášení</th>
                <th className="px-5 py-3 font-semibold">Založeno</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line/70">
              {rows.map((c) => (
                <tr key={c.id} className="group hover:bg-paper/50">
                  <td className="px-5 py-3">
                    <Link href={`/admin/klient/${c.id}`} className="font-medium text-ink group-hover:text-eucalyptus-deep">
                      {c.partner1_name} & {c.partner2_name}
                    </Link>
                    <p className="text-xs text-ink-soft">{c.slug}</p>
                  </td>
                  <td className="px-3 py-3">
                    <p className="max-w-56 truncate">{c.owner_name || "–"}</p>
                    <p className="max-w-56 truncate text-xs text-ink-soft">{c.owner_email ?? "bez vlastníka"}</p>
                  </td>
                  <td className="px-3 py-3 tabular-nums">{fmt(c.wedding_date)}</td>
                  <td className="px-3 py-3">
                    {c.suspended_at ? (
                      <span className="rounded-full bg-danger/10 px-2.5 py-0.5 text-xs font-medium text-danger">
                        Pozastaveno · {REASON_LABEL[c.suspended_reason ?? "other"]}
                      </span>
                    ) : (
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${c.status === "published" ? "bg-eucalyptus-mist text-eucalyptus-deep" : "bg-paper text-ink-soft"}`}>
                        {STATUS_LABEL[c.status] ?? c.status}
                        {c.status === "published" ? (c.published_free ? " · zdarma" : ` · ${PACKAGE_LABEL[c.package]}`) : ""}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums">{c.guests}</td>
                  <td className="px-3 py-3 tabular-nums text-ink-soft">{fmt(c.last_sign_in_at)}</td>
                  <td className="px-5 py-3 tabular-nums text-ink-soft">{fmt(c.created_at)}</td>
                </tr>
              ))}
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-ink-soft">
                    Žádný klient neodpovídá hledání.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
