import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import "./globals.css";

export const metadata: Metadata = {
  title: "Svatební web a plánovač",
  description: "Svatební web s potvrzením účasti a kompletní plánovač svatby na jednom místě.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="cs" className={GeistSans.variable}>
      <body className="antialiased">{children}</body>
    </html>
  );
}
