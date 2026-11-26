"use client";

import Link from "next/link";
import { useState } from "react";
import "@/components/site/templates/fonts";
import { Icon } from "@/components/icons";

export type PrintTable = { id: string; label: string; guests: string[] };
type Theme = { bg: string; text: string; muted: string; accent: string; line: string; display: string; body: string };
type Kind = "place" | "tables" | "menu" | "plan";

const KINDS: { key: Kind; label: string; hint: string }[] = [
  { key: "place", label: "Jmenovky", hint: "Karta s jménem a stolem pro každého usazeného hosta. 10 na A4, ke složení napůl." },
  { key: "tables", label: "Čísla stolů", hint: "Velký název stolu, 2 na A4 (A5 na výšku)." },
  { key: "plan", label: "Rozpis u vchodu", hint: "Kdo sedí u kterého stolu – plakát na A4." },
  { key: "menu", label: "Menu", hint: "Vlastní text menu ve stylu webu, 2 na A4." },
];

const dateFmt = new Intl.DateTimeFormat("cs-CZ", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

export function PrintStudio({
  couple,
  date,
  events,
  eventId,
  tables,
  theme,
}: {
  couple: string;
  date: string | null;
  events: { id: string; name: string }[];
  eventId: string | null;
  tables: PrintTable[];
  theme: Theme;
}) {
  const [kind, setKind] = useState<Kind>("place");
  const [menu, setMenu] = useState("Předkrm\nCarpaccio z červené řepy, kozí sýr\n\nPolévka\nHovězí vývar s játrovými knedlíčky\n\nHlavní chod\nSvíčková na smetaně, houskový knedlík\n\nDezert\nSvatební dort");
  const [bg, setBg] = useState(true);
  const dateText = date ? dateFmt.format(new Date(`${date}T12:00:00Z`)) : "";
  const places = tables.flatMap((t) => t.guests.map((g) => ({ name: g, table: t.label })));
  const paper = bg ? theme.bg : "#ffffff";
  const heading = { fontFamily: theme.display, color: theme.text };

  const sheets: React.ReactNode[] = [];
  if (kind === "place") {
    for (let i = 0; i < Math.max(1, places.length); i += 10) {
      sheets.push(
        <div className="grid h-full grid-cols-2 grid-rows-5">
          {places.slice(i, i + 10).map((p, k) => (
            <div key={k} className="flex flex-col" style={{ border: `0.3mm dashed ${theme.line}` }}>
              <div className="flex-1" />
              <div className="flex flex-1 flex-col items-center justify-center gap-[1.5mm] px-[4mm] text-center" style={{ background: paper }}>
                <span className="text-[17pt] leading-tight" style={heading}>
                  {p.name}
                </span>
                <span className="text-[8.5pt] uppercase tracking-[0.2em]" style={{ color: theme.accent, fontFamily: theme.body }}>
                  {p.table}
                </span>
              </div>
            </div>
          ))}
        </div>,
      );
    }
  } else if (kind === "tables") {
    for (let i = 0; i < Math.max(1, tables.length); i += 2) {
      sheets.push(
        <div className="grid h-full grid-rows-2">
          {tables.slice(i, i + 2).map((t) => (
            <div key={t.id} className="flex flex-col items-center justify-center gap-[4mm] text-center" style={{ background: paper, borderBottom: `0.3mm dashed ${theme.line}` }}>
              <span className="text-[10pt] uppercase tracking-[0.3em]" style={{ color: theme.accent, fontFamily: theme.body }}>
                {couple}
              </span>
              <span className="text-[54pt] leading-none" style={heading}>
                {t.label}
              </span>
            </div>
          ))}
        </div>,
      );
    }
  } else if (kind === "plan") {
    sheets.push(
      <div className="flex h-full flex-col gap-[8mm] px-[14mm] py-[16mm]" style={{ background: paper, fontFamily: theme.body, color: theme.text }}>
        <div className="text-center">
          <p className="text-[34pt] leading-tight" style={heading}>
            Zasedací pořádek
          </p>
          <p className="mt-[2mm] text-[10pt] uppercase tracking-[0.25em]" style={{ color: theme.accent }}>
            {couple}
            {dateText ? ` · ${dateText}` : ""}
          </p>
        </div>
        <div className="columns-3 gap-[8mm] text-[10pt]">
          {tables.map((t) => (
            <div key={t.id} className="mb-[6mm] break-inside-avoid">
              <p className="mb-[1.5mm] text-[14pt]" style={heading}>
                {t.label}
              </p>
              {t.guests.map((g) => (
                <p key={g} className="leading-snug">
                  {g}
                </p>
              ))}
            </div>
          ))}
        </div>
      </div>,
    );
  } else {
    sheets.push(
      <div className="grid h-full grid-cols-2">
        {[0, 1].map((k) => (
          <div key={k} className="flex flex-col items-center gap-[6mm] px-[12mm] py-[18mm] text-center" style={{ background: paper, borderRight: k === 0 ? `0.3mm dashed ${theme.line}` : undefined, fontFamily: theme.body, color: theme.text }}>
            <p className="text-[30pt] leading-none" style={heading}>
              Menu
            </p>
            <p className="text-[8.5pt] uppercase tracking-[0.25em]" style={{ color: theme.accent }}>
              {couple}
            </p>
            <div className="mt-[4mm] flex flex-col gap-[1mm] text-[10.5pt] leading-relaxed">
              {menu.split("\n").map((line, i) => (
                <p key={i} className={line.trim() === "" ? "h-[4mm]" : i === 0 || menu.split("\n")[i - 1]?.trim() === "" ? "text-[13pt]" : ""} style={i === 0 || menu.split("\n")[i - 1]?.trim() === "" ? heading : undefined}>
                  {line}
                </p>
              ))}
            </div>
          </div>
        ))}
      </div>,
    );
  }

  const empty = (kind === "place" && !places.length) || ((kind === "tables" || kind === "plan") && !tables.length);

  return (
    <div className="flex flex-col gap-6 px-6 py-8 sm:px-10 lg:py-10 print:p-0">
      <div className="flex max-w-4xl flex-col gap-2 print:hidden">
        <h1 className="font-serif text-4xl tracking-tight">Tiskoviny</h1>
        <p className="text-ink-soft">
          Jmenovky, čísla stolů, rozpis u vchodu a menu ve stejném stylu jako váš web. Vytiskněte doma nebo pošlete do tiskárny jako PDF (v dialogu tisku zvolte
          „Uložit jako PDF“). QR kódy pro hosty najdete v{" "}
          <Link href="/app/hoste/qr" className="underline">
            Hosté → QR kódy
          </Link>
          .
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3 print:hidden">
        <div className="flex flex-wrap gap-1 rounded-full bg-surface p-1 ring-1 ring-line/70">
          {KINDS.map((k) => (
            <button key={k.key} type="button" onClick={() => setKind(k.key)} className={`rounded-full px-4 py-1.5 text-sm ${kind === k.key ? "bg-ink text-white" : "text-ink-soft hover:text-ink"}`}>
              {k.label}
            </button>
          ))}
        </div>
        {events.length > 1 && kind !== "menu" ? (
          <select value={eventId ?? ""} onChange={(e) => (window.location.href = `?udalost=${e.target.value}`)} className="h-10 rounded-full border border-line bg-surface px-3 text-sm">
            {events.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
        ) : null}
        <label className="flex items-center gap-2 text-sm text-ink-soft">
          <input type="checkbox" checked={bg} onChange={(e) => setBg(e.target.checked)} className="size-4 accent-eucalyptus" />
          Barevné pozadí
        </label>
        <button type="button" disabled={empty} onClick={() => window.print()} className="ml-auto inline-flex h-10 items-center gap-2 rounded-full bg-eucalyptus px-5 text-sm font-medium text-white hover:bg-eucalyptus-deep disabled:opacity-50">
          <Icon n="send" className="size-4" />
          Tisk / PDF
        </button>
      </div>
      <p className="-mt-3 text-sm text-ink-soft print:hidden">{KINDS.find((k) => k.key === kind)?.hint}</p>

      {kind === "menu" ? (
        <label className="flex max-w-xl flex-col gap-1 text-sm font-medium print:hidden">
          Text menu (prázdný řádek = nový chod, první řádek chodu je nadpis)
          <textarea value={menu} onChange={(e) => setMenu(e.target.value)} rows={10} className="rounded-lg border border-line bg-surface px-3 py-2 text-[15px] focus:border-eucalyptus focus:outline-none" />
        </label>
      ) : null}

      {empty ? (
        <p className="rounded-2xl border border-dashed border-line px-6 py-10 text-center text-ink-soft print:hidden">
          {events.length ? "Zatím nikdo nesedí u stolu. Rozsaďte hosty v Zasedacím pořádku." : "Žádná událost nemá stoly. Zapněte je u hostiny v Událostech."}
        </p>
      ) : (
        <div id="print-area" className="flex flex-col items-center gap-6 print:block print:gap-0">
          {sheets.map((s, i) => (
            <div key={i} className="sheet h-[297mm] w-[210mm] overflow-hidden bg-white shadow-card print:shadow-none" style={{ breakAfter: "page" }}>
              {s}
            </div>
          ))}
        </div>
      )}
      <style>{`@page { size: A4; margin: 0; } @media print { body * { visibility: hidden; } #print-area, #print-area * { visibility: visible; } #print-area { position: absolute; left: 0; top: 0; } .sheet { -webkit-print-color-adjust: exact; print-color-adjust: exact; } } @media screen and (max-width: 860px) { .sheet { zoom: 0.42; } }`}</style>
    </div>
  );
}
