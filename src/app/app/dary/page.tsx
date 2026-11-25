import { createClient } from "@/lib/supabase/server";
import { moduleLevel, requireWedding } from "@/lib/wedding";
import { GiftsView, type Gift, type Contribution, type Reservation, type Received } from "./gifts-view";

export const metadata = { title: "Dary" };

type Props = { searchParams: Promise<{ tab?: string }> };

export default async function GiftsPage({ searchParams }: Props) {
  const { tab } = await searchParams;
  const wedding = await requireWedding();
  const supabase = await createClient();
  const [gifts, reservations, contributions, received, households, settings, page, level] = await Promise.all([
    supabase.from("gifts").select("id, kind, title, description, url, price, image_key, target_amount, show_contributors, show_amounts, sort").eq("wedding_id", wedding.id).order("sort").order("created_at"),
    supabase.from("gift_reservations").select("id, gift_id, household_id, created_at").eq("wedding_id", wedding.id).is("cancelled_at", null),
    supabase.from("gift_contributions").select("id, gift_id, household_id, display_name, amount, confirmed_at, created_at").eq("wedding_id", wedding.id).order("created_at"),
    supabase.from("received_gifts").select("id, household_id, description, amount, source, source_id, created_at").eq("wedding_id", wedding.id).order("created_at"),
    supabase.from("households").select("id, name, email, thanked_at").eq("wedding_id", wedding.id).order("name"),
    supabase.from("gift_settings").select("reveal_reservations, iban").eq("wedding_id", wedding.id).maybeSingle(),
    supabase.from("site_pages").select("sections").eq("wedding_id", wedding.id).eq("state", "draft").maybeSingle(),
    moduleLevel(wedding.id, "gifts"),
  ]);
  const sectionOn = ((page.data?.sections ?? []) as { type: string; enabled?: boolean }[]).some((s) => s.type === "gifts" && s.enabled !== false);

  return (
    <GiftsView
      tab={tab === "obdrzene" ? "obdrzene" : tab === "nastaveni" ? "nastaveni" : "seznam"}
      weddingId={wedding.id}
      canEdit={level === "write"}
      sectionOn={sectionOn}
      reveal={settings.data?.reveal_reservations ?? true}
      hasAccount={!!settings.data?.iban}
      gifts={(gifts.data ?? []).map((g) => ({ ...g, price: g.price === null ? null : Number(g.price), target_amount: g.target_amount === null ? null : Number(g.target_amount) })) as Gift[]}
      reservations={(reservations.data ?? []) as Reservation[]}
      contributions={(contributions.data ?? []).map((c) => ({ ...c, amount: Number(c.amount) })) as Contribution[]}
      received={(received.data ?? []).map((r) => ({ ...r, amount: r.amount === null ? null : Number(r.amount) })) as Received[]}
      households={(households.data ?? []).map((h) => ({ id: h.id, name: h.name, email: h.email, thanked: !!h.thanked_at }))}
    />
  );
}
