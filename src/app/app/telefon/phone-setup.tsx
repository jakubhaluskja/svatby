"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/icons";

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

export function PhoneSetup({ ics }: { ics: string | null }) {
  const [prompt, setPrompt] = useState<InstallEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [platform, setPlatform] = useState<"ios" | "android" | "desktop">("desktop");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const ua = navigator.userAgent;
    setPlatform(/iPhone|iPad|iPod/.test(ua) ? "ios" : /Android/.test(ua) ? "android" : "desktop");
    setInstalled(window.matchMedia("(display-mode: standalone)").matches);
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setPrompt(e as InstallEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", () => setInstalled(true));
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  const webcal = ics?.replace(/^https?:\/\//, "webcal://");

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-4 rounded-2xl bg-surface p-6 shadow-card ring-1 ring-line/70">
        <div className="flex items-center gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icons/icon-192.png" alt="" className="size-14 rounded-2xl" />
          <div>
            <h2 className="font-serif text-2xl">Aplikace na plochu</h2>
            <p className="text-sm text-ink-soft">Otevře se na celou obrazovku jako běžná aplikace, bez stahování z obchodu.</p>
          </div>
        </div>
        {installed ? (
          <p className="rounded-xl bg-eucalyptus-mist px-4 py-3 text-sm text-eucalyptus-deep">Aplikaci už máte nainstalovanou. 🎉</p>
        ) : prompt ? (
          <button
            type="button"
            onClick={async () => {
              await prompt.prompt();
              const r = await prompt.userChoice;
              if (r.outcome === "accepted") setInstalled(true);
              setPrompt(null);
            }}
            className="inline-flex h-11 items-center gap-2 self-start rounded-full bg-eucalyptus px-6 font-medium text-white hover:bg-eucalyptus-deep"
          >
            <Icon n="plus" className="size-4" />
            Přidat na plochu
          </button>
        ) : (
          <ol className="flex flex-col gap-2 text-[15px]">
            {platform === "ios" ? (
              <>
                <li>1. Otevřete tuto stránku v Safari.</li>
                <li>
                  2. Klepněte na <strong>Sdílet</strong> (čtvereček se šipkou nahoru).
                </li>
                <li>
                  3. Zvolte <strong>Přidat na plochu</strong> a potvrďte.
                </li>
              </>
            ) : platform === "android" ? (
              <>
                <li>1. Otevřete tuto stránku v Chromu.</li>
                <li>
                  2. Klepněte na <strong>⋮</strong> vpravo nahoře.
                </li>
                <li>
                  3. Zvolte <strong>Přidat na plochu</strong> nebo <strong>Nainstalovat aplikaci</strong>.
                </li>
              </>
            ) : (
              <>
                <li>Na telefonu otevřete aplikaci v prohlížeči a přidejte si ji na plochu (Safari: Sdílet → Přidat na plochu, Chrome: ⋮ → Nainstalovat).</li>
                <li>V Chromu na počítači ji nainstalujete ikonou v adresním řádku.</li>
              </>
            )}
          </ol>
        )}
      </section>

      <section className="flex flex-col gap-4 rounded-2xl bg-surface p-6 shadow-card ring-1 ring-line/70">
        <div>
          <h2 className="font-serif text-2xl">Kalendář</h2>
          <p className="text-sm text-ink-soft">
            Úkoly s termínem, splatné platby a program svatby se objeví ve vašem kalendáři a samy se aktualizují (obvykle během několika hodin). Odkaz je jen váš –
            nesdílejte ho.
          </p>
        </div>
        {ics && webcal ? (
          <>
            <div className="flex flex-wrap gap-2">
              <a href={webcal} className="inline-flex h-10 items-center rounded-full bg-ink px-5 text-sm font-medium text-white hover:bg-ink/85">
                Apple / Outlook kalendář
              </a>
              <a
                href={`https://calendar.google.com/calendar/r?cid=${encodeURIComponent(webcal)}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-10 items-center rounded-full border border-line px-5 text-sm font-medium hover:border-eucalyptus"
              >
                Google Kalendář
              </a>
              <button
                type="button"
                onClick={() => void navigator.clipboard.writeText(ics).then(() => setCopied(true))}
                className="inline-flex h-10 items-center gap-2 rounded-full border border-line px-5 text-sm font-medium hover:border-eucalyptus"
              >
                <Icon n="link" className="size-4" />
                {copied ? "Zkopírováno" : "Kopírovat odkaz"}
              </button>
            </div>
            <p className="text-xs text-ink-soft">Co v kalendáři uvidíte, se řídí vaším přístupem ke svatbě (spoluorganizátor vidí jen povolené části).</p>
          </>
        ) : (
          <p className="text-sm text-ink-soft">Kalendář je dostupný po přijetí pozvánky do týmu.</p>
        )}
      </section>
    </div>
  );
}
