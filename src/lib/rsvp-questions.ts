/** Vlastní otázky v RSVP – sdílené typy a ověření odpovědí (server i prohlížeč). */
export type L = { cs?: string; en?: string };
export type QuestionKind = "text" | "choice" | "yesno";

export type Question = {
  id: string;
  label: L;
  help: L;
  kind: QuestionKind;
  options: { id: string; cs?: string; en?: string }[];
  scope: "household" | "guest";
  required: boolean;
  only_coming: boolean;
  event_id: string | null;
  sort: number;
};

/** Otázka v jazyce hosta. */
export type GuestQuestion = {
  id: string;
  label: string;
  help: string;
  kind: QuestionKind;
  options: { id: string; label: string }[];
  scope: "household" | "guest";
  required: boolean;
  onlyComing: boolean;
  eventId: string | null;
};

export type Answer = { question_id: string; guest_id: string | null; value: string };

const pick = (v: L | undefined, locale: "cs" | "en") => (v?.[locale] || v?.cs || v?.en || "").trim();

export function localizeQuestions(list: Question[], locale: "cs" | "en"): GuestQuestion[] {
  return list.map((q) => ({
    id: q.id,
    label: pick(q.label, locale),
    help: pick(q.help, locale),
    kind: q.kind,
    options: q.options.map((o) => ({ id: o.id, label: pick(o, locale) })),
    scope: q.scope,
    required: q.required,
    onlyComing: q.only_coming,
    eventId: q.event_id,
  }));
}

/** Platí otázka pro domácnost / hosta? (pozvánka na událost, účast) */
export function applies(
  q: Pick<GuestQuestion, "onlyComing" | "eventId">,
  ctx: { invitedEvents: string[]; attending: Record<string, "yes" | "no" | undefined> },
): boolean {
  if (q.eventId && !ctx.invitedEvents.includes(q.eventId)) return false;
  if (!q.onlyComing) return true;
  if (q.eventId) return ctx.attending[q.eventId] === "yes";
  return Object.values(ctx.attending).includes("yes");
}

/** Je hodnota platná odpověď na otázku? Prázdná hodnota = bez odpovědi. */
export function validValue(q: Pick<GuestQuestion, "kind" | "options">, value: string): boolean {
  if (q.kind === "yesno") return value === "yes" || value === "no";
  if (q.kind === "choice") return q.options.some((o) => o.id === value);
  return value.trim().length > 0 && value.length <= 500;
}

/**
 * Ověří odpovědi domácnosti: jen známé otázky a hosté, platné hodnoty, vyplněné povinné.
 * guests = hosté domácnosti s jejich účastí na událostech.
 */
export function checkAnswers(
  questions: GuestQuestion[],
  answers: Answer[],
  ctx: { invitedEvents: string[]; guests: { id: string; attending: Record<string, "yes" | "no" | undefined> }[] },
): { ok: true; answers: Answer[] } | { ok: false; missing: string } {
  const out: Answer[] = [];
  const householdAttending: Record<string, "yes" | "no" | undefined> = {};
  for (const g of ctx.guests) for (const [e, s] of Object.entries(g.attending)) if (s === "yes" || householdAttending[e] === undefined) householdAttending[e] = s;

  for (const q of questions) {
    const targets: (string | null)[] =
      q.scope === "household"
        ? applies(q, { invitedEvents: ctx.invitedEvents, attending: householdAttending })
          ? [null]
          : []
        : ctx.guests.filter((g) => applies(q, { invitedEvents: ctx.invitedEvents, attending: g.attending })).map((g) => g.id);
    for (const target of targets) {
      const a = answers.find((x) => x.question_id === q.id && (x.guest_id ?? null) === target);
      const value = (a?.value ?? "").trim();
      if (value && validValue(q, value)) out.push({ question_id: q.id, guest_id: target, value: value.slice(0, 500) });
      else if (q.required) return { ok: false, missing: q.id };
    }
  }
  return { ok: true, answers: out };
}

/** Text odpovědi pro přehledy a export. */
export function answerLabel(q: Pick<Question, "kind" | "options">, value: string, locale: "cs" | "en" = "cs"): string {
  if (q.kind === "yesno") return value === "yes" ? (locale === "cs" ? "Ano" : "Yes") : locale === "cs" ? "Ne" : "No";
  if (q.kind === "choice") return pick(q.options.find((o) => o.id === value), locale) || value;
  return value;
}
