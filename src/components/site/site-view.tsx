"use client";

import type { Locale } from "@/lib/i18n";
import { EditProvider } from "./edit";
import type { SiteModel } from "./model";
import { SiteTemplate } from "./templates";

/** Veřejné zobrazení webu (bez úprav). */
export function SiteView({ template, model, locale }: { template: string; model: SiteModel; locale: Locale }) {
  return (
    <EditProvider value={{ editing: false, locale, update: () => {}, upload: async () => null }}>
      <SiteTemplate template={template} model={model} />
    </EditProvider>
  );
}
