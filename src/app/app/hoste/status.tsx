import type { RsvpStatus } from "@/lib/guest-data";

const LABEL: Record<RsvpStatus, string> = { yes: "Přijde", no: "Nepřijde", pending: "Čeká" };
const STYLE: Record<RsvpStatus, string> = {
  yes: "bg-eucalyptus-mist text-eucalyptus-deep",
  no: "bg-plum/10 text-plum",
  pending: "bg-paper text-ink-soft",
};

export function StatusBadge({ status, label }: { status: RsvpStatus; label?: string }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STYLE[status]}`}>
      {label ?? LABEL[status]}
    </span>
  );
}

export const STATUS_LABEL = LABEL;
