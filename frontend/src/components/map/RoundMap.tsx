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
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="46" viewBox="0 0 36 46">
    <path d="M18 2C9.7 2 3 8.7 3 17c0 12.5 15 27 15 27s15-14.5 15-27C33 8.7 26.3 2 18 2z" fill="${fill}" stroke="${stroke}" stroke-width="2.5"/>
    <circle cx="18" cy="17" r="10" fill="#ffffff"/>
    <text x="18" y="21.5" text-anchor="middle" font-family="IBM Plex Mono,monospace" font-size="13" font-weight="700" fill="#0b1f3a">${label}</text>
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

  const boundsRef = useRef<{ isEmpty: () => boolean } | null>(null);

  useEffect(() => {
    if (!mapKey || !canvasRef.current || stops.length === 0) return;
    let cancelled = false;
    let resizeObs: ResizeObserver | null = null;
    let resizeTimer: number | undefined;

    void loadGoogleMaps(mapKey).then(() => {
      if (cancelled || !window.google?.maps || !canvasRef.current) return;
      const g = window.google.maps;
      const center: LatLng = depot
        ? { lat: depot.lat, lng: depot.lng }
        : { lat: stops[0].lat, lng: stops[0].lng };

      if (!mapRef.current) {
        mapRef.current = new g.Map(canvasRef.current, {
          center,
          zoom: 12,
          disableDefaultUI: true,
          zoomControl: true,
          zoomControlOptions: {
            position: g.ControlPosition?.RIGHT_BOTTOM ?? 9,
          },
          mapTypeControl: false,
          fullscreenControl: false,
          streetViewControl: false,
          gestureHandling: "greedy",
          styles: ROUND_MAP_STYLES,
          clickableIcons: false,
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
              scaledSize: { width: 38, height: 48 },
              anchor: { x: 19, y: 48 },
            },
          }),
        );
      }

      stops.forEach((s, i) => {
        const pos = { lat: s.lat, lng: s.lng };
        path.push(pos);
        bounds.extend(pos);
        const selected = s.id === selectedStopId;
        const fill = s.priority === "vip" ? "#b8860b" : "#0f2d52";
        const marker = new g.Marker({
          map,
          position: pos,
          title: `${i + 1}. ${s.customer_name}`,
          zIndex: selected ? 50 : 10 + i,
          icon: {
            url: pinSvg(String(i + 1), selected ? "#c9a227" : fill, selected),
            scaledSize: selected
              ? { width: 42, height: 52 }
              : { width: 36, height: 46 },
            anchor: selected ? { x: 21, y: 52 } : { x: 18, y: 46 },
          },
        });
        marker.addListener("click", () => {
          onSelectRef.current?.(s.id);
          const eta = formatEta(s.eta);
          infoRef.current?.setContent(
            `<div dir="rtl" style="font-family:Varela Round,sans-serif;max-width:240px;padding:6px">
              <div style="font-weight:700;font-size:15px;color:#0b1f3a">${i + 1}. ${escapeHtml(s.customer_name)}</div>
              <div style="font-size:13px;color:#3d516c;margin-top:4px;line-height:1.35">${escapeHtml(s.address)}</div>
              ${eta ? `<div style="font-family:IBM Plex Mono,monospace;margin-top:8px;font-weight:700;color:#8a6a12">הגעה ${eta}</div>` : ""}
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
        strokeColor: "#8a6a12",
        strokeOpacity: 1,
        strokeWeight: 5,
        geodesic: true,
        zIndex: 2,
      });

      boundsRef.current = bounds;

      const paintBounds = () => {
        if (cancelled || !mapRef.current || !boundsRef.current) return;
        if (boundsRef.current.isEmpty()) return;
        g.event.trigger(mapRef.current, "resize");
        mapRef.current.fitBounds(boundsRef.current as never, {
          top: 56,
          right: 40,
          bottom: 56,
          left: 40,
        });
      };

      if (geometryChanged && !bounds.isEmpty()) {
        window.requestAnimationFrame(paintBounds);
      } else if (selectedStopId != null) {
        g.event.trigger(map, "resize");
        const sel = stops.find((s) => s.id === selectedStopId);
        if (sel) {
          map.panTo({ lat: sel.lat, lng: sel.lng });
          const z = map.getZoom() ?? 12;
          map.setZoom(Math.min(16, Math.max(14, z)));
        }
      }

      if (canvasRef.current) {
        let lastW = 0;
        let lastH = 0;
        resizeObs = new ResizeObserver((entries) => {
          const box = entries[0]?.contentRect;
          if (!box) return;
          const w = Math.round(box.width);
          const h = Math.round(box.height);
          if (w < 40 || h < 40) return;
          if (w === lastW && h === lastH) return;
          const grew = lastW > 0 && (Math.abs(w - lastW) > 48 || Math.abs(h - lastH) > 48);
          lastW = w;
          lastH = h;
          window.clearTimeout(resizeTimer);
          resizeTimer = window.setTimeout(() => {
            if (cancelled || !mapRef.current) return;
            g.event.trigger(mapRef.current, "resize");
            // Re-fit only on meaningful pane resize (list toggle), not pin taps.
            if (grew) paintBounds();
          }, 100);
        });
        resizeObs.observe(canvasRef.current);
      }
    });

    return () => {
      cancelled = true;
      window.clearTimeout(resizeTimer);
      resizeObs?.disconnect();
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
