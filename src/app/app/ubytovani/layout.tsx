import { requireModule } from "@/lib/wedding";

export default async function ModuleLayout({ children }: { children: React.ReactNode }) {
  await requireModule("lodging");
  return children;
}
