import { useEffect, useRef } from "react";
import type { StopDto } from "../api/client";
import { clearLivePin, pinNextStop } from "../lib/liveNotifications";

/** Keep the next stop on the lock screen while the round is live. */
export function useLiveLockNotifications(opts: {
  live: boolean;
  current: StopDto | null;
  returnHm?: string | null;
  leftCount?: number;
}) {
  const { live, current, returnHm, leftCount } = opts;
  const lastId = useRef<number | null>(null);

  useEffect(() => {
    if (!live || !current) {
      lastId.current = null;
      void clearLivePin();
      return;
    }
    const buzz = lastId.current !== current.id;
    lastId.current = current.id;
    void pinNextStop(
      {
        name: current.customer_name,
        eta: current.eta,
        returnHm,
        left: leftCount,
      },
      { buzz },
    );
  }, [live, current, returnHm, leftCount]);

  useEffect(() => {
    if (!live || !current) return;
    const onVis = () => {
      if (document.visibilityState !== "hidden") return;
      void pinNextStop(
        {
          name: current.customer_name,
          eta: current.eta,
          returnHm,
          left: leftCount,
        },
        { buzz: true },
      );
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [live, current, returnHm, leftCount]);
}
