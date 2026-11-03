import { appDomain } from "@/lib/env";
import { siteUrl } from "@/lib/hosts";
import { normalizeSections, SECTION_LABELS, type Section } from "@/lib/site-sections";
import { createClient } from "@/lib/supabase/server";
import { utcToZonedParts } from "@/lib/time";
import { requireWedding } from "@/lib/wedding";
import Link from "next/link";
import { tr } from "@/lib/i18n";
import { PasswordForm } from "./password-form";
import { PlanBList } from "./plan-b";
import { PublishButton } from "./publish-button";
import { SectionList } from "./section-list";
import { SettingsForm } from "./settings-form";

export const metadata = { title: "Svatební web" };

function hasText(value: unknown): boolean {
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.some(hasText);
  if (value && typeof value === "object") return Object.values(value).some(hasText);
  return false;
}

function isFilled(s: Section): boolean {
  return s.type === "schedule" || hasText(s.content);
}

export default async function WebEditorPage() {
  const wedding = await requireWedding();
  const supabase = await createClient();
  const [{ data: pages }, { data: w }, { data: planB }, { data: paymentsEnabled }] = await Promise.all([
    supabase.from("site_pages").select("state, sections, template, updated_at").eq("wedding_id", wedding.id),
    supabase.from("weddings").select("locales, rsvp_deadline, status, package, published_free, password_scope, password_hash, protected_sections").eq("id", wedding.id).single(),
    supabase
      .from("events")
      .select("id, name, location_name, plan_b_location_name, plan_b_address, plan_b_active")
      .eq("wedding_id", wedding.id)
      .or("plan_b_location_name.not.is.null,plan_b_address.not.is.null")
      .order("starts_at", { ascending: true, nullsFirst: false }),
    supabase.rpc("payments_enabled"),
  ]);
  const free = paymentsEnabled === false;
  const draft = pages?.find((p) => p.state === "draft");
  const published = pages?.find((p) => p.state === "published");
  const sections = normalizeSections(draft?.sections);
  const hasChanges =
    !!draft && (!published || JSON.stringify(draft.sections) !== JSON.stringify(published.sections) || draft.template !== published.template);
  const url = siteUrl(wedding.slug, appDomain());

  return (
    <div className="flex max-w-4xl flex-col gap-12 px-6 py-8 sm:px-10 lg:py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="font-serif text-4xl tracking-tight">Svatební web</h1>
          <p className="text-ink-soft">
            <a href={url} target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-ink">
              {url.replace(/^https?:\/\//, "")}
            </a>
            {w?.status === "published" ? ", zveřejněný" : ", koncept (vidíte ho jen vy)"}
          </p>
        </div>
        {w?.status === "published" ? (
          <PublishButton hasChanges={hasChanges} canHide={!!w.published_free && w.package === "none" && wedding.role !== "coorganizer"} />
        ) : free && w?.status === "draft" ? (
          <PublishButton hasChanges firstPublish />
        ) : (
          <p className="max-w-xs text-sm text-ink-soft">
            Upravujte, kolik chcete. Hostům web zpřístupníte zveřejněním po zaplacení balíčku.
          </p>
        )}
      </div>

      {free ? (
        <p className="-mt-6 rounded-xl bg-eucalyptus-mist px-4 py-3 text-sm text-eucalyptus-deep">
          {w?.status === "published"
            ? "Web je online zdarma. Platba se bude řešit až po spuštění plateb na platformě."
            : "Zveřejnění je teď zdarma. Po zveřejnění web uvidí hosté a půjde odpovídat na pozvání."}
        </p>
      ) : null}

      <section className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="font-serif text-2xl tracking-tight">Sekce</h2>
          <p className="text-sm text-ink-soft">Zapněte, co chcete hostům ukázat, a šipkami změňte pořadí.</p>
        </div>
        <SectionList
          items={sections.map((s) => ({ type: s.type, label: SECTION_LABELS[s.type].cs, hint: SECTION_LABELS[s.type].hint, enabled: s.enabled, filled: isFilled(s) }))}
        />
      </section>

      <section className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h2 className="font-serif text-2xl tracking-tight">Plán B a zprávy v den svatby</h2>
            <p className="text-sm text-ink-soft">Když bude pršet, přepněte na náhradní místo. Hosté to uvidí hned v programu i nahoře na webu.</p>
          </div>
          <Link href="/app/web/zpravy" className="inline-flex h-10 items-center rounded-full border border-line bg-surface px-5 text-sm font-medium hover:border-eucalyptus">
            Zprávy hostům
          </Link>
        </div>
        <PlanBList
          items={(planB ?? []).map((e) => ({
            id: e.id,
            name: tr(e.name),
            place: e.location_name ?? "",
            planB: [e.plan_b_location_name, e.plan_b_address].filter(Boolean).join(", "),
            active: e.plan_b_active,
          }))}
        />
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="font-serif text-2xl tracking-tight">Vzhled a nastavení</h2>
        <SettingsForm
          template={draft?.template ?? wedding.template}
          english={(w?.locales ?? []).includes("en")}
          deadline={w?.rsvp_deadline ? utcToZonedParts(w.rsvp_deadline).date : ""}
          canEdit={wedding.role !== "coorganizer"}
        />
      </section>

      <section className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="font-serif text-2xl tracking-tight">Soukromí</h2>
          <p className="text-sm text-ink-soft">Adresa a fotky jsou citlivé. Web můžete zamknout heslem.</p>
        </div>
        <PasswordForm
          scope={w?.password_scope ?? "none"}
          protectedSections={w?.protected_sections ?? []}
          hasPassword={!!w?.password_hash}
          canEdit={wedding.role !== "coorganizer"}
        />
      </section>
    </div>
  );
}
