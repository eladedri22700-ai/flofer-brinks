import { useEffect, useRef } from "react";

/** Keep the screen awake while Live Mode is active. */
export function useWakeLock(enabled: boolean) {
  const sentinel = useRef<WakeLockSentinel | null>(null);

  useEffect(() => {
    if (!enabled) {
      void sentinel.current?.release();
      sentinel.current = null;
      return;
    }
    let cancelled = false;
    async function acquire() {
      try {
        if (!("wakeLock" in navigator)) return;
        const s = await navigator.wakeLock.request("screen");
        if (cancelled) {
          void s.release();
          return;
        }
        sentinel.current = s;
        s.addEventListener("release", () => {
          if (sentinel.current === s) sentinel.current = null;
        });
      } catch {
        /* unsupported / denied */
      }
    }
    void acquire();
    const onVis = () => {
      if (document.visibilityState === "visible" && enabled) void acquire();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVis);
      void sentinel.current?.release();
      sentinel.current = null;
    };
  }, [enabled]);
}
