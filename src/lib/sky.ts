/** Hvězdná obloha nad místem a v čase svatby (nejjasnější hvězdy severní oblohy). */

type Star = [name: string, ra: number, dec: number, mag: number];

// RA v hodinách, deklinace ve stupních (J2000), magnituda
export const STARS: Star[] = [
  ["Polárka", 2.53, 89.26, 2.0], ["Kochab", 14.845, 74.16, 2.1], ["Pherkad", 15.345, 71.83, 3.0], ["Yildun", 17.537, 86.59, 4.4], ["εUMi", 16.766, 82.04, 4.2], ["ζUMi", 15.734, 77.79, 4.3], ["ηUMi", 16.292, 75.76, 5.0],
  ["Dubhe", 11.062, 61.75, 1.8], ["Merak", 11.031, 56.38, 2.4], ["Phecda", 11.897, 53.69, 2.4], ["Megrez", 12.257, 57.03, 3.3], ["Alioth", 12.9, 55.96, 1.8], ["Mizar", 13.399, 54.93, 2.2], ["Alkaid", 13.792, 49.31, 1.9],
  ["Caph", 0.153, 59.15, 2.3], ["Schedar", 0.675, 56.54, 2.2], ["γCas", 0.945, 60.72, 2.4], ["Ruchbah", 1.43, 60.24, 2.7], ["Segin", 1.907, 63.67, 3.4],
  ["Vega", 18.616, 38.78, 0.0], ["Sheliak", 18.835, 33.36, 3.5], ["Sulafat", 18.982, 32.69, 3.3], ["ζLyr", 18.746, 37.6, 4.3], ["δLyr", 18.908, 36.9, 4.3],
  ["Deneb", 20.69, 45.28, 1.3], ["Sadr", 20.37, 40.26, 2.2], ["Gienah", 20.77, 33.97, 2.5], ["δCyg", 19.75, 45.13, 2.9], ["Albireo", 19.512, 27.96, 3.1],
  ["Altair", 19.846, 8.87, 0.8], ["Tarazed", 19.771, 10.61, 2.7], ["Alshain", 19.922, 6.41, 3.7],
  ["Arcturus", 14.261, 19.18, -0.1], ["Izar", 14.75, 27.07, 2.4], ["Muphrid", 13.911, 18.4, 2.7], ["Seginus", 14.535, 38.31, 3.0], ["Nekkar", 15.032, 40.39, 3.5], ["δBoo", 15.258, 33.31, 3.5],
  ["Alphecca", 15.578, 26.71, 2.2], ["Nusakan", 15.464, 29.11, 3.7], ["γCrB", 15.713, 26.3, 3.8], ["δCrB", 15.826, 26.07, 4.6], ["εCrB", 15.96, 26.88, 4.1], ["θCrB", 15.549, 31.36, 4.1],
  ["Regulus", 10.14, 11.97, 1.4], ["Denebola", 11.818, 14.57, 2.1], ["Algieba", 10.333, 19.84, 2.0], ["Zosma", 11.235, 20.52, 2.6], ["Chertan", 11.237, 15.43, 3.3], ["ηLeo", 10.122, 16.76, 3.5], ["Adhafera", 10.278, 23.42, 3.4], ["Rasalas", 9.879, 26.01, 3.9],
  ["Spica", 13.42, -11.16, 1.0], ["Antares", 16.49, -26.43, 1.0], ["Dschubba", 16.006, -22.62, 2.3], ["Acrab", 16.091, -19.81, 2.6], ["πSco", 15.981, -26.11, 2.9], ["τSco", 16.598, -28.22, 2.8], ["εSco", 16.836, -34.29, 2.3],
  ["ζHer", 16.688, 31.6, 2.8], ["ηHer", 16.715, 38.92, 3.5], ["πHer", 17.251, 36.81, 3.2], ["εHer", 17.005, 30.93, 3.9], ["Kornephoros", 16.504, 21.49, 2.8],
  ["Eltanin", 17.943, 51.49, 2.2], ["Rastaban", 17.507, 52.3, 2.8], ["Thuban", 14.073, 64.38, 3.7], ["Rasalhague", 17.582, 12.56, 2.1],
  ["Capella", 5.278, 45.99, 0.1], ["Castor", 7.577, 31.89, 1.6], ["Pollux", 7.755, 28.03, 1.1], ["Procyon", 7.655, 5.22, 0.4], ["Mirfak", 3.405, 49.86, 1.8], ["Algol", 3.136, 40.96, 2.1],
  ["Alpheratz", 0.14, 29.09, 2.1], ["Mirach", 1.162, 35.62, 2.1], ["Almach", 2.065, 42.33, 2.1], ["Markab", 23.079, 15.21, 2.5], ["Scheat", 23.063, 28.08, 2.4], ["Algenib", 0.221, 15.18, 2.8],
];

export const LINES: [string, string][] = [
  ["Dubhe", "Merak"], ["Merak", "Phecda"], ["Phecda", "Megrez"], ["Megrez", "Dubhe"], ["Megrez", "Alioth"], ["Alioth", "Mizar"], ["Mizar", "Alkaid"],
  ["Polárka", "Yildun"], ["Yildun", "εUMi"], ["εUMi", "ζUMi"], ["ζUMi", "ηUMi"], ["ηUMi", "Pherkad"], ["Pherkad", "Kochab"], ["Kochab", "ζUMi"],
  ["Caph", "Schedar"], ["Schedar", "γCas"], ["γCas", "Ruchbah"], ["Ruchbah", "Segin"],
  ["Vega", "ζLyr"], ["ζLyr", "Sheliak"], ["Sheliak", "Sulafat"], ["Sulafat", "δLyr"], ["δLyr", "ζLyr"],
  ["Deneb", "Sadr"], ["Sadr", "Albireo"], ["Gienah", "Sadr"], ["Sadr", "δCyg"],
  ["Tarazed", "Altair"], ["Altair", "Alshain"],
  ["Arcturus", "Izar"], ["Izar", "δBoo"], ["δBoo", "Nekkar"], ["Nekkar", "Seginus"], ["Seginus", "Arcturus"], ["Arcturus", "Muphrid"],
  ["θCrB", "Nusakan"], ["Nusakan", "Alphecca"], ["Alphecca", "γCrB"], ["γCrB", "δCrB"], ["δCrB", "εCrB"],
  ["Regulus", "ηLeo"], ["ηLeo", "Algieba"], ["Algieba", "Adhafera"], ["Adhafera", "Rasalas"], ["Algieba", "Zosma"], ["Zosma", "Denebola"], ["Denebola", "Chertan"], ["Chertan", "Regulus"],
  ["Acrab", "Dschubba"], ["Dschubba", "πSco"], ["Dschubba", "Antares"], ["Antares", "τSco"], ["τSco", "εSco"],
  ["ζHer", "ηHer"], ["ηHer", "πHer"], ["πHer", "εHer"], ["εHer", "ζHer"], ["ζHer", "Kornephoros"],
  ["Eltanin", "Rastaban"], ["Castor", "Pollux"], ["Alpheratz", "Mirach"], ["Mirach", "Almach"], ["Alpheratz", "Scheat"], ["Scheat", "Markab"], ["Markab", "Algenib"], ["Algenib", "Alpheratz"],
];

const rad = Math.PI / 180;

export function julianDay(date: Date): number {
  return date.getTime() / 86_400_000 + 2440587.5;
}

/** Výška a azimut (stupně, azimut od severu na východ). */
export function altAz(raHours: number, decDeg: number, date: Date, lat: number, lon: number): { alt: number; az: number } {
  const d = julianDay(date) - 2451545.0;
  const gmst = (280.46061837 + 360.98564736629 * d) % 360;
  const lst = (gmst + lon + 360) % 360;
  const ha = ((lst - raHours * 15) % 360 + 360) % 360;
  const sinAlt = Math.sin(decDeg * rad) * Math.sin(lat * rad) + Math.cos(decDeg * rad) * Math.cos(lat * rad) * Math.cos(ha * rad);
  const alt = Math.asin(sinAlt);
  const cosAz = (Math.sin(decDeg * rad) - Math.sin(alt) * Math.sin(lat * rad)) / (Math.cos(alt) * Math.cos(lat * rad));
  let az = Math.acos(Math.max(-1, Math.min(1, cosAz))) / rad;
  if (Math.sin(ha * rad) > 0) az = 360 - az;
  return { alt: alt / rad, az };
}

/** Fáze Měsíce 0–1 (0 nov, 0,5 úplněk). */
export function moonPhase(date: Date): number {
  const age = (julianDay(date) - 2451550.1) / 29.530588853;
  return age - Math.floor(age);
}

export type SkyPoint = { name: string; x: number; y: number; mag: number };

/** Hvězdy nad obzorem v souřadnicích kruhové mapy (-1…1, sever nahoře, východ vlevo). */
export function skyMap(date: Date, lat = 49.8, lon = 15.5): { stars: SkyPoint[]; lines: [SkyPoint, SkyPoint][] } {
  const pts = new Map<string, SkyPoint>();
  for (const [name, ra, dec, mag] of STARS) {
    const { alt, az } = altAz(ra, dec, date, lat, lon);
    if (alt < 0) continue;
    const r = (90 - alt) / 90;
    pts.set(name, { name, x: -r * Math.sin(az * rad), y: -r * Math.cos(az * rad), mag });
  }
  const lines = LINES.filter(([a, b]) => pts.has(a) && pts.has(b)).map(([a, b]) => [pts.get(a)!, pts.get(b)!] as [SkyPoint, SkyPoint]);
  return { stars: [...pts.values()], lines };
}
