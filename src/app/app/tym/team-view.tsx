"use client";

import { useState, useTransition } from "react";
import { Icon } from "@/components/icons";
import { FormMessage } from "@/components/ui";
import { LEVEL_LABEL, PRESETS, summarize, TEAM_MODULES, type Level, type Permissions } from "@/lib/team";
import { inviteMember, removeMember, resendInvite, updateMember, type TeamResult } from "./actions";

export type Member = {
  id: string;
  role: "owner" | "partner" | "coorganizer";
  name: string | null;
  email: string | null;
  me: boolean;
  accepted: boolean;
  expired: boolean;
  permissions: Permissions;
  contributorId: string | null;
  link: string | null;
};
type Contributor = { id: string; name: string };

const ROLE: Record<Member["role"], string> = { owner: "Novomanžel/ka", partner: "Novomanžel/ka", coorganizer: "Spoluorganizátor" };
const field = "h-10 w-full rounded-lg border border-line bg-surface px-3 text-[15px] focus:border-eucalyptus focus:outline-none";

function initials(m: Member) {
  return (m.name ?? m.email ?? "?")
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
}

function PermissionEditor({
  value,
  onChange,
  contributorId,
  onContributor,
  contributors,
}: {
  value: Permissions;
  onChange: (p: Permissions) => void;
  contributorId: string;
  onContributor: (id: string) => void;
  contributors: Contributor[];
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {PRESETS.map((p) => (
          <button
            key={p.key}
            type="button"
            title={p.hint}
            onClick={() => onChange(p.permissions)}
            className="rounded-full border border-line px-3 py-1 text-sm hover:border-eucalyptus hover:text-eucalyptus-deep"
          >
            {p.label}
          </button>
        ))}
      </div>
      <div className="divide-y divide-line/70 rounded-xl ring-1 ring-line/70">
        {TEAM_MODULES.map((m) => {
          const levels: Level[] = m.key === "budget" ? ["none", "read", "own", "write"] : ["none", "read", "write"];
          const current = value[m.key] ?? "none";
          return (
            <div key={m.key} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5">
              <span className="min-w-44 flex-1 text-[15px]">{m.label}</span>
              <div className="flex flex-wrap gap-1 rounded-full bg-paper p-0.5 text-[13px]" role="radiogroup" aria-label={m.label}>
                {levels.map((l) => (
                  <button
                    key={l}
                    type="button"
                    role="radio"
                    aria-checked={current === l}
                    onClick={() => onChange({ ...value, [m.key]: l })}
                    className={`rounded-full px-2.5 py-1 ${current === l ? (l === "none" ? "bg-surface font-medium text-ink shadow-card" : "bg-eucalyptus font-medium text-white") : "text-ink-soft hover:text-ink"}`}
                  >
                    {LEVEL_LABEL[l]}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      {value.budget === "own" ? (
        <label className="flex flex-col gap-1 text-sm font-medium">
          Čí příspěvek v rozpočtu uvidí
          {contributors.length ? (
            <select value={contributorId} onChange={(e) => onContributor(e.target.value)} className={field}>
              <option value="">Vyberte přispěvatele…</option>
              {contributors.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          ) : (
            <span className="font-normal text-ink-soft">Nejdřív přidejte přispěvatele v Rozpočtu (záložka Přispěvatelé).</span>
          )}
        </label>
      ) : null}
    </div>
  );
}

function CopyLink({ link }: { link: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard.writeText(link).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1800);
        });
      }}
      className="inline-flex items-center gap-1.5 text-sm text-eucalyptus-deep hover:underline"
    >
      <Icon n="link" className="size-4" />
      {copied ? "Zkopírováno" : "Kopírovat odkaz"}
    </button>
  );
}

function SentNote({ r }: { r: TeamResult }) {
  if (r.error) return <FormMessage>{r.error}</FormMessage>;
  if (!r.ok) return null;
  return (
    <FormMessage tone="info">
      {r.emailed ? "Pozvánka odešla e-mailem. " : "E-mail se teď neodeslal – pošlete odkaz sami (e-mailem, zprávou). "}
      {r.link ? <CopyLink link={r.link} /> : null}
    </FormMessage>
  );
}

function MemberRow({ m, manage, contributors }: { m: Member; manage: boolean; contributors: Contributor[] }) {
  const [editing, setEditing] = useState(false);
  const [perm, setPerm] = useState<Permissions>(m.permissions);
  const [contrib, setContrib] = useState(m.contributorId ?? "");
  const [name, setName] = useState(m.name ?? "");
  const [result, setResult] = useState<TeamResult>({});
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [pending, start] = useTransition();
  const couple = m.role !== "coorganizer";

  return (
    <li className="flex flex-col gap-3 px-5 py-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className={`grid size-10 shrink-0 place-items-center rounded-full text-sm font-medium ${couple ? "bg-plum text-white" : "bg-eucalyptus-mist text-eucalyptus-deep"}`}>
          {initials(m)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">
            {m.name ?? m.email}
            {m.me ? <span className="font-normal text-ink-soft"> (vy)</span> : null}
          </p>
          <p className="truncate text-sm text-ink-soft">
            {m.name ? `${m.email} · ` : ""}
            {ROLE[m.role]}
            {!m.accepted ? (m.expired ? " · pozvánka vypršela" : " · čeká na přijetí") : ""}
          </p>
          {!couple ? <p className="mt-0.5 text-sm text-ink-soft">Přístup: {summarize(m.permissions)}</p> : null}
        </div>
        {manage && !m.me && m.role !== "owner" ? (
          <div className="flex flex-wrap items-center gap-3 text-sm">
            {!couple ? (
              <button type="button" onClick={() => setEditing((v) => !v)} className="text-eucalyptus-deep hover:underline">
                {editing ? "Zavřít" : "Upravit přístup"}
              </button>
            ) : null}
            {confirmRemove ? (
              <span className="flex items-center gap-2">
                {m.accepted ? "Odebrat z týmu?" : "Zrušit pozvánku?"}
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => start(async () => setResult(await removeMember(m.id)))}
                  className="rounded-full bg-danger px-3 py-1 font-medium text-white disabled:opacity-50"
                >
                  Ano
                </button>
                <button type="button" onClick={() => setConfirmRemove(false)} className="text-ink-soft underline">
                  Ne
                </button>
              </span>
            ) : (
              <button type="button" onClick={() => setConfirmRemove(true)} className="text-ink-soft hover:text-danger">
                {m.accepted ? "Odebrat" : "Zrušit pozvánku"}
              </button>
            )}
          </div>
        ) : null}
      </div>

      {manage && !m.accepted ? (
        <div className="flex flex-wrap items-center gap-4 pl-[52px] text-sm">
          {m.link && !m.expired ? <CopyLink link={m.link} /> : null}
          <button
            type="button"
            disabled={pending}
            onClick={() => start(async () => setResult(await resendInvite(m.id)))}
            className="inline-flex items-center gap-1.5 text-eucalyptus-deep hover:underline disabled:opacity-50"
          >
            <Icon n="send" className="size-4" />
            {m.expired ? "Obnovit a poslat znovu" : "Poslat znovu"}
          </button>
        </div>
      ) : null}

      {editing ? (
        <div className="flex flex-col gap-4 pl-0 sm:pl-[52px]">
          <label className="flex flex-col gap-1 text-sm font-medium">
            Jméno
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} className={field} />
          </label>
          <PermissionEditor value={perm} onChange={setPerm} contributorId={contrib} onContributor={setContrib} contributors={contributors} />
          <div>
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const r = await updateMember(m.id, { name, permissions: perm, contributor_id: contrib });
                  setResult(r.ok ? {} : r);
                  if (r.ok) setEditing(false);
                })
              }
              className="h-10 rounded-full bg-ink px-5 text-sm font-medium text-white hover:bg-ink/85 disabled:opacity-50"
            >
              {pending ? "Ukládám…" : "Uložit přístup"}
            </button>
          </div>
        </div>
      ) : null}
      {result.error || result.ok ? (
        <div className="sm:pl-[52px]">
          <SentNote r={result} />
        </div>
      ) : null}
    </li>
  );
}

function InviteForm({ contributors, hasPartner, emailOn }: { contributors: Contributor[]; hasPartner: boolean; emailOn: boolean }) {
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState<"partner" | "coorganizer">(hasPartner ? "coorganizer" : "partner");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [perm, setPerm] = useState<Permissions>(PRESETS[0].permissions);
  const [contrib, setContrib] = useState("");
  const [result, setResult] = useState<TeamResult>({});
  const [pending, start] = useTransition();

  if (!open) {
    return (
      <div className="flex flex-col gap-3">
        <button
          type="button"
          onClick={() => {
            setOpen(true);
            setResult({});
          }}
          className="inline-flex h-11 items-center gap-2 self-start rounded-full bg-eucalyptus px-5 font-medium text-white hover:bg-eucalyptus-deep"
        >
          <Icon n="plus" className="size-4" />
          Pozvat do týmu
        </button>
        <SentNote r={result} />
      </div>
    );
  }

  return (
    <form
      className="flex flex-col gap-5 rounded-2xl bg-surface p-5 shadow-card ring-1 ring-line/70 sm:p-6"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await inviteMember({ email, name, role, permissions: perm, contributor_id: contrib });
          setResult(r);
          if (r.ok) {
            setOpen(false);
            setEmail("");
            setName("");
          }
        });
      }}
    >
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-serif text-2xl">Pozvat do týmu</h2>
        <button type="button" onClick={() => setOpen(false)} aria-label="Zavřít" className="grid size-9 place-items-center rounded-full hover:bg-paper">
          <Icon n="close" />
        </button>
      </div>

      <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Role">
        {(
          [
            ["partner", "Partner / partnerka", "Plánuje s vámi, má přístup ke všemu"],
            ["coorganizer", "Spoluorganizátor", "Pomáhá, vidí jen to, co mu povolíte"],
          ] as const
        ).map(([key, label, hint]) => (
          <button
            key={key}
            type="button"
            role="radio"
            aria-checked={role === key}
            disabled={key === "partner" && hasPartner}
            onClick={() => setRole(key)}
            className={`rounded-xl px-4 py-3 text-left ring-1 disabled:opacity-45 ${role === key ? "bg-eucalyptus-mist ring-eucalyptus" : "ring-line hover:ring-eucalyptus/60"}`}
          >
            <span className="block font-medium">{label}</span>
            <span className="block text-sm text-ink-soft">{key === "partner" && hasPartner ? "Partner už v týmu je" : hint}</span>
          </button>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm font-medium">
          E-mail
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={field} placeholder="jmeno@email.cz" />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Jméno (nepovinné)
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} className={field} placeholder="Např. Eva – svědkyně" />
        </label>
      </div>

      {role === "coorganizer" ? (
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium">Co uvidí a co může měnit</p>
          <PermissionEditor value={perm} onChange={setPerm} contributorId={contrib} onContributor={setContrib} contributors={contributors} />
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-3 border-t border-line pt-4">
        <button type="submit" disabled={pending} className="inline-flex h-10 items-center gap-2 rounded-full bg-eucalyptus px-5 text-sm font-medium text-white hover:bg-eucalyptus-deep disabled:opacity-50">
          <Icon n="send" className="size-4" />
          {pending ? "Posílám…" : emailOn ? "Poslat pozvánku" : "Vytvořit pozvánku"}
        </button>
        <span className="text-sm text-ink-soft">{emailOn ? "Přijde e-mail s odkazem, platí 30 dní." : "Odkaz pak pošlete sami – e-maily se teprve zapínají."}</span>
      </div>
      {result.error ? <FormMessage>{result.error}</FormMessage> : null}
    </form>
  );
}

export function TeamView({ members, contributors, manage, emailOn }: { members: Member[]; contributors: Contributor[]; manage: boolean; emailOn: boolean }) {
  const hasPartner = members.some((m) => m.role === "partner");
  return (
    <div className="flex flex-col gap-6">
      <section className="overflow-hidden rounded-2xl bg-surface shadow-card ring-1 ring-line/70">
        <ul className="divide-y divide-line/70">
          {members.map((m) => (
            <MemberRow key={`${m.id}-${JSON.stringify(m.permissions)}`} m={m} manage={manage} contributors={contributors} />
          ))}
        </ul>
      </section>
      {manage ? (
        <InviteForm contributors={contributors} hasPartner={hasPartner} emailOn={emailOn} />
      ) : (
        <p className="text-sm text-ink-soft">Tým spravují novomanželé. Pokud potřebujete jiný přístup, napište jim.</p>
      )}
    </div>
  );
}
