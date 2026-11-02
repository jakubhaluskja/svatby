/** Oznámení nahoře na svatebním webu (plán B, zprávy v den svatby). */
export function SiteNotices({ notices }: { notices: string[] }) {
  if (notices.length === 0) return null;
  return (
    <div role="status" className="flex flex-col">
      {notices.map((n, i) => (
        <p key={i} className="px-6 py-3 text-center text-[15px] font-medium text-white" style={{ background: "var(--site-accent)" }}>
          {n}
        </p>
      ))}
    </div>
  );
}
