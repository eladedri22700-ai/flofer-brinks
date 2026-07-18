import { useEffect, useState } from "react";

export type LivePoint = { lat: number; lng: number };

/** Lightweight GPS watch for map display (no geofence logic). */
export function useLivePosition(enabled = true) {
  const [position, setPosition] = useState<LivePoint | null>(null);
  const [denied, setDenied] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    if (!("geolocation" in navigator)) {
      setDenied(true);
      setReady(true);
      return;
    }

    const id = navigator.geolocation.watchPosition(
      (fix) => {
        setPosition({ lat: fix.coords.latitude, lng: fix.coords.longitude });
        setDenied(false);
        setReady(true);
      },
      () => {
        setDenied(true);
        setReady(true);
      },
      { enableHighAccuracy: true, maximumAge: 8_000, timeout: 20_000 },
    );

    return () => navigator.geolocation.clearWatch(id);
  }, [enabled]);

  return { position, denied, ready };
}
