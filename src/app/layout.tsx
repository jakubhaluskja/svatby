import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import "@fontsource-variable/bricolage-grotesque";
import "@fontsource-variable/fraunces";
import "@fontsource/cormorant-garamond/latin-ext-400.css";
import "@fontsource/cormorant-garamond/latin-ext-500.css";
import "@fontsource/cormorant-garamond/latin-ext-500-italic.css";
import "@fontsource/cormorant-garamond/latin-400.css";
import "@fontsource/cormorant-garamond/latin-500.css";
import "@fontsource/cormorant-garamond/latin-500-italic.css";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Svatební web a plánovač", template: "%s | Svatby" },
  description: "Svatební web s potvrzením účasti a kompletní plánovač svatby na jednom místě.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="cs" className={GeistSans.variable}>
      <body className="antialiased">{children}</body>
    </html>
  );
}
