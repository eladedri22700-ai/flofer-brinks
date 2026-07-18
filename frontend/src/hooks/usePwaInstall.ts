import { useEffect, useState } from "react";
import { isStandaloneDisplay } from "../lib/onboarding";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

/** Captures Chrome/Android install prompt when the browser offers it. */
export function usePwaInstall() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(isStandaloneDisplay());

  useEffect(() => {
    const onBip = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferred(null);
    };
    window.addEventListener("beforeinstallprompt", onBip);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBip);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  async function promptInstall(): Promise<"accepted" | "dismissed" | "unavailable"> {
    if (installed) return "accepted";
    if (!deferred) return "unavailable";
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    if (outcome === "accepted") {
      setInstalled(true);
      setDeferred(null);
    }
    return outcome;
  }

  return { canPrompt: Boolean(deferred) && !installed, installed, promptInstall };
}
