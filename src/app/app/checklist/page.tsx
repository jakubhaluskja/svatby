import type { ChecklistTask } from "@/lib/checklist";
import { createClient } from "@/lib/supabase/server";
import { utcToZonedParts } from "@/lib/time";
import { moduleLevel, requireUser, requireWedding } from "@/lib/wedding";
import { ChecklistView } from "./checklist-view";

export const metadata = { title: "Checklist" };

type Props = { searchParams: Promise<{ ukol?: string }> };

export default async function ChecklistPage({ searchParams }: Props) {
  const { ukol } = await searchParams;
  const [wedding, user] = await Promise.all([requireWedding(), requireUser()]);
  const supabase = await createClient();
  const [{ data: tasks }, { data: members }, level] = await Promise.all([
    supabase
      .from("tasks")
      .select("id, parent_id, title, description, due_date, done_at, assignee_member_id, assignee_name, assignee_email, source, sort, category")
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
    <ChecklistView
      tasks={(tasks ?? []) as ChecklistTask[]}
      weddingDate={wedding.wedding_date}
      today={utcToZonedParts(new Date().toISOString()).date}
      members={memberList}
      canEdit={level === "write"}
      initialTask={ukol && /^[0-9a-f-]{36}$/.test(ukol) ? ukol : null}
    />
  );
}
