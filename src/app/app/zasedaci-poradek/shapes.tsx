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
