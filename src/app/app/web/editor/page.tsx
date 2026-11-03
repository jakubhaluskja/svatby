import { linkDomain } from "@/lib/domain";
import { siteUrl } from "@/lib/hosts";
import { publicEvents } from "@/lib/site";
import { giftQr, toWebEvents } from "@/lib/site-model";
import { normalizeSections } from "@/lib/site-sections";
import { createClient } from "@/lib/supabase/server";
import { requireWedding } from "@/lib/wedding";
import type { Locale } from "@/lib/i18n";
import { WebEditor } from "./web-editor";

export const metadata = { title: "Úprava webu" };

export default async function EditorPage() {
  const wedding = await requireWedding();
  const supabase = await createClient();
  const [{ data: draft }, { data: w }, { data: gifts }, { data: paymentsEnabled }, events, domain] = await Promise.all([
    supabase.from("site_pages").select("sections, template").eq("wedding_id", wedding.id).eq("state", "draft").maybeSingle(),
    supabase.from("weddings").select("locales, timezone, rsvp_deadline, status").eq("id", wedding.id).single(),
    supabase.from("gift_settings").select("iban, account_holder").eq("wedding_id", wedding.id).maybeSingle(),
    supabase.rpc("payments_enabled"),
    publicEvents(wedding.id, wedding.default_locale),
    linkDomain(),
  ]);
  const locales = ((w?.locales ?? [wedding.default_locale]) as Locale[]).sort((a) => (a === wedding.default_locale ? -1 : 1));
  const published = w?.status === "published";

  return (
    <WebEditor
      base={{
        weddingId: wedding.id,
        partner1: wedding.partner1_name,
        partner2: wedding.partner2_name,
        date: wedding.wedding_date,
        timeZone: w?.timezone ?? "Europe/Prague",
        events: toWebEvents(events),
        gifts: { iban: gifts?.iban ?? null, holder: gifts?.account_holder ?? null, qrSvg: await giftQr(gifts?.iban ?? null, wedding.default_locale) },
        rsvpDeadline: w?.rsvp_deadline ?? null,
        hidden: [],
        coords: null,
      }}
      initialSections={normalizeSections(draft?.sections)}
      initialTemplate={draft?.template ?? wedding.template}
      locales={locales}
      siteUrl={siteUrl(wedding.slug, domain)}
      published={published}
      canPublish={published || (paymentsEnabled === false && w?.status === "draft")}
    />
  );
}
