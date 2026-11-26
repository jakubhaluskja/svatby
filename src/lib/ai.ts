import "server-only";

/**
 * Pomoc s texty přes Claude API (Anthropic). Bez ANTHROPIC_API_KEY je funkce vypnutá.
 */
export function aiEnabled(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}

export async function generateText(system: string, prompt: string, maxTokens = 700): Promise<string | null> {
  if (!aiEnabled()) return null;
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": process.env.ANTHROPIC_API_KEY!,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.AI_MODEL || "claude-haiku-5-5",
        max_tokens: maxTokens,
        system,
        messages: [{ role: "user", content: prompt }],
      }),
      cache: "no-store",
    });
    if (!res.ok) {
      console.error("ai", res.status, await res.text().catch(() => ""));
      return null;
    }
    const json = (await res.json()) as { content?: { type: string; text?: string }[] };
    return (json.content ?? [])
      .filter((c) => c.type === "text")
      .map((c) => c.text ?? "")
      .join("")
      .trim();
  } catch (e) {
    console.error("ai", e);
    return null;
  }
}
