/** Ceník (s DPH). Platí se jednorázově, plánovač je zdarma. */
export const PLANS = [
  {
    key: "free",
    name: "Plánovač",
    price: 0,
    lead: "Zdarma, napořád",
    points: [
      "Checklist, harmonogram a rozpočet",
      "Hosté, RSVP po domácnostech, vlastní otázky",
      "Zasedací pořádek a ubytování",
      "Tým: partner, svědci, rodiče",
      "Náhled svatebního webu",
    ],
  },
  {
    key: "web",
    name: "Svatební web",
    price: 1340,
    lead: "Jednorázově",
    points: [
      "Vše z plánovače",
      "Zveřejněný web v 5 šablonách",
      "Osobní odkazy a e-maily hostům",
      "Dary s QR platbou bez poplatků",
      "Web běží 12 měsíců od svatby",
    ],
  },
  {
    key: "web_gallery",
    name: "Web + galerie",
    price: 1790,
    lead: "Jednorázově",
    points: ["Vše ze Svatebního webu", "Fotky a videa od hostů přes QR", "Živá prezentace a kniha přání", "50 GB místa na 6 měsíců po svatbě"],
  },
] as const;

export const formatCzk = (n: number) => (n === 0 ? "0 Kč" : `${new Intl.NumberFormat("cs-CZ").format(n)} Kč`);
