import { redirect } from "next/navigation";
import { linkDomain } from "@/lib/domain";
import { getCurrentWedding } from "@/lib/wedding";
import { Wizard } from "./wizard";

export const metadata = { title: "Založení svatby" };

export default async function CreateWeddingPage() {
  if (await getCurrentWedding()) redirect("/app");
  const domain = await linkDomain();
  return <Wizard appDomain={domain} />;
}
