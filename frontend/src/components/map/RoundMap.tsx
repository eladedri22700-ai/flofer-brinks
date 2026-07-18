import { useEffect, useRef } from "react";
import type { Depot, StopDto } from "../../api/client";
import {
  ROUND_MAP_STYLES,
  loadGoogleMaps,
  type GoogleInfoWindow,
  type GoogleMapInstance,
  type GoogleMarker,
  type LatLng,
} from "../../lib/loadGoogleMaps";
import styles from "./RoundMap.module.css";

export type RoundMapStop = Pick<
  StopDto,
  "id" | "customer_name" | "address" | "lat" | "lng" | "priority" | "eta"
>;

type Props = {
  mapKey: string | null;
  stops: RoundMapStop[];
  depot?: Pick<Depot, "name" | "address" | "lat" | "lng"> | null;
  selectedStopId?: number | null;
  onSelectStop?: (id: number) => void;
  /** Live GPS of the team (blue dot). */
  userPosition?: LatLng | null;
  showLegend?: boolean;
  className?: string;
};

type PolylineLike = { setMap: (m: unknown) => void };

function pinSvg(label: string, fill: string, selected: boolean): string {
  const stroke = selected ? "#0b1f3a" : "#ffffff";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="30" height="38" viewBox="0 0 30 38">
    <path d="M15 1C8.4 1 3 6.4 3 13c0 9.8 12 23 12 23s12-13.2 12-23C27 6.4 21.6 1 15 1z" fill="${fill}" stroke="${stroke}" stroke-width="2"/>
    <text x="15" y="17" text-anchor="middle" font-family="IBM Plex Mono,monospace" font-size="11" font-weight="700" fill="#0b1f3a">${label}</text>
  </svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function formatEta(iso: string | null | undefined): string {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString("he-IL", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jerusalem",
  });
}

function escapeHtml(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function stopSignature(stops: RoundMapStop[], depot: Props["depot"]): string {
  const d = depot ? `${depot.lat},${depot.lng}` : "x";
  return `${d}|${stops.map((s) => `${s.id}:${s.lat},${s.lng}`).join(";")}`;
}

export function RoundMap({
  mapKey,
  stops,
  depot,
  selectedStopId = null,
  onSelectStop,
  userPosition = null,
  showLegend = true,
  className,
}: Props) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<GoogleMapInstance | null>(null);
  const markersRef = useRef<GoogleMarker[]>([]);
  const userMarkerRef = useRef<GoogleMarker | null>(null);
  const lineRef = useRef<PolylineLike | null>(null);
  const infoRef = useRef<GoogleInfoWindow | null>(null);
  const sigRef = useRef("");
  const onSelectRef = useRef(onSelectStop);
  onSelectRef.current = onSelectStop;

  useEffect(() => {
    if (!mapKey || !canvasRef.current || stops.length === 0) return;
    let cancelled = false;

    void loadGoogleMaps(mapKey).then(() => {
      if (cancelled || !window.google?.maps || !canvasRef.current) return;
      const g = window.google.maps;
      const center: LatLng = depot
        ? { lat: depot.lat, lng: depot.lng }
        : { lat: stops[0].lat, lng: stops[0].lng };

      if (!mapRef.current) {
        mapRef.current = new g.Map(canvasRef.current, {
          center,
          zoom: 11,
          disableDefaultUI: true,
          zoomControl: true,
          gestureHandling: "greedy",
          styles: ROUND_MAP_STYLES,
        });
        infoRef.current = new g.InfoWindow();
      }

      const map = mapRef.current;
      const sig = stopSignature(stops, depot);
      const geometryChanged = sig !== sigRef.current;
      sigRef.current = sig;

      markersRef.current.forEach((m) => m.setMap(null));
      markersRef.current = [];
      lineRef.current?.setMap(null);
      lineRef.current = null;

      const bounds = new g.LatLngBounds();
      const path: LatLng[] = [];

      if (depot) {
        const dPos = { lat: depot.lat, lng: depot.lng };
        path.push(dPos);
        bounds.extend(dPos);
        markersRef.current.push(
          new g.Marker({
            map,
            position: dPos,
            title: depot.name,
            zIndex: 1,
            icon: {
              url: pinSvg("ב", "#c9a227", false),
              scaledSize: { width: 32, height: 40 },
              anchor: { x: 16, y: 40 },
            },
          }),
        );
      }

      stops.forEach((s, i) => {
        const pos = { lat: s.lat, lng: s.lng };
        path.push(pos);
        bounds.extend(pos);
        const selected = s.id === selectedStopId;
        const fill = s.priority === "vip" ? "#d8b84a" : "#0f2d52";
        const marker = new g.Marker({
          map,
          position: pos,
          title: s.customer_name,
          zIndex: selected ? 50 : 10 + i,
          icon: {
            url: pinSvg(String(i + 1), selected ? "#e8d07a" : fill, selected),
            scaledSize: selected
              ? { width: 36, height: 44 }
              : { width: 30, height: 38 },
            anchor: selected ? { x: 18, y: 44 } : { x: 15, y: 38 },
          },
        });
        marker.addListener("click", () => {
          onSelectRef.current?.(s.id);
          const eta = formatEta(s.eta);
          infoRef.current?.setContent(
            `<div dir="rtl" style="font-family:Varela Round,sans-serif;max-width:220px;padding:4px">
              <div style="font-weight:700;color:#0b1f3a">${escapeHtml(s.customer_name)}</div>
              <div style="font-size:13px;color:#3d516c;margin-top:4px">${escapeHtml(s.address)}</div>
              ${eta ? `<div style="font-family:IBM Plex Mono,monospace;margin-top:6px;color:#8a6a12">ETA ${eta}</div>` : ""}
            </div>`,
          );
          infoRef.current?.open({ map, anchor: marker });
        });
        markersRef.current.push(marker);
      });

      if (depot) path.push({ lat: depot.lat, lng: depot.lng });

      lineRef.current = new g.Polyline({
        map,
        path,
        strokeColor: "#c9a227",
        strokeOpacity: 0.95,
        strokeWeight: 4,
        geodesic: true,
      });

      if (geometryChanged && !bounds.isEmpty()) {
        map.fitBounds(bounds, { top: 48, right: 48, bottom: 72, left: 48 });
      } else if (selectedStopId != null) {
        const sel = stops.find((s) => s.id === selectedStopId);
        if (sel) map.panTo({ lat: sel.lat, lng: sel.lng });
      }
    });

    return () => {
      cancelled = true;
    };
  }, [mapKey, stops, depot, selectedStopId]);

  useEffect(() => {
    if (!mapKey || !mapRef.current || !window.google?.maps) return;
    const g = window.google.maps;
    const map = mapRef.current;

    if (!userPosition) {
      userMarkerRef.current?.setMap(null);
      userMarkerRef.current = null;
      return;
    }

    if (!userMarkerRef.current) {
      userMarkerRef.current = new g.Marker({
        map,
        position: userPosition,
        title: "אתם כאן",
        zIndex: 100,
        icon: {
          path: g.SymbolPath?.CIRCLE ?? 0,
          scale: 10,
          fillColor: "#2a66c8",
          fillOpacity: 1,
          strokeColor: "#ffffff",
          strokeWeight: 3,
        },
      });
    } else {
      userMarkerRef.current.setPosition(userPosition);
      userMarkerRef.current.setMap(map);
    }
  }, [mapKey, userPosition]);

  if (!mapKey) {
    return (
      <div className={`${styles.placeholder} ${className ?? ""}`}>
        <p>המפה תופיע אחרי הגדרת Google Browser Key בהגדרות.</p>
      </div>
    );
  }

  if (stops.length === 0) {
    return (
      <div className={`${styles.placeholder} ${className ?? ""}`}>
        <p>אין עדיין יעדים להצגה על המפה.</p>
      </div>
    );
  }

  return (
    <div className={`${styles.wrap} ${className ?? ""}`}>
      <div ref={canvasRef} className={styles.canvas} role="img" aria-label="מפת סבב היום" />
      {showLegend ? (
        <div className={styles.legend} aria-hidden>
          <span>
            <i className={`${styles.dot} ${styles.dotDepot}`} /> סניף
          </span>
          <span>
            <i className={`${styles.dot} ${styles.dotStop}`} /> יעד
          </span>
          <span>
            <i className={`${styles.dot} ${styles.dotPath}`} /> מסלול
          </span>
          {userPosition ? (
            <span>
              <i className={`${styles.dot} ${styles.dotYou}`} /> אתם
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
