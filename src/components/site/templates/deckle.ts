/** Polygon s ručně trhaným okrajem papíru pro clip-path. */
export function deckle(seed = 1, amp = 0.6, steps = 48): string {
  let s = seed;
  const r = () => ((s = (s * 9301 + 49297) % 233280) / 233280 - 0.5) * amp;
  const v = () => Math.max(0, r() + 0.3);
  const pts: string[] = [];
  for (let i = 0; i <= steps; i++) pts.push(`${((i / steps) * 100).toFixed(2)}% ${v().toFixed(2)}%`);
  for (let i = 0; i <= steps; i++) pts.push(`${(100 - v() * 0.6).toFixed(2)}% ${((i / steps) * 100).toFixed(2)}%`);
  for (let i = steps; i >= 0; i--) pts.push(`${((i / steps) * 100).toFixed(2)}% ${(100 - v()).toFixed(2)}%`);
  for (let i = steps; i >= 0; i--) pts.push(`${(v() * 0.6).toFixed(2)}% ${((i / steps) * 100).toFixed(2)}%`);
  return `polygon(${pts.join(",")})`;
}
