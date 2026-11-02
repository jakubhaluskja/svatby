import Link from "next/link";
import { PhoneFrame } from "@/components/phone-frame";
import { SiteHero } from "@/components/site/site-hero";
import { Wordmark } from "@/components/ui";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-svh lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="flex flex-col px-6 py-8 sm:px-12">
        <Link href="/" className="self-start">
          <Wordmark />
        </Link>
        <main className="flex flex-1 items-center py-10">
          <div className="w-full max-w-sm">{children}</div>
        </main>
      </div>

      <aside
        aria-hidden
        className="hidden items-center justify-center bg-eucalyptus-mist lg:flex"
      >
        <div className="flex flex-col items-center gap-6">
          <PhoneFrame address="jana-a-petr.svatby.cz">
            <SiteHero partner1="Jana" partner2="Petr" date="2027-06-12" place="Zámek Hrubá Skála" template="romantic" compact />
          </PhoneFrame>
          <p className="max-w-[18rem] text-center text-sm text-ink-soft">
            Takhle může vypadat váš svatební web. Založíte ho za pár minut.
          </p>
        </div>
      </aside>
    </div>
  );
}
