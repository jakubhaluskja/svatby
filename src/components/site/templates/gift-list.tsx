"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { cancelGift, pledgeGift, reserveGift, type GiftResult } from "@/app/site/[site]/actions";
import type { Locale } from "@/lib/i18n";
import { useEdit } from "../edit";
import type { GiftList as GiftListData, WebGift } from "../model";

const SANS = "var(--font-geist-sans), system-ui, sans-serif";
const LINE = "var(--site-line, color-mix(in srgb, currentColor 18%, transparent))";
const MUTED = "var(--site-muted, color-mix(in srgb, currentColor 65%, transparent))";
const ACCENT = "var(--site-accent, currentColor)";

const COPY = {
  cs: {
    reserve: "Zarezervuji",
    reserved: "Už zarezervováno",
    mineReserved: "Tento dar dáváte vy",
    cancel: "Zrušit rezervaci",
    contribute: "Přispět",
    pledged: (a: string) => `Přislíbili jste ${a}`,
    more: "Přispět znovu",
    amount: "Částka",
    confirm: "Potvrdit příspěvek",
    raised: (r: string, t: string | null) => (t ? `${r} z ${t}` : `vybráno ${r}`),
    from: "Přispěli",
    where: "Kde koupit",
    needLink: "Dar si zarezervujete nebo na něj přispějete přes osobní odkaz z pozvánky.",
    taken: "Tento dar si mezitím zarezervoval někdo jiný.",
    failed: "Nepodařilo se to. Zkuste to prosím znovu.",
    preview: "V náhledu webu nejde rezervovat.",
    closed: "Web teď není dostupný.",
    pay: "Zaplaťte prosím převodem – QR kód už obsahuje částku i zprávu:",
    message: "Zpráva pro příjemce",
    account: "Číslo účtu",
    noAccount: "Novomanželé vám řeknou, jak příspěvek předat.",
    close: "Hotovo",
    editHint: "Dary přidáte a upravíte v aplikaci v sekci Dary.",
  },
  en: {
    reserve: "I'll give this",
    reserved: "Already reserved",
    mineReserved: "You're giving this",
    cancel: "Cancel reservation",
    contribute: "Contribute",
    pledged: (a: string) => `You pledged ${a}`,
    more: "Contribute again",
    amount: "Amount",
    confirm: "Confirm contribution",
    raised: (r: string, t: string | null) => (t ? `${r} of ${t}` : `${r} raised`),
    from: "Contributed by",
    where: "Where to buy",
    needLink: "Use the personal link from your invitation to reserve a gift or contribute.",
    taken: "Someone else has just reserved this gift.",
    failed: "Something went wrong. Please try again.",
    preview: "Reservations are disabled in preview.",
    closed: "The website isn't available right now.",
    pay: "Please pay by bank transfer – the QR code already includes the amount and message:",
    message: "Message",
    account: "Account",
    noAccount: "The couple will let you know how to hand it over.",
    close: "Done",
    editHint: "Add and edit gifts in the app under Gifts.",
  },
} as const;

const money = (n: number, l: Locale) => new Intl.NumberFormat(l === "cs" ? "cs-CZ" : "en-GB", { style: "currency", currency: "CZK", maximumFractionDigits: 0 }).format(n);

function Button({ children, onClick, disabled, ghost }: { children: React.ReactNode; onClick?: () => void; disabled?: boolean; ghost?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="h-10 rounded-full px-5 text-[14px] font-medium transition-opacity hover:opacity-85 disabled:opacity-45"
      style={ghost ? { fontFamily: SANS, border: `1px solid ${LINE}` } : { fontFamily: SANS, background: ACCENT, color: "#fff" }}
    >
      {children}
    </button>
  );
}

function GiftCard({ g, data, locale, editing }: { g: WebGift; data: GiftListData; locale: Locale; editing: boolean }) {
  const c = COPY[locale];
  const router = useRouter();
  const [pending, start] = useTransition();
  const [result, setResult] = useState<GiftResult | null>(null);
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const can = !editing && !!data.site && !!data.token;
  const pct = g.target && g.raised !== null ? Math.min(100, Math.round((g.raised / g.target) * 100)) : null;

  function run(fn: () => Promise<GiftResult>) {
    start(async () => {
      const r = await fn();
      setResult(r);
      if (r.ok) router.refresh();
    });
  }

  const presets = g.price ? [g.price] : g.target ? [500, 1000, 2000, 5000].filter((v) => v <= g.target!) : [500, 1000, 2000, 5000];

  return (
    <li className="flex flex-col overflow-hidden" style={{ border: `1px solid ${LINE}`, opacity: g.kind === "item" && g.reserved && !g.mine ? 0.6 : 1 }}>
      {g.image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={g.image} alt="" className="aspect-[4/3] w-full object-cover" loading="lazy" />
      ) : null}
      <div className="flex flex-1 flex-col gap-3 p-5 text-left">
        <div className="flex flex-col gap-1">
          <h3 className="text-[1.25em] leading-tight">{g.title}</h3>
          {g.description ? <p className="whitespace-pre-line text-[0.95em]" style={{ color: MUTED }}>{g.description}</p> : null}
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[14px]" style={{ fontFamily: SANS, color: MUTED }}>
          {g.price && g.kind === "item" ? <span className="tabular-nums">{money(g.price, locale)}</span> : null}
          {g.url ? (
            <a href={g.url} target="_blank" rel="noreferrer noopener" className="underline underline-offset-2" style={{ color: ACCENT }}>
              {c.where}
            </a>
          ) : null}
        </div>

        {g.kind !== "item" && (g.raised !== null || g.target) ? (
          <div className="flex flex-col gap-1.5" style={{ fontFamily: SANS }}>
            {pct !== null ? (
              <div className="h-1.5 w-full overflow-hidden rounded-full" style={{ background: LINE }}>
                <div className="h-full rounded-full" style={{ width: `${pct}%`, background: ACCENT }} />
              </div>
            ) : null}
            {g.raised !== null ? (
              <span className="text-[13px] tabular-nums" style={{ color: MUTED }}>
                {c.raised(money(g.raised, locale), g.target ? money(g.target, locale) : null)}
              </span>
            ) : null}
          </div>
        ) : null}
        {g.contributors.length ? (
          <p className="text-[13px]" style={{ fontFamily: SANS, color: MUTED }}>
            {c.from}: {g.contributors.join(", ")}
          </p>
        ) : null}

        <div className="mt-auto flex flex-col gap-3 pt-2">
          {g.kind === "item" ? (
            g.reserved ? (
              g.mine ? (
                <div className="flex flex-wrap items-center gap-3 text-[14px]" style={{ fontFamily: SANS }}>
                  <span style={{ color: ACCENT }}>✓ {c.mineReserved}</span>
                  <button type="button" disabled={pending || !can} onClick={() => run(() => cancelGift(data.site!, data.token!, g.id))} className="underline underline-offset-2" style={{ color: MUTED }}>
                    {c.cancel}
                  </button>
                </div>
              ) : (
                <span className="text-[14px]" style={{ fontFamily: SANS, color: MUTED }}>
                  {c.reserved}
                </span>
              )
            ) : (
              <div>
                <Button disabled={pending || !can} onClick={() => run(() => reserveGift(data.site!, data.token!, g.id))}>
                  {c.reserve}
                </Button>
              </div>
            )
          ) : (
            <>
              {g.myAmount > 0 ? (
                <span className="text-[14px]" style={{ fontFamily: SANS, color: ACCENT }}>
                  ✓ {c.pledged(money(g.myAmount, locale))}
                </span>
              ) : null}
              {result?.ok && result.amount ? (
                <div className="flex flex-col gap-3 p-4 text-[14px]" style={{ fontFamily: SANS, background: "color-mix(in srgb, currentColor 5%, transparent)" }}>
                  {result.qrSvg ? (
                    <>
                      <p>{c.pay}</p>
                      <div className="w-40 bg-white p-2" dangerouslySetInnerHTML={{ __html: result.qrSvg }} />
                      <p style={{ color: MUTED }}>
                        {money(result.amount, locale)} · {c.message}: {result.message}
                      </p>
                    </>
                  ) : (
                    <p>{c.noAccount}</p>
                  )}
                  <div>
                    <Button ghost onClick={() => setResult(null)}>
                      {c.close}
                    </Button>
                  </div>
                </div>
              ) : open ? (
                <form
                  className="flex flex-col gap-3"
                  style={{ fontFamily: SANS }}
                  onSubmit={(e) => {
                    e.preventDefault();
                    run(async () => {
                      const r = await pledgeGift(data.site!, data.token!, g.id, Number(amount));
                      if (r.ok) setOpen(false);
                      return r;
                    });
                  }}
                >
                  <div className="flex flex-wrap gap-2">
                    {presets.map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setAmount(String(p))}
                        className="h-9 rounded-full px-3 text-[13px] tabular-nums"
                        style={{ border: `1px solid ${amount === String(p) ? "currentColor" : LINE}` }}
                      >
                        {money(p, locale)}
                      </button>
                    ))}
                  </div>
                  <label className="flex items-center gap-2 text-[14px]">
                    <span style={{ color: MUTED }}>{c.amount}</span>
                    <input
                      type="number"
                      inputMode="numeric"
                      min={1}
                      max={1000000}
                      required
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className="h-10 w-32 rounded-lg bg-transparent px-3 text-right tabular-nums"
                      style={{ border: `1px solid ${LINE}` }}
                    />
                    <span>Kč</span>
                  </label>
                  <div>
                    <Button disabled={pending || !amount}>{c.confirm}</Button>
                  </div>
                </form>
              ) : (
                <div>
                  <Button disabled={!can} onClick={() => setOpen(true)}>
                    {g.myAmount > 0 ? c.more : c.contribute}
                  </Button>
                </div>
              )}
            </>
          )}
          {result?.error ? (
            <p className="text-[13px]" style={{ fontFamily: SANS, color: "#b33" }}>
              {c[result.error]}
            </p>
          ) : null}
        </div>
      </div>
    </li>
  );
}

/** Seznam darů na webu – rezervace a příspěvky přes osobní odkaz domácnosti. */
export function GiftList({ data, className = "" }: { data: GiftListData | undefined; className?: string }) {
  const { editing, locale } = useEdit();
  if (!data?.items.length) return null;
  const c = COPY[locale];
  return (
    <div className={`@container flex w-full flex-col gap-5 ${className}`}>
      {editing ? (
        <p className="text-center text-[14px] opacity-70" style={{ fontFamily: SANS }}>
          {c.editHint}{" "}
          <a href="/app/dary" target="_blank" rel="noreferrer" className="underline">
            Otevřít
          </a>
        </p>
      ) : !data.token ? (
        <p className="text-center text-[14px]" style={{ fontFamily: SANS, color: MUTED }}>
          {c.needLink}
        </p>
      ) : null}
      <ul className="grid gap-4 @lg:grid-cols-2">
        {data.items.map((g) => (
          <GiftCard key={g.id} g={g} data={data} locale={locale} editing={editing} />
        ))}
      </ul>
    </div>
  );
}
