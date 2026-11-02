import { describe, expect, it } from "vitest";
import { daysTo, overdue, periodOf, thisWeek, timeline, type ChecklistTask } from "./checklist";

const T = (id: string, due: string | null, done = false, parent: string | null = null): ChecklistTask => ({
  id,
  parent_id: parent,
  title: id,
  description: null,
  due_date: due,
  done_at: done ? "2026-01-01T00:00:00Z" : null,
  assignee_member_id: null,
  assignee_name: null,
  assignee_email: null,
  source: "custom",
  sort: 0,
});

describe("checklist", () => {
  it("období podle vzdálenosti od svatby", () => {
    const w = "2027-06-12";
    expect(periodOf("2026-05-01", w)).toBe("12m");
    expect(periodOf("2026-12-12", w)).toBe("6m");
    expect(periodOf("2027-06-05", w)).toBe("1w");
    expect(periodOf("2027-06-12", w)).toBe("d");
    expect(periodOf("2027-07-01", w)).toBe("after");
  });

  it("časová osa vynechá prázdná období a podúkoly", () => {
    const b = timeline([T("a", "2026-05-01"), T("b", null), T("c", "2027-06-12"), T("sub", "2027-06-12", false, "c")], "2027-06-12");
    expect(b.map((x) => x.key)).toEqual(["12m", "d", "none"]);
    expect(b.find((x) => x.key === "d")!.tasks.map((t) => t.id)).toEqual(["c"]);
  });

  it("bez data svatby jen s termínem a bez termínu", () => {
    expect(timeline([T("a", "2026-05-01"), T("b", null)], null).map((x) => x.key)).toEqual(["dated", "none"]);
  });

  it("po termínu a tento týden", () => {
    const tasks = [T("old", "2026-10-01"), T("doneOld", "2026-10-01", true), T("today", "2026-11-02"), T("in6", "2026-11-08"), T("in7", "2026-11-09")];
    expect(overdue(tasks, "2026-11-02").map((t) => t.id)).toEqual(["old"]);
    expect(thisWeek(tasks, "2026-11-02").map((t) => t.id)).toEqual(["today", "in6"]);
    expect(daysTo("2026-11-01", "2026-11-02")).toBe(-1);
  });
});
