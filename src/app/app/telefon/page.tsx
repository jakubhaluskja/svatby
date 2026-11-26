import { appOrigin } from "@/lib/email/guest-mail";
import { linkDomain } from "@/lib/domain";
import { createClient } from "@/lib/supabase/server";
import { requireUser, requireWedding } from "@/lib/wedding";
import { PhoneSetup } from "./phone-setup";

export const metadata = { title: "Do telefonu" };

export default async function PhonePage() {
  const [wedding, user] = await Promise.all([requireWedding(), requireUser()]);
  const supabase = await createClient();
  const { data: me } = await supabase.from("wedding_members").select("calendar_token").eq("wedding_id", wedding.id).eq("user_id", user.id).maybeSingle();
  const origin = appOrigin(await linkDomain());
  const ics = me?.calendar_token ? `${origin}/api/kalendar/${me.calendar_token}.ics` : null;
  return (
    <div className="flex max-w-3xl flex-col gap-8 px-6 py-8 sm:px-10 lg:py-10">
      <div className="flex flex-col gap-2">
        <h1 className="font-serif text-4xl tracking-tight">Do telefonu</h1>
        <p className="max-w-2xl text-ink-soft">Mějte svatbu po ruce: aplikace na ploše telefonu a termíny úkolů, plateb a programu přímo ve vašem kalendáři.</p>
      </div>
      <PhoneSetup ics={ics} />
    </div>
  );
}
