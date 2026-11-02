import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { resolveWedding } from "@/lib/site";

type Props = { params: Promise<{ site: string }> };

// Svatební weby se nikdy neindexují.
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function WeddingSite({ params }: Props) {
  const { site } = await params;
  const wedding = await resolveWedding(site);
  if (!wedding) notFound();

  const date = wedding.wedding_date
    ? new Intl.DateTimeFormat("cs-CZ", { dateStyle: "long" }).format(new Date(wedding.wedding_date))
    : null;

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center gap-3 px-6 text-center">
      <h1 className="text-4xl font-semibold">
        {wedding.partner1_name} &amp; {wedding.partner2_name}
      </h1>
      {date && <p className="text-lg text-neutral-600">{date}</p>}
    </main>
  );
}
