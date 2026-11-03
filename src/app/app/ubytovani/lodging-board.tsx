"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { GuestPickerPopover } from "@/components/guest-picker-popover";
import type { LodgingData, LodgingGuest, Room } from "@/lib/lodging-data";
import { initials } from "@/lib/seating";
import { assignRoom, deleteLodging, deleteRoom, unassignRoom } from "./actions";
import { LodgingForm, RoomForm } from "./lodging-forms";

type Assignment = LodgingData["assignments"][number];
type Editing = { kind: "lodging"; id: string | null } | { kind: "room"; lodgingId: string; id: string | null } | null;

const money = (v: number, c: string) => new Intl.NumberFormat("cs-CZ", { style: "currency", currency: c, maximumFractionDigits: 0 }).format(v);

export function LodgingBoard({ data, canEdit }: { data: LodgingData; canEdit: boolean }) {
  const [assignments, setAssignments] = useState<Assignment[]>(data.assignments);
  const [editing, setEditing] = useState<Editing>(data.lodgings.length === 0 && canEdit ? { kind: "lodging", id: null } : null);
  const [picked, setPicked] = useState<string[]>([]);
  const [onlyWanting, setOnlyWanting] = useState(true);
  const [bed, setBed] = useState<{ roomId: string; left: number; top: number; occupant: string | null } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [, start] = useTransition();
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => setAssignments(data.assignments), [data.assignments]);

  const guestById = useMemo(() => new Map(data.guests.map((g) => [g.id, g])), [data.guests]);
  const roomById = useMemo(() => new Map(data.lodgings.flatMap((l) => l.rooms.map((r) => [r.id, { ...r, lodging: l.name }] as const))), [data.lodgings]);
  const roomOf = useMemo(() => new Map(assignments.map((a) => [a.guest_id, a.room_id])), [assignments]);
  const inRoom = (roomId: string) => assignments.filter((a) => a.room_id === roomId).map((a) => a.guest_id);

  const candidates = data.guests.filter((g) => g.attending);
  const wanting = candidates.filter((g) => g.wants);
  const unassigned = candidates.filter((g) => !roomOf.has(g.id) && (!onlyWanting || g.wants));
  const households = useMemo(() => {
    const m = new Map<string, LodgingGuest[]>();
    for (const g of unassigned) m.set(g.household_id, [...(m.get(g.household_id) ?? []), g]);
    return [...m.values()];
  }, [unassigned]);

  const closeEditing = useCallback(() => setEditing(null), []);

  function place(roomId: string, guestIds: string[]) {
    if (!canEdit || !guestIds.length) return;
    setAssignments((list) => [...list.filter((a) => !guestIds.includes(a.guest_id)), ...guestIds.map((guest_id) => ({ guest_id, room_id: roomId }))]);
    setPicked([]);
    setBed(null);
    start(async () => {
      const r = await assignRoom(roomId, guestIds);
      if (r.error) setError(r.error);
    });
  }

  function free(guestIds: string[]) {
    setAssignments((list) => list.filter((a) => !guestIds.includes(a.guest_id)));
    setBed(null);
    start(() => unassignRoom(guestIds));
  }

  function openBed(e: React.MouseEvent, roomId: string, occupant: string | null) {
    e.stopPropagation();
    const box = wrap.current!.getBoundingClientRect();
    const t = e.currentTarget.getBoundingClientRect();
    setBed({ roomId, occupant, left: t.left + t.width / 2 - box.left, top: t.bottom - box.top + 8 });
  }

  const detail = (g: LodgingGuest) => {
    const parts = [g.household !== g.name ? g.household : null];
    const r = roomOf.get(g.id);
    if (r) parts.push(`teď: ${roomById.get(r)?.name ?? "pokoj"}`);
    else if (g.wants === false) parts.push("ubytování nepotřebuje");
    else if (g.wants === null) parts.push("k ubytování se nevyjádřil");
    return parts.filter(Boolean).join(", ");
  };

  const placed = wanting.filter((g) => roomOf.has(g.id)).length;
  const beds = data.lodgings.reduce((n, l) => n + l.rooms.reduce((m, r) => m + r.capacity, 0), 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        {canEdit ? (
          <button type="button" onClick={() => setEditing({ kind: "lodging", id: null })} className="h-10 rounded-full bg-eucalyptus px-5 text-sm font-medium text-white hover:bg-eucalyptus-deep">
            Přidat ubytování
          </button>
        ) : null}
        <a href="/app/ubytovani/tisk" target="_blank" rel="noreferrer" className="inline-flex h-10 items-center rounded-full border border-line bg-surface px-5 text-sm font-medium hover:border-eucalyptus">
          Seznam pro ubytovatele
        </a>
        <span className="ml-auto text-sm tabular-nums text-ink-soft">
          Ubytováno {placed} z {wanting.length}, kteří o ubytování stojí, lůžek {beds}
        </span>
      </div>
      {error ? <p role="alert" className="rounded-lg bg-danger/8 px-3.5 py-2 text-sm text-danger">{error}</p> : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div ref={wrap} className="relative flex flex-col gap-8">
          {editing?.kind === "lodging" && editing.id === null ? <LodgingForm lodging={null} onDone={closeEditing} /> : null}

          {data.lodgings.map((l) => (
            <section key={l.id} className="flex flex-col gap-4">
              {editing?.kind === "lodging" && editing.id === l.id ? (
                <LodgingForm lodging={l} onDone={closeEditing} />
              ) : (
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div className="flex flex-col">
                    <h2 className="font-serif text-2xl tracking-tight">{l.name}</h2>
                    <p className="text-sm text-ink-soft">
                      {[l.address, l.check_in_info.cs].filter(Boolean).join(". ")}
                    </p>
                  </div>
                  {canEdit ? (
                    <div className="flex gap-3 text-sm">
                      <button type="button" onClick={() => setEditing({ kind: "lodging", id: l.id })} className="text-ink-soft hover:text-ink">Upravit</button>
                      {confirmDelete === l.id ? (
                        <span className="flex gap-2">
                          Smazat i pokoje?
                          <button type="button" onClick={() => start(() => deleteLodging(l.id))} className="font-medium text-danger underline">Ano</button>
                          <button type="button" onClick={() => setConfirmDelete(null)} className="text-ink-soft underline">Ne</button>
                        </span>
                      ) : (
                        <button type="button" onClick={() => setConfirmDelete(l.id)} className="text-ink-soft hover:text-danger">Smazat</button>
                      )}
                    </div>
                  ) : null}
                </div>
              )}

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {l.rooms.map((r) =>
                  editing?.kind === "room" && editing.id === r.id ? (
                    <RoomForm key={r.id} lodgingId={l.id} room={r} onDone={closeEditing} />
                  ) : (
                    <RoomCard
                      key={r.id}
                      room={r}
                      guests={inRoom(r.id).map((id) => guestById.get(id)).filter((g): g is LodgingGuest => !!g)}
                      target={picked.length > 0}
                      canEdit={canEdit}
                      onDropGuests={(ids) => place(r.id, ids)}
                      onPlacePicked={() => place(r.id, picked)}
                      onBed={(e, occupant) => openBed(e, r.id, occupant)}
                      onEdit={() => setEditing({ kind: "room", lodgingId: l.id, id: r.id })}
                      onDelete={() => start(() => deleteRoom(r.id))}
                    />
                  ),
                )}
                {editing?.kind === "room" && editing.lodgingId === l.id && editing.id === null ? (
                  <RoomForm lodgingId={l.id} room={null} onDone={closeEditing} />
                ) : canEdit ? (
                  <button
                    type="button"
                    onClick={() => setEditing({ kind: "room", lodgingId: l.id, id: null })}
                    className="flex min-h-36 items-center justify-center rounded-2xl border border-dashed border-ink-soft/40 text-sm text-ink-soft hover:border-eucalyptus hover:text-eucalyptus-deep"
                  >
                    Přidat pokoj
                  </button>
                ) : null}
              </div>
            </section>
          ))}

          {data.lodgings.length === 0 && !editing ? (
            <p className="text-ink-soft">Zatím tu není žádné ubytování.</p>
          ) : null}

          {bed ? (
            <GuestPickerPopover
              key={`${bed.roomId}-${bed.occupant}`}
              left={bed.left}
              top={bed.top}
              title={`${roomById.get(bed.roomId)?.name ?? "Pokoj"}, ${roomById.get(bed.roomId)?.lodging ?? ""}`}
              occupant={bed.occupant ? { id: bed.occupant, name: guestById.get(bed.occupant)?.name ?? "", detail: guestById.get(bed.occupant)?.household } : null}
              candidates={candidates
                .filter((g) => roomOf.get(g.id) !== bed.roomId)
                .sort((a, b) => Number(!!b.wants) - Number(!!a.wants))
                .map((g) => ({ id: g.id, name: g.name, detail: detail(g), elsewhere: roomOf.has(g.id) }))}
              canEdit={canEdit}
              elsewhereLabel="Už má jiný pokoj, přestěhovat sem"
              onPick={(guestId) => {
                if (bed.occupant) free([bed.occupant]);
                place(bed.roomId, [guestId]);
              }}
              onFree={(guestId) => free([guestId])}
              onClose={() => setBed(null)}
            />
          ) : null}
        </div>

        <aside className="flex max-h-[44rem] flex-col gap-3 overflow-hidden rounded-2xl bg-surface shadow-card ring-1 ring-line/70 p-4 lg:sticky lg:top-6">
          <div className="flex gap-1">
            {[
              [true, `Chtějí ubytování`],
              [false, "Všichni hosté"],
            ].map(([value, text]) => (
              <button key={String(value)} type="button" onClick={() => setOnlyWanting(value as boolean)} aria-pressed={onlyWanting === value} className={`rounded-full px-3 py-1.5 text-sm ${onlyWanting === value ? "bg-ink text-white" : "text-ink-soft hover:text-ink"}`}>
                {text as string}
              </button>
            ))}
          </div>
          {picked.length ? (
            <p className="rounded-lg bg-eucalyptus-mist px-3 py-2 text-sm text-eucalyptus-deep">
              Vybráno {picked.length}. Klepněte na pokoj. <button type="button" className="underline" onClick={() => setPicked([])}>Zrušit</button>
            </p>
          ) : (
            <p className="text-sm text-ink-soft">Přetáhněte domácnost na pokoj, nebo klepněte na volné lůžko.</p>
          )}
          <ul className="-mx-1 flex flex-col gap-2 overflow-y-auto px-1">
            {households.map((members) => {
              const ids = members.map((m) => m.id);
              const all = ids.every((id) => picked.includes(id));
              return (
                <li key={members[0].household_id} draggable={canEdit} onDragStart={(e) => e.dataTransfer.setData("application/x-guests", JSON.stringify(ids))} className="rounded-xl border border-line p-2">
                  <button
                    type="button"
                    disabled={!canEdit}
                    onClick={() => setPicked((p) => (all ? p.filter((x) => !ids.includes(x)) : [...new Set([...p, ...ids])]))}
                    className={`flex w-full flex-col rounded-lg px-2 py-1 text-left ${all ? "bg-eucalyptus-mist" : "hover:bg-paper"}`}
                  >
                    <span className="text-sm font-medium">{members[0].household}</span>
                    <span className="text-xs text-ink-soft">
                      {members.length > 1 ? `${members.length} osob` : members[0].name}
                      {members[0].note ? `, ${members[0].note}` : ""}
                    </span>
                  </button>
                </li>
              );
            })}
            {households.length === 0 ? (
              <li className="text-sm text-ink-soft">{onlyWanting ? (wanting.length ? "Všichni, kdo chtěli ubytování, mají pokoj." : "Zatím nikdo v odpovědi o ubytování nepožádal.") : "Všichni hosté mají pokoj."}</li>
            ) : null}
          </ul>
        </aside>
      </div>
    </div>
  );
}

function RoomCard({
  room,
  guests,
  target,
  canEdit,
  onDropGuests,
  onPlacePicked,
  onBed,
  onEdit,
  onDelete,
}: {
  room: Room;
  guests: LodgingGuest[];
  target: boolean;
  canEdit: boolean;
  onDropGuests: (ids: string[]) => void;
  onPlacePicked: () => void;
  onBed: (e: React.MouseEvent, occupant: string | null) => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const over = guests.length > room.capacity;
  const slots = Math.max(room.capacity, guests.length);
  return (
    <div
      onDragOver={(e) => canEdit && e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        onDropGuests(JSON.parse(e.dataTransfer.getData("application/x-guests") || "[]"));
      }}
      onClick={() => target && onPlacePicked()}
      className={`flex flex-col gap-3 rounded-2xl border bg-surface p-4 transition-colors ${over ? "border-danger" : target ? "cursor-pointer border-eucalyptus bg-eucalyptus-mist/40" : "border-line"}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col">
          <span className="font-medium">{room.name}</span>
          <span className="text-sm text-ink-soft">
            {guests.length}/{room.capacity} lůžek
            {room.price !== null ? `, ${money(room.price, room.currency)} za noc` : ""}
            {room.paid_by === "couple" ? ", platíme my" : ""}
          </span>
        </div>
        {canEdit ? (
          <div className="flex shrink-0 gap-2 text-xs">
            <button type="button" onClick={(e) => { e.stopPropagation(); onEdit(); }} className="text-ink-soft hover:text-ink">Upravit</button>
            <button type="button" onClick={(e) => { e.stopPropagation(); onDelete(); }} className="text-ink-soft hover:text-danger">Smazat</button>
          </div>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: slots }, (_, i) => {
          const g = guests[i];
          return (
            <button
              key={i}
              type="button"
              onClick={(e) => (target && !g ? (e.stopPropagation(), onPlacePicked()) : onBed(e, g?.id ?? null))}
              title={g ? g.name : "Volné lůžko"}
              aria-label={g ? `Lůžko ${i + 1}: ${g.name}` : `Lůžko ${i + 1}: volné`}
              className={`flex size-12 items-center justify-center rounded-full border-2 text-sm font-semibold transition-colors ${
                g
                  ? i >= room.capacity
                    ? "border-danger bg-danger/10 text-danger"
                    : "border-eucalyptus-deep bg-eucalyptus text-white"
                  : "border-line bg-white text-xl font-normal text-ink-soft/50 hover:border-eucalyptus hover:text-eucalyptus"
              }`}
            >
              {g ? initials(g.name) : "+"}
            </button>
          );
        })}
      </div>
      {guests.length ? <p className="text-sm text-ink-soft">{guests.map((g) => g.name).join(", ")}</p> : null}
      {room.notes ? <p className="text-xs text-ink-soft">{room.notes}</p> : null}
    </div>
  );
}
