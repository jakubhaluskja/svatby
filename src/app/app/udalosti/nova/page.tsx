import { requireWedding } from "@/lib/wedding";
import { EventForm } from "../event-form";

export const metadata = { title: "Nová událost" };

export default async function NewEventPage() {
  const wedding = await requireWedding();
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8 px-6 py-10 sm:px-10">
      <h1 className="font-display text-4xl font-semibold tracking-tight">Nová událost</h1>
      <EventForm eventId={null} defaults={{ date: wedding.wedding_date ?? undefined }} showEnglish />
    </div>
  );
}
