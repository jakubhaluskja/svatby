import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "quiet" }) {
  const base =
    "inline-flex h-11 items-center justify-center rounded-full px-6 text-[15px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50";
  const styles =
    variant === "primary"
      ? "bg-eucalyptus text-white hover:bg-eucalyptus-deep"
      : "text-ink-soft hover:text-ink hover:bg-eucalyptus-mist";
  return <button className={`${base} ${styles} ${className}`} {...props} />;
}

export function Field({
  label,
  hint,
  error,
  className = "",
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: ReactNode; error?: string }) {
  const id = props.id ?? props.name;
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label htmlFor={id} className="text-sm font-medium text-ink">
        {label}
      </label>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error || hint ? `${id}-note` : undefined}
        className="h-11 rounded-lg border border-line bg-surface px-3.5 text-[15px] text-ink placeholder:text-ink-soft/60 focus:border-eucalyptus focus:outline-none aria-[invalid]:border-danger"
        {...props}
      />
      {error ? (
        <p id={`${id}-note`} className="text-sm text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-note`} className="text-sm text-ink-soft">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function FormMessage({ tone = "error", children }: { tone?: "error" | "info"; children: ReactNode }) {
  return (
    <p
      role={tone === "error" ? "alert" : "status"}
      className={`rounded-lg px-3.5 py-2.5 text-sm ${
        tone === "error" ? "bg-danger/8 text-danger" : "bg-eucalyptus-mist text-eucalyptus-deep"
      }`}
    >
      {children}
    </p>
  );
}

/** Slovní značka aplikace, dokud nebude zvolený název. */
export function Wordmark({ className = "" }: { className?: string }) {
  return <span className={`font-serif text-[22px] font-medium tracking-tight text-ink ${className}`}>Svatby</span>;
}

/** Karta obsahu v administraci. */
export function Card({ children, className = "", as: Tag = "section" }: { children: ReactNode; className?: string; as?: "section" | "div" | "article" | "li" }) {
  return <Tag className={`rounded-2xl bg-surface shadow-card ring-1 ring-line/70 ${className}`}>{children}</Tag>;
}

/** Malý nadpis skupiny verzálkami. */
export function Eyebrow({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <p className={`text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-soft/80 ${className}`}>{children}</p>;
}

const AVATAR_COLORS = ["#4f7263", "#7b3f5c", "#4a5f8a", "#b8913a", "#c08a5b"];

/** Kolečko s iniciálami, barva odvozená od jména. */
export function Avatar({ name, size = "md" }: { name: string; size?: "sm" | "md" }) {
  const letters = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return (
    <span
      title={name}
      className={`grid shrink-0 place-items-center rounded-full font-semibold text-white ring-2 ring-surface ${size === "sm" ? "size-6 text-[10px]" : "size-7 text-[11px]"}`}
      style={{ background: AVATAR_COLORS[h % AVATAR_COLORS.length] }}
    >
      {letters || "?"}
    </span>
  );
}
