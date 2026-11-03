import type { CSSProperties, ReactNode } from "react";
import { getTemplate } from "@/lib/templates";

/** Obal svatebního webu: barvy šablony, lišta náhledu, oznámení. */
export function SiteShell({ template, preview, previewText, children }: { template: string; preview: boolean; previewText: string; children: ReactNode }) {
  const t = getTemplate(template);
  const style = {
    "--site-bg": t.colors.background,
    "--site-text": t.colors.text,
    "--site-muted": t.colors.muted,
    "--site-accent": t.colors.accent,
    "--site-line": t.colors.line,
    "--site-display": t.displayFont,
    "--site-display-style": t.displayStyle,
    "--site-display-weight": String(t.displayWeight),
    background: t.colors.background,
    color: t.colors.text,
    fontFamily: t.bodyFont,
  } as CSSProperties;

  return (
    <div style={style} className="relative min-h-svh">
      {preview ? (
        <p className="sticky top-0 z-40 bg-ink px-4 py-2 text-center text-sm text-white" style={{ fontFamily: "var(--font-sans)" }}>
          {previewText}
        </p>
      ) : null}
      {children}
    </div>
  );
}

export const siteHeading: CSSProperties = {
  fontFamily: "var(--site-display)",
  fontStyle: "var(--site-display-style)" as CSSProperties["fontStyle"],
  fontWeight: "var(--site-display-weight)" as CSSProperties["fontWeight"],
};
