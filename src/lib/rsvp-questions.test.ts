import { describe, expect, it } from "vitest";
import { answerLabel, applies, checkAnswers, type GuestQuestion } from "./rsvp-questions";

const meal: GuestQuestion = { id: "q1", label: "Jídlo", help: "", kind: "choice", options: [{ id: "a", label: "Maso" }, { id: "b", label: "Vege" }], scope: "guest", required: true, onlyComing: true, eventId: "party" };
const bus: GuestQuestion = { id: "q2", label: "Autobus?", help: "", kind: "yesno", options: [], scope: "household", required: false, onlyComing: true, eventId: null };
const note: GuestQuestion = { id: "q3", label: "Poznámka", help: "", kind: "text", options: [], scope: "household", required: false, onlyComing: false, eventId: null };

describe("vlastní otázky v RSVP", () => {
  it("otázka k události jen pro pozvané a přicházející", () => {
    expect(applies(meal, { invitedEvents: ["obrad"], attending: { obrad: "yes" } })).toBe(false);
    expect(applies(meal, { invitedEvents: ["party"], attending: { party: "no" } })).toBe(false);
    expect(applies(meal, { invitedEvents: ["party"], attending: { party: "yes" } })).toBe(true);
    expect(applies(note, { invitedEvents: [], attending: {} })).toBe(true);
  });

  it("povinná otázka u přicházejícího hosta", () => {
    const ctx = { invitedEvents: ["party"], guests: [{ id: "g1", attending: { party: "yes" as const } }, { id: "g2", attending: { party: "no" as const } }] };
    expect(checkAnswers([meal], [], ctx)).toEqual({ ok: false, missing: "q1" });
    const r = checkAnswers([meal, bus, note], [{ question_id: "q1", guest_id: "g1", value: "b" }, { question_id: "q2", guest_id: null, value: "yes" }, { question_id: "q1", guest_id: "g2", value: "a" }], ctx);
    expect(r).toEqual({ ok: true, answers: [{ question_id: "q1", guest_id: "g1", value: "b" }, { question_id: "q2", guest_id: null, value: "yes" }] });
  });

  it("neplatné hodnoty zahodí", () => {
    const ctx = { invitedEvents: ["party"], guests: [{ id: "g1", attending: { party: "yes" as const } }] };
    const r = checkAnswers([bus, { ...meal, required: false }], [{ question_id: "q2", guest_id: null, value: "možná" }, { question_id: "q1", guest_id: "g1", value: "zzz" }], ctx);
    expect(r).toEqual({ ok: true, answers: [] });
  });

  it("popisky odpovědí", () => {
    expect(answerLabel({ kind: "yesno", options: [] }, "yes")).toBe("Ano");
    expect(answerLabel({ kind: "choice", options: [{ id: "a", cs: "Maso" }] }, "a")).toBe("Maso");
  });
});
