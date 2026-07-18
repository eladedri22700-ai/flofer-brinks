import { useEffect, useRef } from "react";
import { haversineM, type GeoPoint } from "./useGeofence";

type StopLike = {
  id: number;
  status: string;
  lat: number;
  lng: number;
  parking_lat?: number | null;
  parking_lng?: number | null;
};

/**
 * If the crew leaves a stop without marking and reaches the next stop's
 * geofence, auto-complete the previous stop so the day keeps flowing.
 */
export function useNextStopAdvance(opts: {
  enabled: boolean;
  position: GeoPoint | null;
  current: StopLike | null;
  nextUp: StopLike | null;
  radiusM: number;
  dwellMs?: number;
  onAdvance: (pos: GeoPoint) => void;
}) {
  const nearSince = useRef<number | null>(null);
  const fired = useRef(false);
  const onAdvanceRef = useRef(opts.onAdvance);
  onAdvanceRef.current = opts.onAdvance;
  const dwell = opts.dwellMs ?? 15_000;

  useEffect(() => {
    fired.current = false;
    nearSince.current = null;
  }, [opts.current?.id]);

  useEffect(() => {
    if (
      !opts.enabled ||
      !opts.position ||
      !opts.current ||
      opts.current.status !== "arrived" ||
      !opts.nextUp
    ) {
      nearSince.current = null;
      return;
    }
    const nextPt: GeoPoint = {
      lat: opts.nextUp.parking_lat ?? opts.nextUp.lat,
      lng: opts.nextUp.parking_lng ?? opts.nextUp.lng,
    };
    const d = haversineM(opts.position, nextPt);
    if (d <= opts.radiusM) {
      if (nearSince.current == null) nearSince.current = Date.now();
      else if (!fired.current && Date.now() - nearSince.current >= dwell) {
        fired.current = true;
        onAdvanceRef.current(opts.position);
      }
    } else {
      nearSince.current = null;
    }
  }, [
    opts.enabled,
    opts.position,
    opts.current,
    opts.nextUp,
    opts.radiusM,
    dwell,
  ]);
}
