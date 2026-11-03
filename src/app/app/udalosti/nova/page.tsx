import { requireWedding } from "@/lib/wedding";
import { EventForm } from "../event-form";

export const metadata = { title: "Nová událost" };

export default async function NewEventPage() {
  const wedding = await requireWedding();
  return (
    <div className="flex max-w-3xl flex-col gap-8 px-6 py-8 sm:px-10 lg:py-10">
      <h1 className="font-serif text-4xl tracking-tight">Nová událost</h1>
      <EventForm eventId={null} defaults={{ date: wedding.wedding_date ?? undefined }} showEnglish />
    </div>
  );
}
