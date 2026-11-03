"use client";

/** Kulaté zaškrtávátko úkolu. */
export function CheckCircle({ checked, onChange, label, size = "md" }: { checked: boolean; onChange: (v: boolean) => void; label: string; size?: "sm" | "md" }) {
  const dim = size === "sm" ? "size-[18px]" : "size-[22px]";
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`grid ${dim} shrink-0 place-items-center rounded-full border-[1.5px] transition-colors ${
        checked ? "border-eucalyptus bg-eucalyptus text-white" : "border-[#b9c6bf] hover:border-eucalyptus"
      }`}
    >
      {checked ? (
        <svg viewBox="0 0 24 24" className={size === "sm" ? "size-3" : "size-3.5"} fill="none" stroke="currentColor" strokeWidth="3" aria-hidden>
          <path d="m6 12 4 4 8-8" />
        </svg>
      ) : null}
    </button>
  );
}
