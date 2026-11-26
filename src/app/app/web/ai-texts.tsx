"use client";

import { useState } from "react";
import { AiWriter } from "@/components/ai-writer";

/** Návrhy textů na web (úvod, příběh) ke zkopírování do editoru. */
export function AiTexts() {
  const [kind, setKind] = useState<"welcome" | "story">("welcome");
  const [text, setText] = useState("");
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex flex-col gap-3 rounded-2xl bg-surface p-5 shadow-card ring-1 ring-line/70">
      <div className="flex flex-wrap gap-1 rounded-full bg-paper p-1 text-sm sm:self-start">
        {(
          [
            ["welcome", "Uvítání"],
            ["story", "Náš příběh"],
          ] as const
        ).map(([k, l]) => (
          <button key={k} type="button" onClick={() => setKind(k)} className={`rounded-full px-3.5 py-1 ${kind === k ? "bg-surface font-medium shadow-card" : "text-ink-soft"}`}>
            {l}
          </button>
        ))}
      </div>
      <AiWriter
        key={kind}
        kind={kind}
        onText={setText}
        placeholder={kind === "story" ? "Jak jste se poznali, první rande, žádost o ruku… pár hesel stačí." : "Co hosty čeká, na co se těšíte, praktické info…"}
      />
      {text ? (
        <>
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={8} className="w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-[15px] leading-relaxed focus:border-eucalyptus focus:outline-none" />
          <div className="flex items-center gap-3 text-sm">
            <button type="button" onClick={() => void navigator.clipboard.writeText(text).then(() => setCopied(true))} className="h-9 rounded-full bg-ink px-4 font-medium text-white">
              {copied ? "Zkopírováno" : "Kopírovat"}
            </button>
            <span className="text-ink-soft">Pak ho vložte do sekce v editoru webu.</span>
          </div>
        </>
      ) : null}
    </div>
  );
}
