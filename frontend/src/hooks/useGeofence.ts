import { useEffect, useRef, useState } from "react";

export type GeoPoint = { lat: number; lng: number };

function haversineM(a: GeoPoint, b: GeoPoint): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const la1 = toRad(a.lat);
  const la2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

type Options = {
  enabled: boolean;
  target: GeoPoint | null;
  depot: GeoPoint | null;
  radiusM: number;
  /** Distance at which "approaching" fires once per stop (default 600m). */
  approachM?: number;
  onEnterTarget: (pos: GeoPoint) => void;
  onExitTarget: (pos: GeoPoint) => void;
  onApproach?: (pos: GeoPoint, distanceM: number) => void;
  onDepotExit: (pos: GeoPoint) => void;
  onDepotEnter: (pos: GeoPoint) => void;
};

/** Dwell inside radius before auto-arrive (filters GPS jitter). */
const ENTER_DWELL_MS = 20_000;
/** Dwell outside radius after arrive before auto-complete. */
const EXIT_DWELL_MS = 45_000;

/**
 * Battery-aware geofence: high accuracy only within 1km of next stop.
 * Approach: once when crossing approachM.
 * Enter: inside radius for >= 20s. Exit: outside for >= 45s after arrived.
 */
export function useGeofence(opts: Options) {
  const [position, setPosition] = useState<GeoPoint | null>(null);
  const [denied, setDenied] = useState(false);
  const [highAccuracy, setHighAccuracy] = useState(false);
  const [distanceM, setDistanceM] = useState<number | null>(null);
  const [approaching, setApproaching] = useState(false);

  const insideSince = useRef<number | null>(null);
  const outsideSince = useRef<number | null>(null);
  const entered = useRef(false);
  const approached = useRef(false);
  const leftDepot = useRef(false);
  const watchId = useRef<number | null>(null);
  const optsRef = useRef(opts);
  optsRef.current = opts;

  useEffect(() => {
    if (!opts.enabled) {
      if (watchId.current != null) {
        navigator.geolocation.clearWatch(watchId.current);
        watchId.current = null;
      }
      return;
    }
    if (!("geolocation" in navigator)) {
      setDenied(true);
      return;
    }

    function startWatch(high: boolean) {
      if (watchId.current != null) {
        navigator.geolocation.clearWatch(watchId.current);
      }
      watchId.current = navigator.geolocation.watchPosition(
        (fix) => {
          const pos = { lat: fix.coords.latitude, lng: fix.coords.longitude };
          setPosition(pos);
          setDenied(false);
          const o = optsRef.current;
          const approachLimit = o.approachM ?? 600;
          if (o.target) {
            const d = haversineM(pos, o.target);
            setDistanceM(d);
            const wantHigh = d < 1000;
            if (wantHigh !== high) {
              setHighAccuracy(wantHigh);
              startWatch(wantHigh);
              return;
            }
            if (d <= approachLimit && !approached.current) {
              approached.current = true;
              setApproaching(true);
              o.onApproach?.(pos, d);
            }
            if (d > approachLimit + 120) {
              setApproaching(false);
            }
            if (d <= o.radiusM) {
              outsideSince.current = null;
              if (insideSince.current == null) insideSince.current = Date.now();
              else if (
                !entered.current &&
                Date.now() - insideSince.current >= ENTER_DWELL_MS
              ) {
                entered.current = true;
                o.onEnterTarget(pos);
              }
            } else {
              insideSince.current = null;
              if (entered.current) {
                if (outsideSince.current == null) outsideSince.current = Date.now();
                else if (Date.now() - outsideSince.current >= EXIT_DWELL_MS) {
                  entered.current = false;
                  outsideSince.current = null;
                  o.onExitTarget(pos);
                }
              }
            }
          }
          if (o.depot) {
            const dd = haversineM(pos, o.depot);
            if (!leftDepot.current && dd > o.radiusM) {
              leftDepot.current = true;
              o.onDepotExit(pos);
            } else if (leftDepot.current && dd <= o.radiusM) {
              leftDepot.current = false;
              o.onDepotEnter(pos);
            }
          }
        },
        () => setDenied(true),
        {
          enableHighAccuracy: high,
          maximumAge: high ? 5_000 : 60_000,
          timeout: 20_000,
        },
      );
    }

    startWatch(false);
    return () => {
      if (watchId.current != null) {
        navigator.geolocation.clearWatch(watchId.current);
        watchId.current = null;
      }
    };
  }, [opts.enabled]);

  useEffect(() => {
    insideSince.current = null;
    outsideSince.current = null;
    entered.current = false;
    approached.current = false;
    setApproaching(false);
  }, [opts.target?.lat, opts.target?.lng]);

  return { position, denied, highAccuracy, distanceM, approaching };
}

export { haversineM };
