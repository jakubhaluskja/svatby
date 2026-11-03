/** Tvary stolů a prvků sálu a rozmístění židlí kolem nich (souřadnice vůči středu). */

export type ShapeId = "round" | "rect" | "oval" | "head" | "t" | "u" | "banquet" | "dancefloor" | "bar" | "stage" | "dj" | "entrance";

export const TABLE_PRESETS: { shape: ShapeId; label: string; seats: number; w: number; h: number }[] = [
  { shape: "round", label: "Kulatý", seats: 8, w: 150, h: 150 },
  { shape: "rect", label: "Obdélníkový", seats: 6, w: 220, h: 90 },
  { shape: "oval", label: "Oválný", seats: 10, w: 220, h: 120 },
  { shape: "head", label: "Hlavní", seats: 6, w: 400, h: 80 },
  { shape: "banquet", label: "Banket", seats: 16, w: 520, h: 80 },
  { shape: "t", label: "Tvar T", seats: 14, w: 360, h: 300 },
  { shape: "u", label: "Tvar U", seats: 20, w: 420, h: 320 },
];

export const DECOR_PRESETS: { shape: ShapeId; label: string; w: number; h: number }[] = [
  { shape: "dancefloor", label: "Parket", w: 300, h: 240 },
  { shape: "bar", label: "Bar", w: 220, h: 60 },
  { shape: "stage", label: "Pódium", w: 260, h: 120 },
  { shape: "dj", label: "DJ", w: 120, h: 80 },
  { shape: "entrance", label: "Vchod", w: 140, h: 30 },
];

type Pt = { x: number; y: number };

function alongLine(a: Pt, b: Pt, n: number): Pt[] {
  return Array.from({ length: n }, (_, i) => ({ x: a.x + ((b.x - a.x) * (i + 0.5)) / n, y: a.y + ((b.y - a.y) * (i + 0.5)) / n }));
}

/** Rozdělí počet židlí mezi strany úměrně jejich délce. */
function distribute(sides: [Pt, Pt][], seats: number): Pt[] {
  const lengths = sides.map(([a, b]) => Math.hypot(b.x - a.x, b.y - a.y));
  const total = lengths.reduce((s, l) => s + l, 0) || 1;
  const counts = lengths.map((l) => Math.floor((l / total) * seats));
  let rest = seats - counts.reduce((s, c) => s + c, 0);
  const order = lengths.map((l, i) => [l, i] as const).sort((a, b) => b[0] - a[0]);
  for (let k = 0; rest > 0; k = (k + 1) % order.length, rest--) counts[order[k][1]]++;
  return sides.flatMap(([a, b], i) => alongLine(a, b, counts[i]));
}

/** Pozice židlí kolem stolu. Střed židle je 42 px od hrany stolu. */
export function seatPositions(shape: ShapeId, w: number, h: number, seats: number): Pt[] {
  if (seats <= 0) return [];
  const o = 42;
  const hw = w / 2;
  const hh = h / 2;
  switch (shape) {
    case "round":
    case "oval":
      return Array.from({ length: seats }, (_, i) => {
        const a = (2 * Math.PI * i) / seats - Math.PI / 2;
        return { x: Math.cos(a) * (hw + o), y: Math.sin(a) * (hh + o) };
      });
    case "head":
      return alongLine({ x: -hw, y: hh + o }, { x: hw, y: hh + o }, seats);
    case "rect":
    case "banquet":
      return distribute(
        [
          [{ x: -hw, y: -hh - o }, { x: hw, y: -hh - o }],
          [{ x: -hw, y: hh + o }, { x: hw, y: hh + o }],
          ...(shape === "rect" && seats > 8
            ? ([
                [{ x: -hw - o, y: -hh }, { x: -hw - o, y: hh }],
                [{ x: hw + o, y: -hh }, { x: hw + o, y: hh }],
              ] as [Pt, Pt][])
            : []),
        ],
        seats,
      );
    case "t": {
      const bar = 70; // šířka ramen
      return distribute(
        [
          [{ x: -hw, y: -hh - o }, { x: hw, y: -hh - o }],
          [{ x: -hw, y: -hh + bar + o }, { x: -bar / 2 - o, y: -hh + bar + o }],
          [{ x: bar / 2 + o, y: -hh + bar + o }, { x: hw, y: -hh + bar + o }],
          [{ x: -bar / 2 - o, y: -hh + bar + o }, { x: -bar / 2 - o, y: hh }],
          [{ x: bar / 2 + o, y: -hh + bar + o }, { x: bar / 2 + o, y: hh }],
        ],
        seats,
      );
    }
    case "u": {
      const bar = 70;
      return distribute(
        [
          [{ x: -hw, y: -hh - o }, { x: hw, y: -hh - o }],
          [{ x: -hw - o, y: -hh }, { x: -hw - o, y: hh }],
          [{ x: hw + o, y: -hh }, { x: hw + o, y: hh }],
          [{ x: -hw + bar + o, y: -hh + bar + o }, { x: -hw + bar + o, y: hh }],
          [{ x: hw - bar - o, y: -hh + bar + o }, { x: hw - bar - o, y: hh }],
        ],
        seats,
      );
    }
    default:
      return [];
  }
}

/** Obrys stolu nebo prvku. */
export function ShapeOutline({ shape, w, h, className, style }: { shape: ShapeId; w: number; h: number; className?: string; style?: React.CSSProperties }) {
  const hw = w / 2;
  const hh = h / 2;
  const bar = 70;
  if (shape === "round") return <circle r={hw} className={className} style={style} />;
  if (shape === "oval") return <ellipse rx={hw} ry={hh} className={className} style={style} />;
  if (shape === "t")
    return (
      <path
        d={`M${-hw},${-hh} H${hw} V${-hh + bar} H${bar / 2} V${hh} H${-bar / 2} V${-hh + bar} H${-hw} Z`}
        className={className}
        style={style}
      />
    );
  if (shape === "u")
    return (
      <path
        d={`M${-hw},${-hh} H${hw} V${hh} H${hw - bar} V${-hh + bar} H${-hw + bar} V${hh} H${-hw} Z`}
        className={className}
        style={style}
      />
    );
  return <rect x={-hw} y={-hh} width={w} height={h} rx={shape === "dancefloor" || shape === "stage" ? 6 : 10} className={className} style={style} />;
}

/** Natočení židle (ve stupních), aby byla čelem ke stolu. Výchozí židle hledí nahoru (−y). */
export function seatFacing(shape: ShapeId, w: number, h: number, p: Pt): number {
  const hw = w / 2;
  const hh = h / 2;
  const toward = (vx: number, vy: number) => (Math.atan2(vx, -vy) * 180) / Math.PI;
  if (shape === "round" || shape === "oval") return toward(-p.x, -p.y);
  const bar = 70;
  if (shape === "t" && Math.abs(p.y) < hh + 1 && Math.abs(p.x) < hw + 1) {
    // pod rameny hledí nahoru, podél nohy ke středu
    if (Math.abs(p.y - (-hh + bar + 42)) < 1 && Math.abs(p.x) > bar / 2 + 43) return toward(0, -1);
    return toward(-Math.sign(p.x), 0);
  }
  if (shape === "u" && Math.abs(p.y) < hh + 1 && Math.abs(p.x) < hw - 1) return toward(Math.sign(p.x), 0);
  if (Math.abs(p.y) > hh) return toward(0, -Math.sign(p.y));
  if (Math.abs(p.x) > hw) return toward(-Math.sign(p.x), 0);
  return toward(-p.x, -p.y);
}

export type ChairState = "free" | "yes" | "pending" | "no";

const CHAIR_STYLE: Record<ChairState, { seat: string; back: string; stroke: string; dash?: string }> = {
  free: { seat: "#ffffff", back: "#eef2ef", stroke: "#c9d3cd" },
  yes: { seat: "#e3ece7", back: "#c9d9d1", stroke: "#8faa9d" },
  pending: { seat: "#f6ebf0", back: "#ead6e0", stroke: "#c9a3b5", dash: "5 4" },
  no: { seat: "#f7e4e1", back: "#efcfca", stroke: "#a33a2f" },
};

/** Židle při pohledu shora: sedák a zaoblené opěradlo na straně od stolu. */
export function ChairShape({ state, active }: { state: ChairState; active?: boolean }) {
  const s = CHAIR_STYLE[state];
  const stroke = active ? "#7b3f5c" : s.stroke;
  const sw = active ? 4 : 2;
  return (
    <g filter="url(#chair-shadow)">
      <rect x={-26} y={-24} width={52} height={47} rx={14} fill={s.seat} stroke={stroke} strokeWidth={sw} strokeDasharray={s.dash} />
      <path d="M-29 19 Q0 31 29 19 L30 27 Q0 41 -30 27 Z" fill={s.back} stroke={stroke} strokeWidth={sw} strokeLinejoin="round" />
      {state === "free" ? <rect x={-16} y={-14} width={32} height={27} rx={9} fill="none" stroke="#e6ebe8" strokeWidth={1.5} /> : null}
    </g>
  );
}

/** Společné definice plátna: stíny a dřevěná podlaha parketu. */
export function CanvasDefs() {
  return (
    <defs>
      <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
        <circle cx="2" cy="2" r="1.8" fill="#e2ddd3" />
      </pattern>
      <filter id="chair-shadow" x="-50%" y="-50%" width="200%" height="200%">
        <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#1e2b26" floodOpacity="0.14" />
      </filter>
      <filter id="table-shadow" x="-30%" y="-30%" width="160%" height="160%">
        <feDropShadow dx="0" dy="10" stdDeviation="12" floodColor="#1e2b26" floodOpacity="0.13" />
      </filter>
      <pattern id="wood" width="36" height="36" patternUnits="userSpaceOnUse">
        <rect width="36" height="36" fill="#efe7dc" />
        <path d="M0 18h36M18 0v18M9 18v18M27 18v18" stroke="#e2d6c6" strokeWidth="1.5" />
      </pattern>
    </defs>
  );
}
