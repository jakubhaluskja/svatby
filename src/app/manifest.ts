import type { MetadataRoute } from "next";

/** Instalovatelná aplikace (přidání na plochu telefonu). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Svatby – plánovač svatby",
    short_name: "Svatby",
    description: "Svatební web, hosté a plánování svatby v jedné aplikaci.",
    lang: "cs",
    start_url: "/app",
    scope: "/",
    display: "standalone",
    background_color: "#f5f7f5",
    theme_color: "#4f7263",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Checklist", url: "/app/checklist" },
      { name: "Hosté", url: "/app/hoste" },
      { name: "Rozpočet", url: "/app/rozpocet" },
    ],
  };
}
