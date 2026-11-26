import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { Question } from "@/lib/rsvp-questions";
import { moduleLevel, requireWedding } from "@/lib/wedding";
import { QuestionsView } from "./questions-view";

export const metadata = { title: "Otázky v RSVP" };

export default async function QuestionsPage() {
  const wedding = await requireWedding();
  const supabase = await createClient();
  const [{ data: questions }, { data: answers }, { data: events }, { data: households }, { data: guests }, { data: w }, level] = await Promise.all([
    supabase.from("rsvp_questions").select("id, label, help, kind, options, scope, required, only_coming, event_id, sort").eq("wedding_id", wedding.id).order("sort").order("created_at"),
    supabase.from("rsvp_answers").select("question_id, household_id, guest_id, value").eq("wedding_id", wedding.id),
    supabase.from("events").select("id, name").eq("wedding_id", wedding.id).order("starts_at", { nullsFirst: false }),
    supabase.from("households").select("id, name").eq("wedding_id", wedding.id),
    supabase.from("guests").select("id, first_name, last_name").eq("wedding_id", wedding.id),
    supabase.from("weddings").select("locales").eq("id", wedding.id).single(),
    moduleLevel(wedding.id, "guests"),
  ]);
  const hName = new Map((households ?? []).map((h) => [h.id, h.name]));
  const gName = new Map((guests ?? []).map((g) => [g.id, [g.first_name, g.last_name].filter(Boolean).join(" ")]));

  return (
    <div className="flex max-w-4xl flex-col gap-8 px-6 py-8 sm:px-10 lg:py-10">
      <div className="flex flex-col gap-2">
        <Link href="/app/hoste" className="text-sm text-ink-soft hover:text-ink">
          Zpět na hosty
        </Link>
        <h1 className="font-serif text-4xl tracking-tight">Otázky v RSVP</h1>
        <p className="max-w-2xl text-ink-soft">
          Na co se chcete hostů zeptat kromě účasti, jídla a alergií – třeba jestli pojedou autobusem, co si dají k hlavnímu chodu nebo jestli zůstanou do rána.
          Ubytování, písničku a vzkaz se formulář ptá sám.
        </p>
      </div>
      <QuestionsView
        canEdit={level === "write"}
        english={(w?.locales ?? []).includes("en")}
        questions={(questions ?? []) as Question[]}
        events={(events ?? []).map((e) => ({ id: e.id, name: (e.name as { cs?: string }).cs ?? "Událost" }))}
        answers={(answers ?? []).map((a) => ({
          questionId: a.question_id,
          value: a.value,
          who: a.guest_id ? (gName.get(a.guest_id) ?? "host") : (hName.get(a.household_id) ?? "domácnost"),
        }))}
      />
    </div>
  );
}
