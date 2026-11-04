"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { Icon } from "@/components/icons";
import { FormMessage } from "@/components/ui";
import { previewEmail, sendEmails, type SendState } from "./actions";

export type Kind = "invitation" | "reminder" | "message" | "thank_you";

export type Recipient = {
  id: string;
  name: string;
  email: string | null;
  locale: "cs" | "en";
  unsubscribed: boolean;
  invited: boolean;
  responded: boolean;
  thanked: boolean;
  lastSent: string | null;
};

const DEFAULTS: Record<Kind, { cs: string; en: string; subject?: { cs: string; en: string } }> = {
  invitation: {
    cs: "S radostí vás zveme na naši svatbu. Všechno potřebné najdete na svatebním webu, kde nám prosím také potvrďte, jestli dorazíte.",
    en: "We would love you to join us on our wedding day. You will find everything on our wedding website, where you can also let us know if you can make it.",
  },
  reminder: {
    cs: "Ještě od vás nemáme odpověď, jestli na svatbu dorazíte. Pomůže nám to s plánováním – zabere to jen minutku.",
    en: "We haven't heard back from you yet. Letting us know whether you can come helps us a lot with planning – it only takes a minute.",
  },
  message: { cs: "", en: "", subject: { cs: "", en: "" } },
  thank_you: {
    cs: "Moc děkujeme, že jste byli u toho, a za všechno, čím jste náš den udělali výjimečným.",
    en: "Thank you so much for being part of our day and for everything you did to make it so special.",
    subject: { cs: "", en: "" },
  },
};

const INTRO: Record<Kind, string> = {
  invitation: "E-mail s osobním odkazem, přes který domácnost potvrdí účast. Předvybrané jsou domácnosti, kterým pozvánka ještě neodešla.",
  reminder: "Jen pro ty, kdo ještě neodpověděli. Stejné domácnosti připomínku pošleme nejvýš jednou za den.",
  message: "Cokoli, co potřebujete hostům sdělit e-mailem – změna programu, doprava, dress code. Pro zprávy přímo na webu použijte Zprávy hostům.",
  thank_you: "Poděkování po svatbě. Předvybrané jsou domácnosti, kterým jste ještě neděkovali.",
};

const field = "w-full rounded-lg border border-line bg-surface px-3 text-[15px] focus:border-eucalyptus focus:outline-none";

function blocked(r: Recipient, kind: Kind): string | null {
  if (!r.email) return "bez e-mailu";
  if (r.unsubscribed) return "odhlásili se z e-mailů";
  if (kind === "reminder" && r.responded) return "už odpověděli";
  return null;
}

function defaultChecked(r: Recipient, kind: Kind): boolean {
  if (blocked(r, kind)) return false;
  if (kind === "invitation") return !r.invited;
  if (kind === "thank_you") return !r.thanked;
  return true;
}

function note(r: Recipient, kind: Kind): string {
  if (kind === "invitation") return r.invited ? `pozvánka odeslána${r.lastSent ? ` ${r.lastSent}` : ""}` : "pozvánka zatím neodešla";
  if (kind === "reminder") return r.lastSent ? `připomenuto ${r.lastSent}` : r.invited ? "pozvaní, bez odpovědi" : "bez odpovědi";
  if (kind === "thank_you") return r.thanked ? `poděkováno${r.lastSent ? ` ${r.lastSent}` : ""}` : r.responded ? "odpověděli" : "";
  return r.lastSent ? `poslední zpráva ${r.lastSent}` : "";
}

export function Composer({
  kind,
  recipients,
  only,
  english,
  canSend,
}: {
  kind: Kind;
  recipients: Recipient[];
  only: string | null;
  english: boolean;
  canSend: boolean;
}) {
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(recipients.filter((r) => (only ? r.id === only && !blocked(r, kind) : defaultChecked(r, kind))).map((r) => r.id)),
  );
  const d = DEFAULTS[kind];
  const [text, setText] = useState(d.cs);
  const [textEn, setTextEn] = useState(d.en);
  const [subject, setSubject] = useState(d.subject?.cs ?? "");
  const [subjectEn, setSubjectEn] = useState(d.subject?.en ?? "");
  const [lang, setLang] = useState<"cs" | "en">("cs");
  const [preview, setPreview] = useState<{ subject: string; html: string } | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [result, setResult] = useState<SendState | null>(null);
  const [pending, start] = useTransition();

  const eligible = useMemo(() => recipients.filter((r) => !blocked(r, kind)), [recipients, kind]);
  const unavailable = recipients.length - eligible.length;
  const enCount = recipients.filter((r) => selected.has(r.id) && r.locale === "en").length;
  const showEn = english && (enCount > 0 || recipients.some((r) => r.locale === "en"));
  const hasSubject = kind === "message" || kind === "thank_you";

  const payload = () => ({
    kind,
    ids: [...selected],
    subject,
    subjectEn,
    note: text === d.cs && kind !== "message" ? "" : text,
    noteEn: textEn === d.en && kind !== "message" ? "" : textEn,
  });

  function toggle(id: string) {
    setResult(null);
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  function send() {
    start(async () => {
      const r = await sendEmails(payload());
      setResult(r);
      setConfirm(false);
      if (!r.error && r.sent > 0) setSelected(new Set());
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <section className="flex flex-col rounded-2xl bg-surface shadow-card ring-1 ring-line/70">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-line px-5 py-3.5">
          <h2 className="font-medium">Komu</h2>
          <span className="text-sm text-ink-soft">
            vybráno {selected.size} z {eligible.length}
          </span>
          <span className="ml-auto flex gap-3 text-sm">
            <button type="button" onClick={() => setSelected(new Set(eligible.map((r) => r.id)))} className="text-eucalyptus-deep hover:underline">
              Všechny
            </button>
            <button type="button" onClick={() => setSelected(new Set())} className="text-ink-soft hover:underline">
              Nikoho
            </button>
          </span>
        </div>
        <ul className="max-h-[520px] divide-y divide-line/70 overflow-y-auto">
          {recipients.map((r) => {
            const why = blocked(r, kind);
            return (
              <li key={r.id}>
                <label className={`flex items-center gap-3 px-5 py-2.5 ${why ? "opacity-55" : "cursor-pointer hover:bg-paper/60"}`}>
                  <input type="checkbox" disabled={!!why} checked={selected.has(r.id)} onChange={() => toggle(r.id)} className="size-4 accent-eucalyptus" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-medium">
                      {r.name}
                      {r.locale === "en" ? <span className="ml-2 rounded bg-paper px-1.5 text-[11px] font-semibold text-ink-soft">EN</span> : null}
                    </span>
                    <span className="block truncate text-xs text-ink-soft">{r.email ?? "—"}</span>
                  </span>
                  <span className="shrink-0 text-right text-xs text-ink-soft">
                    {why ? (
                      why === "bez e-mailu" ? (
                        <Link href={`/app/hoste/${r.id}/upravit`} className="underline">
                          doplnit e-mail
                        </Link>
                      ) : (
                        why
                      )
                    ) : (
                      note(r, kind)
                    )}
                  </span>
                </label>
              </li>
            );
          })}
          {recipients.length === 0 ? <li className="px-5 py-8 text-center text-sm text-ink-soft">Zatím nemáte žádné hosty.</li> : null}
        </ul>
        {unavailable > 0 ? (
          <p className="border-t border-line px-5 py-3 text-xs text-ink-soft">
            {unavailable} {unavailable === 1 ? "domácnost nelze vybrat" : unavailable < 5 ? "domácnosti nelze vybrat" : "domácností nelze vybrat"} (chybí e-mail, odhlásili se
            {kind === "reminder" ? " nebo už odpověděli" : ""}).
          </p>
        ) : null}
      </section>

      <section className="flex flex-col gap-4 rounded-2xl bg-surface p-5 shadow-card ring-1 ring-line/70 sm:p-6">
        <p className="text-sm text-ink-soft">{INTRO[kind]}</p>

        {showEn ? (
          <div className="flex gap-1 self-start rounded-full bg-paper p-1 text-sm">
            {(["cs", "en"] as const).map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => setLang(l)}
                className={`rounded-full px-3 py-1 ${lang === l ? "bg-surface font-medium shadow-card" : "text-ink-soft"}`}
              >
                {l === "cs" ? "Česky" : `Anglicky${enCount ? ` (${enCount})` : ""}`}
              </button>
            ))}
          </div>
        ) : null}

        {hasSubject ? (
          <label className="flex flex-col gap-1 text-sm font-medium">
            Předmět{kind === "thank_you" ? " (nepovinný)" : ""}
            <input
              value={lang === "cs" ? subject : subjectEn}
              onChange={(e) => (lang === "cs" ? setSubject(e.target.value) : setSubjectEn(e.target.value))}
              maxLength={150}
              placeholder={kind === "message" ? (lang === "cs" ? "Např. Změna času obřadu" : "e.g. Ceremony time change") : lang === "cs" ? "Děkujeme!" : "Thank you!"}
              className={`${field} h-10`}
            />
          </label>
        ) : null}

        <label className="flex flex-col gap-1 text-sm font-medium">
          {kind === "message" ? "Text zprávy" : "Text e-mailu"}
          <textarea
            value={lang === "cs" ? text : textEn}
            onChange={(e) => (lang === "cs" ? setText(e.target.value) : setTextEn(e.target.value))}
            rows={kind === "message" ? 8 : 6}
            maxLength={5000}
            placeholder={lang === "en" && kind === "message" ? "Leave empty to send the Czech text to everyone." : undefined}
            className={`${field} py-2.5 leading-relaxed`}
          />
          <span className="text-xs font-normal text-ink-soft">
            {kind === "invitation" || kind === "reminder"
              ? "Oslovení, datum, místo, tlačítko s osobním odkazem a kód pozvánky doplníme automaticky."
              : "Oslovení a podpis doplníme automaticky. Prázdný řádek = nový odstavec."}
          </span>
        </label>

        <div className="mt-auto flex flex-wrap items-center gap-3 border-t border-line pt-4">
          <button
            type="button"
            onClick={() =>
              start(async () => {
                setPreview(await previewEmail({ ...payload(), locale: lang }));
              })
            }
            className="inline-flex h-10 items-center gap-2 rounded-full border border-line px-5 text-sm font-medium hover:border-eucalyptus"
          >
            <Icon n="eye" className="size-4" />
            Náhled
          </button>
          {confirm ? (
            <span className="flex flex-wrap items-center gap-2 text-sm">
              Odeslat {selected.size} {selected.size === 1 ? "e-mail" : selected.size < 5 ? "e-maily" : "e-mailů"}?
              <button type="button" disabled={pending} onClick={send} className="h-10 rounded-full bg-eucalyptus px-5 font-medium text-white hover:bg-eucalyptus-deep disabled:opacity-50">
                {pending ? "Odesílám…" : "Ano, odeslat"}
              </button>
              <button type="button" onClick={() => setConfirm(false)} className="text-ink-soft underline">
                Zpět
              </button>
            </span>
          ) : (
            <button
              type="button"
              disabled={!canSend || selected.size === 0 || (kind === "message" && (!subject.trim() || !text.trim()))}
              onClick={() => setConfirm(true)}
              className="ml-auto inline-flex h-10 items-center gap-2 rounded-full bg-eucalyptus px-5 text-sm font-medium text-white hover:bg-eucalyptus-deep disabled:opacity-50"
            >
              <Icon n="send" className="size-4" />
              Odeslat ({selected.size})
            </button>
          )}
        </div>
        {result?.error ? <FormMessage>{result.error}</FormMessage> : null}
        {result && !result.error ? (
          <FormMessage tone={result.failed ? "error" : "info"}>
            Odesláno {result.sent}
            {result.skipped ? `, přeskočeno ${result.skipped}` : ""}
            {result.failed ? `, nepodařilo se ${result.failed} – zkontrolujte adresy v záložce Odeslané` : ""}.
          </FormMessage>
        ) : null}
      </section>

      {preview ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Náhled e-mailu">
          <button type="button" aria-label="Zavřít náhled" onClick={() => setPreview(null)} className="absolute inset-0 bg-ink/40" />
          <div className="relative flex h-[min(860px,92svh)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-surface shadow-pop">
            <div className="flex items-center gap-3 border-b border-line px-5 py-3">
              <p className="min-w-0 flex-1 truncate text-sm">
                <span className="text-ink-soft">Předmět: </span>
                <span className="font-medium">{preview.subject}</span>
              </p>
              <button type="button" onClick={() => setPreview(null)} aria-label="Zavřít" className="grid size-9 place-items-center rounded-full hover:bg-paper">
                <Icon n="close" />
              </button>
            </div>
            <iframe title="Náhled e-mailu" srcDoc={preview.html} sandbox="" className="w-full flex-1 bg-paper" />
          </div>
        </div>
      ) : null}
    </div>
  );
}
