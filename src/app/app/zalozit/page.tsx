import { redirect } from "next/navigation";
import { appDomain } from "@/lib/env";
import { getCurrentWedding } from "@/lib/wedding";
import { Wizard } from "./wizard";

export const metadata = { title: "Založení svatby" };

export default async function CreateWeddingPage() {
  if (await getCurrentWedding()) redirect("/app");
  return <Wizard appDomain={appDomain()} />;
}
