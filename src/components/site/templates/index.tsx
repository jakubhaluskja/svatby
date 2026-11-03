"use client";

import type { CSSProperties } from "react";
import { getTemplate, type TemplateId } from "@/lib/templates";
import type { SiteModel } from "../model";
import { FolklorSite } from "./folklor";
import { HerbarSite } from "./herbar";
import { MagazinSite } from "./magazin";
import { NocSite } from "./noc";
import { PozvankaSite } from "./pozvanka";

const MAP: Record<TemplateId, (p: { model: SiteModel }) => React.ReactNode> = {
  pozvanka: PozvankaSite,
  herbar: HerbarSite,
  magazin: MagazinSite,
  noc: NocSite,
  folklor: FolklorSite,
};

/** Barvy šablony jako CSS proměnné pro sdílené prvky (formulář RSVP, oznámení, přepínač jazyka). */
export function templateVars(template: string): CSSProperties {
  const t = getTemplate(template);
  return {
    "--site-bg": t.colors.background,
    "--site-text": t.colors.text,
    "--site-muted": t.colors.muted,
    "--site-accent": t.colors.accent,
    "--site-line": t.colors.line,
    "--site-display": t.displayFont,
  } as CSSProperties;
}

/** Vykreslí web v dané šabloně. */
export function SiteTemplate({ template, model }: { template: string; model: SiteModel }) {
  const t = getTemplate(template);
  const Comp = MAP[t.id];
  return (
    <div style={templateVars(template)}>
      <Comp model={model} />
    </div>
  );
}
