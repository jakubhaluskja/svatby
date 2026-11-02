"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import type { LayoutItem, SeatingData, SeatingGuest } from "@/lib/seating-data";
import { photoUrl } from "@/lib/media";
import { createClient } from "@/lib/supabase/client";
import { freeSeatIndexes, initials, seatMap, type Problem } from "@/lib/seating";
import { addRule, assignGuests, autoSeat, clearSeating, deleteRule, saveLayout, seatAt, setLocked, unassignGuests } from "./actions";
import { DECOR_PRESETS, seatPositions, ShapeOutline, TABLE_PRESETS, type ShapeId } from "./shapes";

type Assignment = SeatingData["assignments"][number];
type Panel = "guests" | "rules";

const btn = "h-9 rounded-full border border-line bg-surface px-3.5 text-sm font-medium hover:border-eucalyptus disabled:opacity-50";
const input = "h-9 rounded-lg border border-line bg-surface px-2.5 text-sm focus:border-eucalyptus focus:outline-none";

export function SeatingEditor({ data, weddingId, canEdit }: { data: SeatingData; weddingId: string; canEdit: boolean }) {
  const eventId = data.event.id;
  const [items, setItems] = useState<LayoutItem[]>(data.items);
  const [assignments, setAssignments] = useState<Assignment[]>(data.assignments);
  const [background, setBackground] = useState<string | null>(data.layout.background_key);
  const [selected, setSelected] = useState<string | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [panel, setPanel] = useState<Panel>("guests");
  const [search, setSearch] = useState("");
  const [tag, setTag] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [problems, setProblems] = useState<Problem[]>([]);
  const [chair, setChair] = useState<{ tableId: string; index: number; left: number; top: number } | null>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const [pending, start] = useTransition();
  const svg = useRef<SVGSVGElement>(null);
  const drag = useRef<{ id: string; dx: number; dy: number; moved: boolean } | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const itemsRef = useRef(items);
  itemsRef.current = items;

  useEffect(() => setAssignments(data.assignments), [data.assignments]);

  const guestById = useMemo(() => new Map(data.guests.map((g) => [g.id, g])), [data.guests]);
  const byTable = useMemo(() => {
    const m = new Map<string, Assignment[]>();
    for (const a of assignments) m.set(a.table_id, [...(m.get(a.table_id) ?? []), a]);
    return m;
  }, [assignments]);
  const seatedIds = useMemo(() => new Set(assignments.map((a) => a.guest_id)), [assignments]);
  const unseated = data.guests.filter((g) => g.status !== "no" && !seatedIds.has(g.id));
  const declined = assignments.filter((a) => guestById.get(a.guest_id)?.status === "no");
  const tables = items.filter((i) => i.kind === "table");
  const capacity = tables.reduce((n, t) => n + t.seats, 0);
  const attendingCount = data.guests.filter((g) => g.attending).length;
  const seatedConfirmed = data.guests.filter((g) => g.attending && seatedIds.has(g.id)).length;
  const pendingCount = data.guests.filter((g) => g.status === "pending").length;
  const selectedItem = items.find((i) => i.id === selected) ?? null;

  // Uložení plátna (s krátkým zpožděním při psaní)
  const persist = useCallback(
    (next: LayoutItem[], bg?: string | null, delay = 0) => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        start(async () => {
          const r = await saveLayout(eventId, next, bg);
          if (r.error) setMessage(r.error);
        });
      }, delay);
    },
    [eventId],
  );

  function update(id: string, patch: Partial<LayoutItem>, delay = 500) {
    const next = items.map((i) => (i.id === id ? { ...i, ...patch } : i));
    setItems(next);
    persist(next, undefined, delay);
  }

  function addItem(kind: "table" | "decor", preset: { shape: ShapeId; label: string; w: number; h: number; seats?: number }) {
    const n = items.filter((i) => i.kind === "table").length + 1;
    const offset = (items.length % 6) * 30;
    const item: LayoutItem = {
      id: crypto.randomUUID(),
      kind,
      shape: preset.shape,
      label: kind === "table" ? `Stůl ${n}` : preset.label,
      seats: kind === "table" ? preset.seats ?? 8 : 0,
      x: data.layout.width / 2 + offset,
      y: data.layout.height / 2 + offset,
      w: preset.w,
      h: preset.h,
      rotation: 0,
      sort: items.length,
    };
    const next = [...items, item];
    setItems(next);
    setSelected(item.id);
    persist(next);
  }

  function removeItem(id: string) {
    const next = items.filter((i) => i.id !== id);
    setItems(next);
    setAssignments((a) => a.filter((x) => x.table_id !== id));
    setSelected(null);
    persist(next);
  }

  function seat(tableId: string, guestIds: string[]) {
    if (!canEdit || guestIds.length === 0) return;
    const table = items.find((i) => i.id === tableId);
    const taken = assignments.filter((a) => a.table_id === tableId && !guestIds.includes(a.guest_id)).map((a) => a.seat_index);
    const indexes = freeSeatIndexes(table?.seats ?? 0, taken, guestIds.length);
    setAssignments((list) => [
      ...list.filter((a) => !guestIds.includes(a.guest_id)),
      ...guestIds.map((guest_id, i) => ({ guest_id, table_id: tableId, seat_index: indexes[i], locked: false })),
    ]);
    setPicked([]);
    start(async () => {
      const r = await assignGuests(eventId, tableId, guestIds);
      if (r.error) setMessage(r.error);
    });
  }

  function seatOnChair(tableId: string, index: number, guestId: string) {
    setAssignments((list) => [
      ...list.filter((a) => a.guest_id !== guestId && !(a.table_id === tableId && a.seat_index === index)),
      { guest_id: guestId, table_id: tableId, seat_index: index, locked: false },
    ]);
    setChair(null);
    start(async () => {
      const r = await seatAt(eventId, tableId, index, guestId);
      if (r.error) setMessage(r.error);
    });
  }

  function openChair(e: React.MouseEvent | React.KeyboardEvent, tableId: string, index: number) {
    e.stopPropagation();
    const box = wrap.current!.getBoundingClientRect();
    const target = (e.currentTarget as Element).getBoundingClientRect();
    setSelected(null);
    setChair({ tableId, index, left: target.left + target.width / 2 - box.left, top: target.bottom - box.top + 8 });
  }

  function unseat(guestIds: string[]) {
    setAssignments((list) => list.filter((a) => !guestIds.includes(a.guest_id)));
    start(() => unassignGuests(eventId, guestIds));
  }

  // Souřadnice ukazatele v prostoru plátna
  function toSvg(e: React.PointerEvent) {
    const ctm = svg.current!.getScreenCTM()!.inverse();
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm);
    return { x: p.x, y: p.y };
  }

  function onItemPointerDown(e: React.PointerEvent, item: LayoutItem) {
    e.stopPropagation();
    if (!canEdit) {
      setSelected(item.id);
      return;
    }
    (e.target as Element).setPointerCapture(e.pointerId);
    const p = toSvg(e);
    drag.current = { id: item.id, dx: p.x - item.x, dy: p.y - item.y, moved: false };
  }

  function onPointerMove(e: React.PointerEvent) {
    const d = drag.current;
    if (!d) return;
    const p = toSvg(e);
    const x = Math.round((p.x - d.dx) / 10) * 10;
    const y = Math.round((p.y - d.dy) / 10) * 10;
    setItems((list) => list.map((i) => (i.id === d.id ? { ...i, x, y } : i)));
    d.moved = true;
  }

  function onPointerUp() {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    if (d.moved) {
      persist(itemsRef.current);
      return;
    }
    // Klepnutí bez pohybu: posadit vybrané hosty, jinak vybrat stůl
    const item = items.find((i) => i.id === d.id);
    if (item?.kind === "table" && picked.length) seat(item.id, picked);
    else setSelected(d.id);
  }

  function onItemKey(e: React.KeyboardEvent, item: LayoutItem) {
    const step = e.shiftKey ? 50 : 10;
    const moves: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    if (moves[e.key] && canEdit) {
      e.preventDefault();
      update(item.id, { x: item.x + moves[e.key][0], y: item.y + moves[e.key][1] }, 600);
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (item.kind === "table" && picked.length) seat(item.id, picked);
      else setSelected(item.id);
    }
  }

  async function uploadPlan(file: File) {
    const path = `${weddingId}/plan-${crypto.randomUUID()}.jpg`;
    const { error } = await createClient().storage.from("site-media").upload(path, file, { contentType: file.type, cacheControl: "31536000" });
    if (error) {
      setMessage("Půdorys se nepodařilo nahrát. Použijte JPG nebo PNG do 10 MB.");
      return;
    }
    setBackground(path);
    persist(items, path);
  }

  // Panel hostů
  const needle = search.trim().toLowerCase();
  const visibleUnseated = unseated.filter((g) => (!tag || g.tags.includes(tag)) && (!needle || g.name.toLowerCase().includes(needle) || g.household.toLowerCase().includes(needle)));
  const households = useMemo(() => {
    const m = new Map<string, SeatingGuest[]>();
    for (const g of visibleUnseated) m.set(g.household_id, [...(m.get(g.household_id) ?? []), g]);
    return [...m.values()];
  }, [visibleUnseated]);

  const bgUrl = photoUrl(background);

  return (
    <div className="flex flex-col gap-4">
      {/* Nástroje */}
      <div className="flex flex-wrap items-center gap-2">
        {canEdit ? (
          <>
            <details className="relative">
              <summary className={`${btn} inline-flex cursor-pointer list-none items-center`}>Přidat stůl</summary>
              <div className="absolute z-20 mt-1 flex w-48 flex-col rounded-xl border border-line bg-surface p-1 shadow-lg">
                {TABLE_PRESETS.map((p) => (
                  <button key={p.shape} type="button" onClick={(e) => { addItem("table", p); (e.currentTarget.closest("details") as HTMLDetailsElement).open = false; }} className="rounded-lg px-3 py-2 text-left text-sm hover:bg-paper">
                    {p.label} <span className="text-ink-soft">({p.seats} míst)</span>
                  </button>
                ))}
              </div>
            </details>
            <details className="relative">
              <summary className={`${btn} inline-flex cursor-pointer list-none items-center`}>Přidat prvek</summary>
              <div className="absolute z-20 mt-1 flex w-40 flex-col rounded-xl border border-line bg-surface p-1 shadow-lg">
                {DECOR_PRESETS.map((p) => (
                  <button key={p.shape} type="button" onClick={(e) => { addItem("decor", p); (e.currentTarget.closest("details") as HTMLDetailsElement).open = false; }} className="rounded-lg px-3 py-2 text-left text-sm hover:bg-paper">
                    {p.label}
                  </button>
                ))}
              </div>
            </details>
            <label className={`${btn} inline-flex cursor-pointer items-center`}>
              {background ? "Vyměnit půdorys" : "Nahrát půdorys sálu"}
              <input type="file" accept="image/jpeg,image/png" className="sr-only" onChange={(e) => e.target.files?.[0] && uploadPlan(e.target.files[0])} />
            </label>
            {background ? (
              <button type="button" className={btn} onClick={() => { setBackground(null); persist(items, null); }}>
                Odebrat půdorys
              </button>
            ) : null}
            <span className="mx-1 hidden h-6 w-px bg-line sm:block" />
            <button
              type="button"
              className="h-9 rounded-full bg-eucalyptus px-4 text-sm font-medium text-white hover:bg-eucalyptus-deep disabled:opacity-50"
              disabled={pending || tables.length === 0}
              onClick={() =>
                start(async () => {
                  setMessage(null);
                  const r = await autoSeat(eventId);
                  if (r.error) setMessage(r.error);
                  else {
                    setProblems(r.problems ?? []);
                    setMessage(
                      r.unseated
                        ? `Posazeno ${r.seated} hostů, ${r.unseated} potvrzených se nevešlo.`
                        : `Návrh hotový: posazeno ${r.seated} hostů${r.pendingUnseated ? `, ${r.pendingUnseated} bez odpovědi zatím nemá místo` : ""}. Upravte ho podle sebe.`,
                    );
                  }
                })
              }
            >
              {pending ? "Počítám…" : "Navrhnout rozsazení"}
            </button>
            <button type="button" className={btn} disabled={pending || assignments.length === 0} onClick={() => start(async () => { await clearSeating(eventId); setAssignments((a) => a.filter((x) => x.locked)); })}>
              Vyprázdnit stoly
            </button>
          </>
        ) : null}
        <a href={`/app/zasedaci-poradek/tisk?udalost=${eventId}`} target="_blank" rel="noreferrer" className={`${btn} inline-flex items-center`}>
          Tisk a seznamy
        </a>
        <span className="ml-auto text-sm text-ink-soft tabular-nums">
          Potvrzení: posazeno {seatedConfirmed} z {attendingCount}
          {pendingCount ? `, bez odpovědi ${pendingCount}` : ""}, míst {capacity}
        </span>
      </div>

      {message ? <p role="status" className="rounded-lg bg-eucalyptus-mist px-3.5 py-2 text-sm text-eucalyptus-deep">{message}</p> : null}
      {problems.length ? (
        <ul className="flex flex-col gap-1 rounded-lg bg-plum/8 px-3.5 py-2 text-sm text-plum">
          {problems.map((p, i) => (
            <li key={i}>{p.message}</li>
          ))}
        </ul>
      ) : null}
      {declined.length ? (
        <p className="rounded-lg bg-plum/8 px-3.5 py-2 text-sm text-plum">
          Mezitím odmítli účast, ale sedí u stolu: {declined.map((a) => guestById.get(a.guest_id)?.name).join(", ")}.{" "}
          {canEdit ? <button type="button" className="font-medium underline" onClick={() => unseat(declined.map((a) => a.guest_id))}>Uvolnit jejich místa</button> : null}
        </p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        {/* Plátno */}
        <div ref={wrap} className="relative overflow-hidden rounded-2xl border border-line bg-surface">
          <svg
            ref={svg}
            viewBox={`0 0 ${data.layout.width} ${data.layout.height}`}
            className="block h-auto w-full touch-none select-none"
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerDown={() => {
              setSelected(null);
              setChair(null);
            }}
            role="application"
            aria-label="Plán sálu. Stoly přesunete tažením nebo šipkami."
          >
            <defs>
              <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                <circle cx="1" cy="1" r="1.5" fill="#d9e1dc" />
              </pattern>
            </defs>
            <rect width={data.layout.width} height={data.layout.height} fill="url(#grid)" />
            {bgUrl ? <image href={bgUrl} width={data.layout.width} height={data.layout.height} preserveAspectRatio="xMidYMid meet" opacity={0.45} /> : null}

            {items.map((item) => {
              const seatedHere = byTable.get(item.id) ?? [];
              const over = item.kind === "table" && seatedHere.length > item.seats;
              const isSel = item.id === selected;
              const seats = item.kind === "table" ? seatPositions(item.shape as ShapeId, item.w, item.h, item.seats) : [];
              const { chairs } = seatMap(item.kind === "table" ? item.seats : 0, seatedHere);
              const target = item.kind === "table" && picked.length > 0;
              return (
                <g
                  key={item.id}
                  transform={`translate(${item.x} ${item.y}) rotate(${item.rotation})`}
                  onPointerDown={(e) => onItemPointerDown(e, item)}
                  onDragOver={(e) => item.kind === "table" && e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const ids = JSON.parse(e.dataTransfer.getData("application/x-guests") || "[]") as string[];
                    if (item.kind === "table") seat(item.id, ids);
                  }}
                  onKeyDown={(e) => onItemKey(e, item)}
                  tabIndex={0}
                  role="button"
                  aria-label={item.kind === "table" ? `${item.label}, ${seatedHere.length} z ${item.seats} míst` : item.label ?? "prvek"}
                  className={`outline-none ${canEdit ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"}`}
                >
                  {seats.map((p, i) => {
                    const guestId = chairs[i];
                    const g = guestId ? guestById.get(guestId) : null;
                    const open = chair?.tableId === item.id && chair.index === i;
                    const fill = !g ? "#ffffff" : g.status === "yes" ? "#4f7263" : g.status === "pending" ? "#dfe9e3" : "#f3e3ea";
                    return (
                      <g
                        key={i}
                        transform={`translate(${p.x} ${p.y})`}
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={(e) => openChair(e, item.id, i)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            openChair(e, item.id, i);
                          }
                        }}
                        tabIndex={0}
                        role="button"
                        aria-label={g ? `Židle ${i + 1}: ${g.name}` : `Židle ${i + 1}: volná`}
                        className="cursor-pointer outline-none [&:focus-visible>circle]:stroke-[5]"
                      >
                        <circle
                          r={28}
                          fill={fill}
                          stroke={open ? "#1e2b26" : g ? (g.status === "no" ? "#7b3f5c" : "#3c5a4d") : "#9fb1a8"}
                          strokeWidth={open ? 4 : 2}
                          strokeDasharray={g?.status === "pending" ? "4 3" : undefined}
                        />
                        <g transform={`rotate(${-item.rotation})`}>
                          {g ? (
                            <text textAnchor="middle" dy={7} fontSize={20} fontWeight={600} fill={g.status === "yes" ? "#ffffff" : "#1e2b26"} pointerEvents="none">
                              {initials(g.name)}
                            </text>
                          ) : (
                            <text textAnchor="middle" dy={9} fontSize={26} fill="#9fb1a8" pointerEvents="none">+</text>
                          )}
                        </g>
                      </g>
                    );
                  })}
                  <ShapeOutline
                    shape={item.shape as ShapeId}
                    w={item.w}
                    h={item.h}
                    style={{
                      fill: item.kind === "decor" ? "#f5f7f5" : target ? "#e3ece7" : "#ffffff",
                      stroke: over ? "#a33a2f" : isSel ? "#4f7263" : "#9fb1a8",
                      strokeWidth: isSel || over ? 4 : 2,
                      strokeDasharray: item.kind === "decor" ? "8 6" : undefined,
                    }}
                  />
                  <g transform={`rotate(${-item.rotation})`}>
                    <text textAnchor="middle" dy={item.kind === "table" ? -2 : 8} fontSize={26} fontWeight={600} fill="#1e2b26">
                      {item.label}
                    </text>
                    {item.kind === "table" ? (
                      <text textAnchor="middle" dy={26} fontSize={21} fill={over ? "#a33a2f" : "#4a5a53"}>
                        {seatedHere.length}/{item.seats}
                      </text>
                    ) : null}
                  </g>
                </g>
              );
            })}

            {items.length === 0 ? (
              <text x={data.layout.width / 2} y={data.layout.height / 2} textAnchor="middle" fontSize={28} fill="#4a5a53">
                {canEdit ? "Začněte tlačítkem Přidat stůl" : "Zasedací pořádek je zatím prázdný"}
              </text>
            ) : null}
          </svg>
          {chair ? (
            <ChairPopover
              key={`${chair.tableId}-${chair.index}`}
              left={chair.left}
              top={chair.top}
              tableLabel={items.find((i) => i.id === chair.tableId)?.label ?? "Stůl"}
              index={chair.index}
              occupant={(() => {
                const t = items.find((i) => i.id === chair.tableId);
                const id = t ? seatMap(t.seats, byTable.get(t.id) ?? []).chairs[chair.index] : null;
                return id ? guestById.get(id) ?? null : null;
              })()}
              candidates={data.guests.filter((g) => g.status !== "no")}
              seatedIds={seatedIds}
              canEdit={canEdit}
              onSeat={(guestId) => seatOnChair(chair.tableId, chair.index, guestId)}
              onFree={(guestId) => {
                unseat([guestId]);
                setChair(null);
              }}
              onClose={() => setChair(null)}
            />
          ) : null}
        </div>

        {/* Panel */}
        <aside className="flex max-h-[44rem] flex-col gap-3 overflow-hidden rounded-2xl border border-line bg-surface p-4">
          {selectedItem ? (
            <ItemPanel
              item={selectedItem}
              seated={(byTable.get(selectedItem.id) ?? []).map((a) => ({ ...a, guest: guestById.get(a.guest_id) }))}
              canEdit={canEdit}
              picked={picked.length}
              onSeatPicked={() => seat(selectedItem.id, picked)}
              onChange={(patch, delay) => update(selectedItem.id, patch, delay)}
              onDelete={() => removeItem(selectedItem.id)}
              onUnseat={(id) => unseat([id])}
              onLock={(id, locked) => {
                setAssignments((list) => list.map((a) => (a.guest_id === id ? { ...a, locked } : a)));
                start(() => setLocked(eventId, id, locked));
              }}
              onClose={() => setSelected(null)}
            />
          ) : (
            <>
              <div className="flex gap-1">
                {(["guests", "rules"] as const).map((p) => (
                  <button key={p} type="button" onClick={() => setPanel(p)} aria-pressed={panel === p} className={`rounded-full px-3 py-1.5 text-sm ${panel === p ? "bg-ink text-white" : "text-ink-soft hover:text-ink"}`}>
                    {p === "guests" ? `Neposazení (${unseated.length})` : `Pravidla (${data.rules.length})`}
                  </button>
                ))}
              </div>

              {panel === "guests" ? (
                <>
                  <div className="flex gap-2">
                    <input type="search" placeholder="Hledat" value={search} onChange={(e) => setSearch(e.target.value)} className={`${input} min-w-0 flex-1`} aria-label="Hledat hosta" />
                    {data.tags.length ? (
                      <select value={tag} onChange={(e) => setTag(e.target.value)} className={`${input} w-28`} aria-label="Štítek">
                        <option value="">Štítek</option>
                        {data.tags.map((t) => (
                          <option key={t}>{t}</option>
                        ))}
                      </select>
                    ) : null}
                  </div>
                  {picked.length ? (
                    <p className="rounded-lg bg-eucalyptus-mist px-3 py-2 text-sm text-eucalyptus-deep">
                      Vybráno {picked.length}. Klepněte na stůl. <button type="button" className="underline" onClick={() => setPicked([])}>Zrušit</button>
                    </p>
                  ) : (
                    <p className="text-sm text-ink-soft">Přetáhněte hosta na stůl, nebo ho vyberte a klepněte na stůl.</p>
                  )}
                  <ul className="-mx-1 flex flex-col gap-2 overflow-y-auto px-1">
                    {households.map((members) => {
                      const ids = members.map((m) => m.id);
                      const allPicked = ids.every((id) => picked.includes(id));
                      return (
                        <li
                          key={members[0].household_id}
                          draggable={canEdit}
                          onDragStart={(e) => e.dataTransfer.setData("application/x-guests", JSON.stringify(ids))}
                          className="rounded-xl border border-line p-2"
                        >
                          <button
                            type="button"
                            disabled={!canEdit}
                            onClick={() => setPicked((p) => (allPicked ? p.filter((x) => !ids.includes(x)) : [...new Set([...p, ...ids])]))}
                            className={`flex w-full items-center justify-between rounded-lg px-2 py-1 text-left text-sm font-medium ${allPicked ? "bg-eucalyptus-mist" : "hover:bg-paper"}`}
                          >
                            {members[0].household}
                            <span className="text-xs font-normal text-ink-soft">{members.length > 1 ? `celá domácnost (${members.length})` : ""}</span>
                          </button>
                          {members.length > 1
                            ? members.map((g) => (
                                <GuestChip key={g.id} guest={g} picked={picked.includes(g.id)} canEdit={canEdit} onToggle={() => setPicked((p) => (p.includes(g.id) ? p.filter((x) => x !== g.id) : [...p, g.id]))} />
                              ))
                            : <GuestMeta guest={members[0]} />}
                        </li>
                      );
                    })}
                    {households.length === 0 ? <li className="text-sm text-ink-soft">{unseated.length ? "Nic neodpovídá filtru." : "Všichni potvrzení hosté sedí."}</li> : null}
                  </ul>
                </>
              ) : (
                <RulesPanel data={data} tables={tables} canEdit={canEdit} eventId={eventId} />
              )}
            </>
          )}
        </aside>
      </div>
    </div>
  );
}

function GuestMeta({ guest }: { guest: SeatingGuest }) {
  const meta = [guest.status === "pending" ? "čeká na odpověď" : null, guest.category && guest.category !== "Dospělý" ? guest.category : null, guest.diet, guest.allergies ? `alergie: ${guest.allergies}` : null, guest.high_chair ? "židlička" : null, ...guest.tags].filter(Boolean);
  return meta.length ? <p className="px-2 text-xs text-ink-soft">{meta.join(", ")}</p> : null;
}

function GuestChip({ guest, picked, canEdit, onToggle }: { guest: SeatingGuest; picked: boolean; canEdit: boolean; onToggle: () => void }) {
  return (
    <div
      draggable={canEdit}
      onDragStart={(e) => {
        e.stopPropagation();
        e.dataTransfer.setData("application/x-guests", JSON.stringify([guest.id]));
      }}
    >
      <button type="button" disabled={!canEdit} onClick={onToggle} className={`flex w-full flex-col rounded-lg px-2 py-1 text-left text-sm ${picked ? "bg-eucalyptus-mist" : "hover:bg-paper"}`}>
        {guest.name}
      </button>
      <GuestMeta guest={guest} />
    </div>
  );
}

function ItemPanel({
  item,
  seated,
  canEdit,
  picked,
  onSeatPicked,
  onChange,
  onDelete,
  onUnseat,
  onLock,
  onClose,
}: {
  item: LayoutItem;
  seated: (Assignment & { guest?: SeatingGuest })[];
  canEdit: boolean;
  picked: number;
  onSeatPicked: () => void;
  onChange: (patch: Partial<LayoutItem>, delay?: number) => void;
  onDelete: () => void;
  onUnseat: (id: string) => void;
  onLock: (id: string, locked: boolean) => void;
  onClose: () => void;
}) {
  return (
    <div className="flex min-h-0 flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="font-medium">{item.kind === "table" ? "Stůl" : "Prvek"}</h2>
        <button type="button" onClick={onClose} className="text-sm text-ink-soft hover:text-ink">Hotovo</button>
      </div>
      <fieldset disabled={!canEdit} className="grid grid-cols-2 gap-3">
        <label className="col-span-2 flex flex-col gap-1 text-sm">
          Název
          <input value={item.label ?? ""} maxLength={40} onChange={(e) => onChange({ label: e.target.value }, 600)} className={input} />
        </label>
        {item.kind === "table" ? (
          <label className="flex flex-col gap-1 text-sm">
            Míst
            <input type="number" min={1} max={200} value={item.seats} onChange={(e) => onChange({ seats: Math.max(0, Math.min(200, Number(e.target.value) || 0)) }, 600)} className={input} />
          </label>
        ) : null}
        <label className="flex flex-col gap-1 text-sm">
          Otočení
          <span className="flex gap-1">
            <button type="button" className={`${input} flex-1`} onClick={() => onChange({ rotation: (item.rotation - 15) % 360 }, 300)} aria-label="Otočit doleva">↺</button>
            <button type="button" className={`${input} flex-1`} onClick={() => onChange({ rotation: (item.rotation + 15) % 360 }, 300)} aria-label="Otočit doprava">↻</button>
          </span>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Šířka
          <input type="number" min={40} max={1500} step={10} value={Math.round(item.w)} onChange={(e) => onChange({ w: Math.max(40, Number(e.target.value) || 40), ...(item.shape === "round" ? { h: Math.max(40, Number(e.target.value) || 40) } : {}) }, 600)} className={input} />
        </label>
        {item.shape !== "round" ? (
          <label className="flex flex-col gap-1 text-sm">
            Výška
            <input type="number" min={30} max={1500} step={10} value={Math.round(item.h)} onChange={(e) => onChange({ h: Math.max(30, Number(e.target.value) || 30) }, 600)} className={input} />
          </label>
        ) : null}
      </fieldset>

      {item.kind === "table" ? (
        <div className="flex min-h-0 flex-col gap-2">
          <h3 className="text-sm font-medium">
            Sedí tu {seated.length} z {item.seats}
            {seated.length > item.seats ? <span className="text-danger">, přeplněno</span> : null}
          </h3>
          {picked && canEdit ? (
            <button type="button" onClick={onSeatPicked} className="h-9 rounded-full bg-eucalyptus text-sm font-medium text-white">Posadit vybrané ({picked})</button>
          ) : null}
          <ul className="flex flex-col divide-y divide-line overflow-y-auto">
            {seated.map((a) => (
              <li key={a.guest_id} className="flex items-center gap-2 py-2 text-sm">
                <span className="flex-1">
                  {a.guest?.name ?? "Host"}
                  {a.guest?.status === "no" ? <span className="text-plum">, odmítl účast</span> : a.guest?.status === "pending" ? <span className="text-ink-soft">, čeká na odpověď</span> : null}
                  {a.guest?.diet || a.guest?.allergies ? <span className="block text-xs text-ink-soft">{[a.guest.diet, a.guest.allergies].filter(Boolean).join(", ")}</span> : null}
                </span>
                {canEdit ? (
                  <>
                    <button type="button" onClick={() => onLock(a.guest_id, !a.locked)} aria-pressed={a.locked} title={a.locked ? "Zamčeno, návrh ho nepřesune" : "Zamknout na místě"} className={`rounded-full px-2 py-0.5 text-xs ${a.locked ? "bg-ink text-white" : "border border-line text-ink-soft"}`}>
                      {a.locked ? "Zamčeno" : "Zamknout"}
                    </button>
                    <button type="button" onClick={() => onUnseat(a.guest_id)} className="text-xs text-ink-soft hover:text-danger">Odebrat</button>
                  </>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {canEdit ? (
        <button type="button" onClick={onDelete} className="mt-auto self-start text-sm text-ink-soft hover:text-danger">
          Smazat {item.kind === "table" ? "stůl" : "prvek"}
        </button>
      ) : null}
    </div>
  );
}

function RulesPanel({ data, tables, canEdit, eventId }: { data: SeatingData; tables: LayoutItem[]; canEdit: boolean; eventId: string }) {
  const [kind, setKind] = useState<"together" | "apart" | "fixed_table">("together");
  const [chosen, setChosen] = useState<string[]>([]);
  const [tableId, setTableId] = useState("");
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const name = new Map(data.guests.map((g) => [g.id, g.name]));
  const tableName = new Map(tables.map((t) => [t.id, t.label ?? "stůl"]));
  const label = { together: "Sedí spolu", apart: "Nesedí spolu", fixed_table: "Pevný stůl" };
  const filtered = data.guests.filter((g) => g.status !== "no" && (!search || g.name.toLowerCase().includes(search.toLowerCase())));

  return (
    <div className="flex min-h-0 flex-col gap-3">
      <ul className="flex flex-col gap-2 text-sm">
        {data.rules.map((r) => (
          <li key={r.id} className="flex items-start justify-between gap-2 rounded-lg bg-paper px-3 py-2">
            <span>
              <span className="font-medium">{label[r.kind]}</span>
              {r.kind === "fixed_table" ? `: ${tableName.get(r.table_id ?? "") ?? "stůl"}` : ""}
              <span className="block text-ink-soft">{r.guest_ids.map((id) => name.get(id) ?? "?").join(", ")}</span>
            </span>
            {canEdit ? (
              <button type="button" onClick={() => start(() => deleteRule(r.id))} className="text-xs text-ink-soft hover:text-danger">Smazat</button>
            ) : null}
          </li>
        ))}
        {data.rules.length === 0 ? <li className="text-ink-soft">Pravidla hlídá návrh rozsazení. Domácnosti sedí spolu vždy.</li> : null}
      </ul>

      {canEdit ? (
        <form
          className="flex min-h-0 flex-col gap-2 border-t border-line pt-3"
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            start(async () => {
              const r = await addRule(eventId, { kind, guest_ids: chosen, table_id: kind === "fixed_table" ? tableId || null : null });
              if (r.error) setError(r.error);
              else {
                setChosen([]);
                setSearch("");
              }
            });
          }}
        >
          <select value={kind} onChange={(e) => setKind(e.target.value as typeof kind)} className={input} aria-label="Druh pravidla">
            <option value="together">Mají sedět spolu</option>
            <option value="apart">Nemají sedět spolu</option>
            <option value="fixed_table">Mají sedět u stolu…</option>
          </select>
          {kind === "fixed_table" ? (
            <select value={tableId} onChange={(e) => setTableId(e.target.value)} className={input} aria-label="Stůl">
              <option value="">Vyberte stůl</option>
              {tables.map((t) => (
                <option key={t.id} value={t.id}>{t.label}</option>
              ))}
            </select>
          ) : null}
          <input type="search" placeholder="Najít hosta" value={search} onChange={(e) => setSearch(e.target.value)} className={input} aria-label="Najít hosta" />
          <ul className="flex max-h-48 flex-col overflow-y-auto rounded-lg border border-line">
            {filtered.slice(0, 50).map((g) => (
              <li key={g.id}>
                <label className="flex items-center gap-2 px-2.5 py-1.5 text-sm hover:bg-paper">
                  <input type="checkbox" checked={chosen.includes(g.id)} onChange={(e) => setChosen((c) => (e.target.checked ? [...c, g.id] : c.filter((x) => x !== g.id)))} className="accent-eucalyptus" />
                  {g.name}
                </label>
              </li>
            ))}
          </ul>
          {error ? <p className="text-sm text-danger">{error}</p> : null}
          <button type="submit" disabled={pending || chosen.length === 0} className="h-9 rounded-full bg-eucalyptus text-sm font-medium text-white disabled:opacity-50">
            Přidat pravidlo{chosen.length ? ` (${chosen.length})` : ""}
          </button>
        </form>
      ) : null}
    </div>
  );
}

function ChairPopover({
  left,
  top,
  tableLabel,
  index,
  occupant,
  candidates,
  seatedIds,
  canEdit,
  onSeat,
  onFree,
  onClose,
}: {
  left: number;
  top: number;
  tableLabel: string;
  index: number;
  occupant: SeatingGuest | null;
  candidates: SeatingGuest[];
  seatedIds: Set<string>;
  canEdit: boolean;
  onSeat: (guestId: string) => void;
  onFree: (guestId: string) => void;
  onClose: () => void;
}) {
  const [choosing, setChoosing] = useState(!occupant);
  const [query, setQuery] = useState("");
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Okno se nesmí vysunout z plátna
  const [pos, setPos] = useState({ left, top });
  useEffect(() => {
    const el = box.current;
    const parent = el?.parentElement;
    if (!el || !parent) return;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    const maxLeft = parent.clientWidth - w / 2 - 8;
    const nextLeft = Math.max(w / 2 + 8, Math.min(left, maxLeft));
    const nextTop = top + h > parent.clientHeight - 8 ? Math.max(8, top - h - 56) : top;
    setPos({ left: nextLeft, top: nextTop });
  }, [left, top, choosing]);

  const needle = query.trim().toLowerCase();
  const match = (g: SeatingGuest) => !needle || g.name.toLowerCase().includes(needle) || g.household.toLowerCase().includes(needle);
  const free = candidates.filter((g) => !seatedIds.has(g.id) && match(g)).sort((a, b) => Number(b.status === "yes") - Number(a.status === "yes"));
  const elsewhere = candidates.filter((g) => seatedIds.has(g.id) && g.id !== occupant?.id && match(g));

  const status = (g: SeatingGuest) => (g.status === "pending" ? "čeká na odpověď" : g.status === "no" ? "odmítl účast" : null);

  return (
    <div
      ref={box}
      role="dialog"
      aria-label={`${tableLabel}, židle ${index + 1}`}
      onPointerDown={(e) => e.stopPropagation()}
      style={{ left: pos.left, top: pos.top }}
      className="absolute z-30 flex w-72 -translate-x-1/2 flex-col gap-3 rounded-2xl border border-line bg-surface p-4 shadow-[0_16px_40px_-12px_rgba(30,43,38,0.35)]"
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-medium">
          {tableLabel}, židle {index + 1}
        </h3>
        <button type="button" onClick={onClose} aria-label="Zavřít" className="size-8 rounded-full text-lg text-ink-soft hover:bg-paper hover:text-ink">
          ×
        </button>
      </div>

      {occupant ? (
        <div className="flex flex-col gap-2 rounded-xl bg-paper px-3 py-2.5">
          <span className="font-medium">{occupant.name}</span>
          <span className="text-sm text-ink-soft">
            {[occupant.household !== occupant.name ? occupant.household : null, status(occupant), occupant.diet, occupant.allergies ? `alergie: ${occupant.allergies}` : null]
              .filter(Boolean)
              .join(", ") || "Potvrdil účast"}
          </span>
          {canEdit && !choosing ? (
            <div className="flex gap-2 pt-1">
              <button type="button" onClick={() => setChoosing(true)} className="h-9 flex-1 rounded-full bg-eucalyptus text-sm font-medium text-white hover:bg-eucalyptus-deep">
                Vyměnit hosta
              </button>
              <button type="button" onClick={() => onFree(occupant.id)} className="h-9 flex-1 rounded-full border border-line text-sm font-medium hover:border-danger hover:text-danger">
                Uvolnit místo
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      {canEdit && choosing ? (
        <div className="flex min-h-0 flex-col gap-2">
          <input
            autoFocus
            type="search"
            placeholder="Najít hosta"
            aria-label="Najít hosta"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-10 rounded-lg border border-line bg-surface px-3 text-[15px] focus:border-eucalyptus focus:outline-none"
          />
          <ul className="flex max-h-64 flex-col overflow-y-auto">
            {free.map((g) => (
              <li key={g.id}>
                <button type="button" onClick={() => onSeat(g.id)} className="flex w-full flex-col rounded-lg px-2.5 py-2 text-left hover:bg-eucalyptus-mist">
                  <span className="text-[15px]">{g.name}</span>
                  <span className="text-xs text-ink-soft">{[g.household !== g.name ? g.household : null, status(g)].filter(Boolean).join(", ")}</span>
                </button>
              </li>
            ))}
            {elsewhere.length ? <li className="px-2.5 pb-1 pt-3 text-xs text-ink-soft">Už sedí jinde, přesadit sem</li> : null}
            {elsewhere.map((g) => (
              <li key={g.id}>
                <button type="button" onClick={() => onSeat(g.id)} className="flex w-full flex-col rounded-lg px-2.5 py-2 text-left text-ink-soft hover:bg-eucalyptus-mist hover:text-ink">
                  <span className="text-[15px]">{g.name}</span>
                </button>
              </li>
            ))}
            {free.length === 0 && elsewhere.length === 0 ? <li className="px-2.5 py-2 text-sm text-ink-soft">Nikdo neodpovídá hledání.</li> : null}
          </ul>
        </div>
      ) : null}
      {!canEdit && !occupant ? <p className="text-sm text-ink-soft">Židle je volná.</p> : null}
    </div>
  );
}
