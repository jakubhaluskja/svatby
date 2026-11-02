/**
 * Automatický návrh zasedacího pořádku.
 *
 * Tvrdá pravidla (vždy dodržena, jinak se nahlásí):
 *  - kapacita stolu,
 *  - domácnost sedí u jednoho stolu,
 *  - „sedět spolu“ (skupina u jednoho stolu),
 *  - „nesedět spolu“ (ne u stejného stolu),
 *  - „pevný stůl“,
 *  - zamčení hosté zůstávají, kde jsou.
 * Měkké pravidlo: hosté se stejnými štítky sedí pohromadě.
 */

export type SeatTable = { id: string; label: string; seats: number };
export type SeatGuest = { id: string; name: string; household_id: string; tags: string[] };
export type SeatRule =
  | { kind: "together"; guest_ids: string[] }
  | { kind: "apart"; guest_ids: string[] }
  | { kind: "fixed_table"; guest_ids: string[]; table_id: string };
export type Assignment = { guest_id: string; table_id: string };

export type Problem = { message: string; guest_ids: string[] };
export type SeatingResult = { assignments: Assignment[]; unseated: string[]; problems: Problem[] };

/** Skupina hostů, kteří musí sedět spolu. */
type Group = { guests: string[]; tags: Map<string, number>; fixedTable: string | null };

class UnionFind {
  private parent = new Map<string, string>();
  find(x: string): string {
    if (!this.parent.has(x)) this.parent.set(x, x);
    const p = this.parent.get(x)!;
    if (p === x) return x;
    const root = this.find(p);
    this.parent.set(x, root);
    return root;
  }
  union(a: string, b: string) {
    this.parent.set(this.find(a), this.find(b));
  }
}

export function suggestSeating(input: {
  tables: SeatTable[];
  guests: SeatGuest[];
  rules: SeatRule[];
  locked: Assignment[];
}): SeatingResult {
  const { tables, guests, rules, locked } = input;
  const problems: Problem[] = [];
  const guestById = new Map(guests.map((g) => [g.id, g]));
  const tableById = new Map(tables.map((t) => [t.id, t]));
  const nameOf = (id: string) => guestById.get(id)?.name ?? "host";

  // Obsazenost stolů zamčenými hosty
  const seated = new Map<string, string>(); // guest -> table
  const load = new Map<string, number>(tables.map((t) => [t.id, 0]));
  const members = new Map<string, Set<string>>(tables.map((t) => [t.id, new Set()]));
  for (const a of locked) {
    if (!guestById.has(a.guest_id) || !tableById.has(a.table_id)) continue;
    seated.set(a.guest_id, a.table_id);
    load.set(a.table_id, load.get(a.table_id)! + 1);
    members.get(a.table_id)!.add(a.guest_id);
  }

  // Skupiny: domácnost + pravidla „spolu“
  const uf = new UnionFind();
  const byHousehold = new Map<string, string>();
  for (const g of guests) {
    uf.find(g.id);
    const first = byHousehold.get(g.household_id);
    if (first) uf.union(g.id, first);
    else byHousehold.set(g.household_id, g.id);
  }
  for (const r of rules) {
    if (r.kind !== "together") continue;
    const ids = r.guest_ids.filter((id) => guestById.has(id));
    for (let i = 1; i < ids.length; i++) uf.union(ids[0], ids[i]);
  }

  const groupsByRoot = new Map<string, Group>();
  for (const g of guests) {
    const root = uf.find(g.id);
    const group: Group = groupsByRoot.get(root) ?? { guests: [], tags: new Map(), fixedTable: null };
    group.guests.push(g.id);
    for (const t of g.tags) group.tags.set(t, (group.tags.get(t) ?? 0) + 1);
    groupsByRoot.set(root, group);
  }

  // Pevné stoly
  for (const r of rules) {
    if (r.kind !== "fixed_table") continue;
    if (!tableById.has(r.table_id)) continue;
    for (const id of r.guest_ids) {
      if (!guestById.has(id)) continue;
      const group = groupsByRoot.get(uf.find(id))!;
      if (group.fixedTable && group.fixedTable !== r.table_id) {
        problems.push({
          message: `${nameOf(id)} má pevné místo u dvou různých stolů. Platí ${tableById.get(group.fixedTable)!.label}.`,
          guest_ids: [id],
        });
        continue;
      }
      group.fixedTable = r.table_id;
    }
  }

  // Dvojice, které nesmí sedět spolu
  const apart = new Map<string, Set<string>>();
  for (const r of rules) {
    if (r.kind !== "apart") continue;
    const ids = r.guest_ids.filter((id) => guestById.has(id));
    for (const a of ids)
      for (const b of ids) {
        if (a === b) continue;
        if (uf.find(a) === uf.find(b)) {
          problems.push({ message: `${nameOf(a)} a ${nameOf(b)} mají sedět odděleně, ale patří do jedné domácnosti nebo skupiny.`, guest_ids: [a, b] });
          continue;
        }
        if (!apart.has(a)) apart.set(a, new Set());
        apart.get(a)!.add(b);
      }
  }

  const conflicts = (group: Group, tableId: string) =>
    group.guests.some((g) => [...(apart.get(g) ?? [])].some((other) => members.get(tableId)!.has(other)));

  // Společné štítky přitahují, cizí štítky u stolu odpuzují (kolegové nesedí mezi spolužáky).
  const tagScore = (group: Group, tableId: string) => {
    if (group.tags.size === 0) return 0;
    let score = 0;
    for (const other of members.get(tableId)!) {
      const tags = guestById.get(other)?.tags ?? [];
      const shared = tags.reduce((n, t) => n + (group.tags.get(t) ?? 0), 0);
      score += shared > 0 ? shared : tags.length > 0 ? -0.5 : 0;
    }
    return score;
  };

  const place = (group: Group, tableId: string, ids: string[]) => {
    for (const id of ids) {
      seated.set(id, tableId);
      members.get(tableId)!.add(id);
    }
    load.set(tableId, load.get(tableId)! + ids.length);
    void group;
  };

  const unseated: string[] = [];
  // Pevné stoly první, pak největší skupiny, při shodě skupiny s více štítky
  const groups = [...groupsByRoot.values()].sort(
    (a, b) => Number(!!b.fixedTable) - Number(!!a.fixedTable) || b.guests.length - a.guests.length || b.tags.size - a.tags.size,
  );

  for (const group of groups) {
    // Zamčení členové skupiny určují stůl
    const lockedTables = new Set(group.guests.map((g) => seated.get(g)).filter((t): t is string => !!t));
    const pending = group.guests.filter((g) => !seated.has(g));
    if (pending.length === 0) continue;

    let candidates = tables.map((t) => t.id);
    if (group.fixedTable) candidates = [group.fixedTable];
    if (lockedTables.size === 1) {
      const t = [...lockedTables][0];
      if (group.fixedTable && group.fixedTable !== t) {
        problems.push({ message: `Část skupiny je zamčená u jiného stolu, než je pevné místo.`, guest_ids: group.guests });
      }
      candidates = [t];
    } else if (lockedTables.size > 1) {
      problems.push({ message: `Členové jedné skupiny jsou zamčení u různých stolů.`, guest_ids: group.guests });
    }

    const fits = candidates.filter((t) => tableById.get(t)!.seats - load.get(t)! >= pending.length && !conflicts(group, t));
    if (fits.length > 0) {
      // Nejvíc společných štítků; při shodě stůl, který je už rozsazený (méně prázdných míst)
      fits.sort((a, b) => tagScore(group, b) - tagScore(group, a) || (tableById.get(a)!.seats - load.get(a)!) - (tableById.get(b)!.seats - load.get(b)!));
      place(group, fits[0], pending);
      continue;
    }

    const names = pending.map(nameOf).join(", ");
    if (group.fixedTable) {
      problems.push({ message: `U stolu ${tableById.get(group.fixedTable)!.label} není místo pro: ${names}.`, guest_ids: pending });
    } else if (candidates.some((t) => tableById.get(t)!.seats - load.get(t)! >= pending.length)) {
      problems.push({ message: `Skupinu ${names} nejde posadit kvůli pravidlu „nesedět spolu“.`, guest_ids: pending });
    } else {
      problems.push({ message: `Pro skupinu ${names} (${pending.length} osob) není žádný stůl s dost volnými místy.`, guest_ids: pending });
    }
    unseated.push(...pending);
  }

  const assignments = [...seated.entries()].map(([guest_id, table_id]) => ({ guest_id, table_id }));
  return { assignments, unseated, problems };
}

/** Hosté u stolu nad kapacitu a hosté, kteří mezitím odmítli účast. */
export function seatingWarnings(
  tables: SeatTable[],
  assignments: Assignment[],
  attending: Set<string>,
): { overfull: { table: SeatTable; count: number }[]; declined: Assignment[] } {
  const count = new Map<string, number>();
  for (const a of assignments) count.set(a.table_id, (count.get(a.table_id) ?? 0) + 1);
  return {
    overfull: tables.filter((t) => (count.get(t.id) ?? 0) > t.seats).map((t) => ({ table: t, count: count.get(t.id) ?? 0 })),
    declined: assignments.filter((a) => !attending.has(a.guest_id)),
  };
}
