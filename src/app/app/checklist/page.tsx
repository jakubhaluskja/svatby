import type { ChecklistTask } from "@/lib/checklist";
import { createClient } from "@/lib/supabase/server";
import { utcToZonedParts } from "@/lib/time";
import { moduleLevel, requireUser, requireWedding } from "@/lib/wedding";
import { ChecklistView } from "./checklist-view";

export const metadata = { title: "Checklist" };

export default async function ChecklistPage() {
  const [wedding, user] = await Promise.all([requireWedding(), requireUser()]);
  const supabase = await createClient();
  const [{ data: tasks }, { data: members }, level] = await Promise.all([
    supabase
      .from("tasks")
      .select("id, parent_id, title, description, due_date, done_at, assignee_member_id, assignee_name, assignee_email, source, sort")
      .eq("wedding_id", wedding.id)
      .order("due_date", { ascending: true, nullsFirst: false })
      .order("sort"),
    supabase.from("wedding_members").select("id, role, display_name, invited_email, user_id").eq("wedding_id", wedding.id).not("accepted_at", "is", null),
    moduleLevel(wedding.id, "checklist"),
  ]);

  const { data: me } = await supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle();
  const roleName = { owner: "Vlastník", partner: "Partner/ka", coorganizer: "Spoluorganizátor" } as Record<string, string>;
  const memberList = (members ?? []).map((m) => ({
    id: m.id as string,
    name:
      (m.display_name as string | null) ||
      (m.user_id === user.id ? me?.full_name || user.email || null : null) ||
      (m.invited_email as string | null) ||
      roleName[m.role as string],
  }));

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8 px-6 py-10 sm:px-10">
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-4xl font-semibold tracking-tight">Checklist</h1>
        <p className="text-ink-soft">
          Úkoly s termíny podle data svatby. Když datum změníte, termíny z výchozího seznamu se posunou samy.
        </p>
      </div>
      <ChecklistView
        tasks={(tasks ?? []) as ChecklistTask[]}
        weddingDate={wedding.wedding_date}
        today={utcToZonedParts(new Date().toISOString()).date}
        members={memberList}
        canEdit={level === "write"}
      />
    </div>
  );
}
