"use client";

export function PrintButton({ label = "Vytisknout nebo uložit jako PDF" }: { label?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="h-10 rounded-full bg-eucalyptus px-5 text-sm font-medium text-white hover:bg-eucalyptus-deep print:hidden"
    >
      {label}
    </button>
  );
}
