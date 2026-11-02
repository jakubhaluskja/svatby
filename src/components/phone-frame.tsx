import type { ReactNode } from "react";

/** Rámeček telefonu pro náhled svatebního webu – většina hostů web otevře v mobilu. */
export function PhoneFrame({ children, address }: { children: ReactNode; address?: string }) {
  return (
    <div className="w-[300px] rounded-[2.6rem] bg-ink p-2.5 shadow-[0_30px_60px_-20px_rgba(30,43,38,0.45)]">
      <div className="flex h-[600px] flex-col overflow-hidden rounded-[2.1rem] bg-white">
        <div className="flex h-9 shrink-0 items-center justify-center bg-white px-4">
          <span className="truncate rounded-full bg-paper px-3 py-1 text-[11px] text-ink-soft">
            {address ?? " "}
          </span>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}
