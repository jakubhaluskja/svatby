"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Icon } from "@/components/icons";
import { FormMessage } from "@/components/ui";
import type { MediaView } from "@/lib/gallery";
import { prepare, uploadAll, type Prepared } from "@/lib/media-prep";
import {
  createAlbum,
  deleteAlbum,
  deleteEntry,
  deleteMedia,
  downloadLinks,
  finishUpload,
  loadMedia,
  moveMedia,
  regenerateGalleryLink,
  setEntryHidden,
  setGalleryEnabled,
  setMediaStatus,
  setModeration,
  startUpload,
  type Result,
} from "./actions";

type Album = { id: string; kind: "guests" | "photographer" | "custom"; name: string };
type Entry = { id: string; name: string; message: string; hidden: boolean; createdAt: string };

type Props = {
  tab: "fotky" | "vzkazy" | "hoste";
  canEdit: boolean;
  enabled: boolean;
  moderation: "approve" | "publish";
  quota: number;
  used: number;
  guestUrl: string;
  qrSvg: string;
  couple: string;
  albums: Album[];
  initialMedia: MediaView[];
  pending: number;
  entries: Entry[];
};

const dt = new Intl.DateTimeFormat("cs-CZ", { day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit" });
function bytes(n: number) {
  if (n >= 1024 ** 3) return `${(n / 1024 ** 3).toFixed(1).replace(".", ",")} GB`;
  if (n >= 1024 ** 2) return `${Math.round(n / 1024 ** 2)} MB`;
  return `${Math.max(0, Math.round(n / 1024))} kB`;
}

function useAction() {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const run = (fn: () => Promise<Result>, after?: () => void) =>
    start(async () => {
      const r = await fn();
      setError(r.error ?? null);
      if (r.ok) after?.();
    });
  return { pending, error, run, setError };
}

// -----------------------------------------------------------------------------
// Fotky
// -----------------------------------------------------------------------------
function PhotosTab(props: Props) {
  const [media, setMedia] = useState(props.initialMedia);
  const [filter, setFilter] = useState<string>(props.pending ? "pending" : "all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [lightbox, setLightbox] = useState<number | null>(null);
  const [progress, setProgress] = useState<[number, number] | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(props.initialMedia.length >= 120);
  const [moveTo, setMoveTo] = useState("");
  const [newAlbum, setNewAlbum] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const { pending, error, run, setError } = useAction();
  useEffect(() => setMedia(props.initialMedia), [props.initialMedia]);

  const albumById = useMemo(() => new Map(props.albums.map((a) => [a.id, a])), [props.albums]);
  const shown = media.filter((m) =>
    filter === "all" ? m.status !== "hidden" : filter === "pending" ? m.status === "pending" : filter === "hidden" ? m.status === "hidden" : m.albumId === filter && m.status !== "hidden",
  );
  const pendingCount = media.filter((m) => m.status === "pending").length;
  const uploadAlbum = albumById.get(filter)?.id ?? props.albums.find((a) => a.kind === "photographer")?.id ?? props.albums[0]?.id;

  function toggle(id: string) {
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  async function onFiles(list: FileList | null) {
    if (!list?.length || !uploadAlbum) return;
    setError(null);
    setInfo(null);
    setProgress([0, list.length]);
    const prepared: Prepared[] = [];
    let skipped = 0;
    for (const f of Array.from(list)) {
      const p = await prepare(f);
      if (typeof p === "string") skipped++;
      else prepared.push(p);
    }
    const r = await uploadAll(prepared, startUpload, (done) => finishUpload(done, uploadAlbum), (d, t) => setProgress([d, t]));
    setProgress(null);
    if (fileRef.current) fileRef.current.value = "";
    if (r.error) setError(r.error);
    setInfo(`Nahráno ${r.uploaded}${skipped ? `, přeskočeno ${skipped} (nepodporovaný formát nebo video delší než 60 s)` : ""}.`);
    setMedia(await loadMedia(null));
  }

  async function download() {
    const links = await downloadLinks([...selected]);
    for (const l of links) {
      const a = document.createElement("a");
      a.href = l.url;
      a.download = l.name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      await new Promise((r) => setTimeout(r, 400));
    }
  }

  const sel = [...selected];
  const current = lightbox === null ? null : shown[lightbox];

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-2">
        {[
          ["all", "Vše"],
          ...(pendingCount || props.moderation === "approve" ? [["pending", `Ke schválení (${pendingCount})`]] : []),
          ...props.albums.map((a) => [a.id, a.name]),
          ["hidden", "Skryté"],
        ].map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => {
              setFilter(key);
              setSelected(new Set());
            }}
            className={`rounded-full px-3.5 py-1.5 text-sm ring-1 ${filter === key ? "bg-ink text-white ring-ink" : "bg-surface text-ink-soft ring-line hover:text-ink"} ${key === "pending" && pendingCount ? "font-medium" : ""}`}
          >
            {label}
          </button>
        ))}
        {props.canEdit ? (
          newAlbum === null ? (
            <button type="button" onClick={() => setNewAlbum("")} className="rounded-full px-3 py-1.5 text-sm text-eucalyptus-deep hover:underline">
              + Album
            </button>
          ) : (
            <form
              className="flex items-center gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                run(() => createAlbum(newAlbum), () => setNewAlbum(null));
              }}
            >
              <input autoFocus value={newAlbum} onChange={(e) => setNewAlbum(e.target.value)} maxLength={60} placeholder="Název alba" className="h-9 w-40 rounded-full border border-line px-3 text-sm" />
              <button type="submit" className="text-sm font-medium text-eucalyptus-deep">
                Vytvořit
              </button>
              <button type="button" onClick={() => setNewAlbum(null)} className="text-sm text-ink-soft">
                Zrušit
              </button>
            </form>
          )
        ) : null}
        {props.canEdit && albumById.get(filter)?.kind === "custom" && !shown.length ? (
          <button type="button" onClick={() => run(() => deleteAlbum(filter), () => setFilter("all"))} className="text-sm text-ink-soft hover:text-danger">
            Smazat album
          </button>
        ) : null}
        {props.canEdit ? (
          <>
            <input ref={fileRef} type="file" accept="image/*,video/*" multiple hidden onChange={(e) => void onFiles(e.target.files)} />
            <button
              type="button"
              disabled={!!progress}
              onClick={() => fileRef.current?.click()}
              className="ml-auto inline-flex h-10 items-center gap-2 rounded-full bg-eucalyptus px-5 text-sm font-medium text-white hover:bg-eucalyptus-deep disabled:opacity-60"
            >
              <Icon n="plus" className="size-4" />
              {progress ? `Nahrávám ${progress[0]} z ${progress[1]}…` : `Nahrát do „${albumById.get(uploadAlbum ?? "")?.name ?? "alba"}“`}
            </button>
          </>
        ) : null}
      </div>

      {sel.length ? (
        <div className="sticky top-16 z-20 flex flex-wrap items-center gap-3 rounded-2xl bg-ink px-4 py-2.5 text-sm text-white shadow-pop lg:top-4">
          <span className="font-medium">Vybráno {sel.length}</span>
          {props.canEdit ? (
            <>
              <button type="button" disabled={pending} onClick={() => run(() => setMediaStatus(sel, "approved"), () => setSelected(new Set()))} className="rounded-full bg-white/15 px-3 py-1 hover:bg-white/25">
                Schválit / zobrazit
              </button>
              <button type="button" disabled={pending} onClick={() => run(() => setMediaStatus(sel, "hidden"), () => setSelected(new Set()))} className="rounded-full bg-white/15 px-3 py-1 hover:bg-white/25">
                Skrýt
              </button>
              <select
                value={moveTo}
                onChange={(e) => {
                  const v = e.target.value;
                  setMoveTo("");
                  if (v) run(() => moveMedia(sel, v), () => setSelected(new Set()));
                }}
                className="h-8 rounded-full bg-white/15 px-3 text-white"
              >
                <option value="">Přesunout do…</option>
                {props.albums.map((a) => (
                  <option key={a.id} value={a.id} className="text-ink">
                    {a.name}
                  </option>
                ))}
              </select>
            </>
          ) : null}
          <button type="button" onClick={() => void download()} className="rounded-full bg-white/15 px-3 py-1 hover:bg-white/25">
            Stáhnout originály
          </button>
          {props.canEdit ? (
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                if (window.confirm(`Smazat ${sel.length} ${sel.length === 1 ? "soubor" : "souborů"}? Nejde to vrátit.`)) run(() => deleteMedia(sel), () => setSelected(new Set()));
              }}
              className="rounded-full bg-danger px-3 py-1"
            >
              Smazat
            </button>
          ) : null}
          <button type="button" onClick={() => setSelected(new Set(shown.map((m) => m.id)))} className="ml-auto text-white/80 hover:text-white">
            Vybrat vše
          </button>
          <button type="button" onClick={() => setSelected(new Set())} className="text-white/80 hover:text-white">
            Zrušit výběr
          </button>
        </div>
      ) : null}

      {progress ? (
        <div className="h-1.5 overflow-hidden rounded-full bg-paper">
          <div className="h-full rounded-full bg-eucalyptus transition-all" style={{ width: `${(progress[0] / Math.max(1, progress[1])) * 100}%` }} />
        </div>
      ) : null}
      {info ? <FormMessage tone="info">{info}</FormMessage> : null}
      {error ? <FormMessage>{error}</FormMessage> : null}

      {shown.length ? (
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
          {shown.map((m, i) => (
            <li key={m.id} className="group relative">
              <button type="button" onClick={() => (sel.length ? toggle(m.id) : setLightbox(i))} className="block aspect-square w-full overflow-hidden rounded-lg bg-paper">
                {m.thumb ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={m.thumb} alt="" loading="lazy" className={`size-full object-cover ${m.status === "hidden" ? "opacity-40" : ""}`} />
                ) : (
                  <span className="grid size-full place-items-center text-xs text-ink-soft">bez náhledu</span>
                )}
              </button>
              <label className={`absolute top-1.5 left-1.5 grid size-6 place-items-center rounded-full bg-surface/90 shadow ${selected.has(m.id) ? "" : "opacity-0 group-hover:opacity-100"}`}>
                <input type="checkbox" checked={selected.has(m.id)} onChange={() => toggle(m.id)} className="size-4 accent-eucalyptus" aria-label="Vybrat" />
              </label>
              {m.status === "pending" ? <span className="absolute right-1.5 bottom-1.5 rounded-full bg-plum px-2 py-0.5 text-[11px] font-medium text-white">ke schválení</span> : null}
              {m.kind === "video" ? <span className="absolute top-1.5 right-1.5 rounded-full bg-black/55 px-2 py-0.5 text-[11px] text-white">▶ video</span> : null}
            </li>
          ))}
        </ul>
      ) : (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-line px-6 py-14 text-center text-ink-soft">
          <Icon n="camera" className="size-8" />
          <p>{filter === "pending" ? "Nic nečeká na schválení." : "Zatím tu nejsou žádné fotky."}</p>
          {!props.enabled ? <p className="text-sm">Zapněte galerii pro hosty v záložce Pro hosty – dostanete QR kód na stoly.</p> : null}
        </div>
      )}
      {hasMore ? (
        <button
          type="button"
          onClick={async () => {
            const more = await loadMedia(media.at(-1)?.createdAt ?? null);
            setMedia((m) => [...m, ...more]);
            setHasMore(more.length >= 120);
          }}
          className="self-center rounded-full border border-line px-5 py-2 text-sm hover:border-eucalyptus"
        >
          Načíst další
        </button>
      ) : null}

      {current ? (
        <div className="fixed inset-0 z-50 flex flex-col bg-ink/95 text-white" role="dialog" aria-modal="true">
          <div className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
            <span className="min-w-0 flex-1 truncate text-white/70">
              {current.uploader ?? "Bez jména"} · {dt.format(new Date(current.createdAt))} · {albumById.get(current.albumId)?.name}
            </span>
            {props.canEdit && current.status !== "approved" ? (
              <button type="button" onClick={() => run(() => setMediaStatus([current.id], "approved"))} className="rounded-full bg-eucalyptus px-3 py-1 font-medium">
                Schválit
              </button>
            ) : null}
            {props.canEdit && current.status !== "hidden" ? (
              <button type="button" onClick={() => run(() => setMediaStatus([current.id], "hidden"))} className="rounded-full bg-white/15 px-3 py-1">
                Skrýt
              </button>
            ) : null}
            {current.original ? (
              <a href={current.original} download className="rounded-full bg-white/15 px-3 py-1">
                Stáhnout
              </a>
            ) : null}
            <button type="button" onClick={() => setLightbox(null)} className="rounded-full px-3 py-1 ring-1 ring-white/40">
              Zavřít
            </button>
          </div>
          <div className="relative flex min-h-0 flex-1 items-center justify-center px-2 pb-4">
            {current.kind === "video" && current.original ? (
              <video src={current.original} controls autoPlay playsInline className="max-h-full max-w-full" />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={current.preview || current.original || ""} alt="" className="max-h-full max-w-full object-contain" />
            )}
            {lightbox! > 0 ? (
              <button type="button" aria-label="Předchozí" onClick={() => setLightbox(lightbox! - 1)} className="absolute top-1/2 left-2 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-white/15 text-2xl">
                ‹
              </button>
            ) : null}
            {lightbox! < shown.length - 1 ? (
              <button type="button" aria-label="Další" onClick={() => setLightbox(lightbox! + 1)} className="absolute top-1/2 right-2 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-white/15 text-2xl">
                ›
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

// -----------------------------------------------------------------------------
// Kniha přání
// -----------------------------------------------------------------------------
function EntriesTab(props: Props) {
  const { pending, error, run } = useAction();
  if (!props.entries.length) {
    return <p className="rounded-2xl border border-dashed border-line px-6 py-12 text-center text-ink-soft">Zatím vám nikdo nenapsal. Vzkazy píšou hosté na stránce s fotkami.</p>;
  }
  return (
    <div className="flex flex-col gap-3">
      {error ? <FormMessage>{error}</FormMessage> : null}
      <ul className="grid gap-3 md:grid-cols-2">
        {props.entries.map((e) => (
          <li key={e.id} className={`flex flex-col gap-2 rounded-2xl bg-surface p-5 shadow-card ring-1 ring-line/70 ${e.hidden ? "opacity-55" : ""}`}>
            <p className="whitespace-pre-line font-serif text-lg leading-relaxed">{e.message}</p>
            <div className="mt-auto flex flex-wrap items-center gap-3 text-sm text-ink-soft">
              <span className="font-medium text-ink">{e.name}</span>
              <span>{dt.format(new Date(e.createdAt))}</span>
              {e.hidden ? <span className="rounded-full bg-paper px-2 py-0.5">skryto</span> : null}
              {props.canEdit ? (
                <span className="ml-auto flex gap-3">
                  <button type="button" disabled={pending} onClick={() => run(() => setEntryHidden(e.id, !e.hidden))} className="hover:text-ink">
                    {e.hidden ? "Zobrazit" : "Skrýt"}
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => {
                      if (window.confirm("Smazat vzkaz?")) run(() => deleteEntry(e.id));
                    }}
                    className="hover:text-danger"
                  >
                    Smazat
                  </button>
                </span>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Pro hosty: zapnutí, QR, prezentace, moderace
// -----------------------------------------------------------------------------
function GuestsTab(props: Props) {
  const { pending, error, run } = useAction();
  const [copied, setCopied] = useState(false);
  const pct = props.quota ? Math.min(100, Math.round((props.used / props.quota) * 100)) : 0;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="flex flex-col gap-4">
        <section className="flex flex-col gap-3 rounded-2xl bg-surface p-5 shadow-card ring-1 ring-line/70">
          <label className="flex items-start gap-3">
            <input type="checkbox" disabled={!props.canEdit || pending} checked={props.enabled} onChange={(e) => run(() => setGalleryEnabled(e.target.checked))} className="mt-1 size-4 accent-eucalyptus" />
            <span>
              <span className="block font-medium">Galerie pro hosty je {props.enabled ? "zapnutá" : "vypnutá"}</span>
              <span className="text-sm text-ink-soft">Hosté přes QR kód nebo odkaz nahrávají fotky a videa (do 60 s) a píšou vzkazy. Nic neinstalují, stačí telefon.</span>
            </span>
          </label>
        </section>

        <section className="flex flex-col gap-3 rounded-2xl bg-surface p-5 shadow-card ring-1 ring-line/70">
          <p className="font-medium">Fotky od hostů</p>
          {(
            [
              ["approve", "Nejdřív je schválím", "Fotky se ostatním ukážou až po vašem schválení."],
              ["publish", "Ukázat hned", "Fotky jsou vidět hned po nahrání. Nevhodné můžete kdykoli skrýt."],
            ] as const
          ).map(([key, label, hint]) => (
            <label key={key} className="flex items-start gap-3">
              <input type="radio" name="moderation" disabled={!props.canEdit || pending} checked={props.moderation === key} onChange={() => run(() => setModeration(key))} className="mt-1 size-4 accent-eucalyptus" />
              <span>
                <span className="block">{label}</span>
                <span className="text-sm text-ink-soft">{hint}</span>
              </span>
            </label>
          ))}
        </section>

        <section className="flex flex-col gap-3 rounded-2xl bg-surface p-5 shadow-card ring-1 ring-line/70">
          <p className="font-medium">Živá prezentace</p>
          <p className="text-sm text-ink-soft">
            Pusťte ji večer na projektoru nebo televizi. Ukazuje nové fotky hostů a vzkazy, sama se obnovuje a v rohu má QR kód, ať se přidají další.
          </p>
          <a
            href={props.guestUrl ? `${props.guestUrl}/prezentace` : "#"}
            target="_blank"
            rel="noreferrer"
            aria-disabled={!props.enabled}
            className={`inline-flex h-10 items-center gap-2 self-start rounded-full bg-ink px-5 text-sm font-medium text-white hover:bg-ink/85 ${props.enabled ? "" : "pointer-events-none opacity-50"}`}
          >
            <Icon n="eye" className="size-4" />
            Spustit prezentaci
          </a>
        </section>

        <section className="flex flex-col gap-2 rounded-2xl bg-surface p-5 shadow-card ring-1 ring-line/70">
          <p className="font-medium">Místo v galerii</p>
          <div className="h-2 overflow-hidden rounded-full bg-paper">
            <div className={`h-full rounded-full ${pct > 90 ? "bg-danger" : "bg-eucalyptus"}`} style={{ width: `${pct}%` }} />
          </div>
          <p className="text-sm text-ink-soft">
            Využito {bytes(props.used)} z {bytes(props.quota)}.
          </p>
        </section>
        {error ? <FormMessage>{error}</FormMessage> : null}
      </div>

      <section className="flex flex-col items-center gap-4 self-start rounded-2xl bg-surface p-6 text-center shadow-card ring-1 ring-line/70 print:shadow-none print:ring-0" id="gallery-qr">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-eucalyptus">Fotky a vzkazy</p>
        <p className="font-serif text-2xl">{props.couple}</p>
        <div className="w-52 rounded-xl bg-white p-3" dangerouslySetInnerHTML={{ __html: props.qrSvg }} />
        <p className="text-sm text-ink-soft">Naskenujte a přidejte své fotky ze svatby</p>
        <div className="flex flex-wrap justify-center gap-3 text-sm print:hidden">
          <button
            type="button"
            onClick={() => void navigator.clipboard.writeText(props.guestUrl).then(() => setCopied(true))}
            className="text-eucalyptus-deep hover:underline"
          >
            {copied ? "Zkopírováno" : "Kopírovat odkaz"}
          </button>
          <button type="button" onClick={() => window.print()} className="text-eucalyptus-deep hover:underline">
            Vytisknout na stoly
          </button>
          <a href={props.guestUrl} target="_blank" rel="noreferrer" className="text-eucalyptus-deep hover:underline">
            Otevřít jako host
          </a>
        </div>
        {props.canEdit ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              if (window.confirm("Vytvořit nový odkaz? Starý QR kód přestane fungovat.")) run(() => regenerateGalleryLink());
            }}
            className="text-xs text-ink-soft hover:text-danger print:hidden"
          >
            Vytvořit nový odkaz
          </button>
        ) : null}
      </section>
      <style>{`@media print { body * { visibility: hidden; } #gallery-qr, #gallery-qr * { visibility: visible; } #gallery-qr { position: absolute; inset: 0; margin: auto; height: fit-content; } }`}</style>
    </div>
  );
}

export function GalleryView(props: Props) {
  const tabs = [
    ["fotky", `Fotky${props.pending ? ` (${props.pending} ke schválení)` : ""}`],
    ["vzkazy", `Kniha přání (${props.entries.length})`],
    ["hoste", "Pro hosty"],
  ] as const;
  return (
    <div className="flex max-w-6xl flex-col gap-8 px-6 py-8 sm:px-10 lg:py-10">
      <div className="flex flex-col gap-2">
        <h1 className="font-serif text-4xl tracking-tight">Fotogalerie</h1>
        <p className="max-w-2xl text-ink-soft">Fotky a videa od hostů i od fotografa na jednom místě, kniha přání a živá prezentace pro večer.</p>
      </div>
      {!props.enabled ? (
        <p className="rounded-2xl bg-plum/8 px-5 py-4 text-sm text-plum">
          Galerie pro hosty je vypnutá.{" "}
          <Link href="/app/galerie?tab=hoste" className="font-medium underline">
            Zapnout a získat QR kód
          </Link>
        </p>
      ) : null}
      <nav className="flex flex-wrap gap-1 rounded-full bg-surface p-1 ring-1 ring-line/70 sm:self-start" aria-label="Části">
        {tabs.map(([key, label]) => (
          <Link
            key={key}
            href={key === "fotky" ? "/app/galerie" : `/app/galerie?tab=${key}`}
            aria-current={props.tab === key ? "page" : undefined}
            className={`rounded-full px-4 py-1.5 text-sm ${props.tab === key ? "bg-ink text-white" : "text-ink-soft hover:text-ink"}`}
          >
            {label}
          </Link>
        ))}
      </nav>
      {props.tab === "fotky" ? <PhotosTab {...props} /> : props.tab === "vzkazy" ? <EntriesTab {...props} /> : <GuestsTab {...props} />}
    </div>
  );
}
