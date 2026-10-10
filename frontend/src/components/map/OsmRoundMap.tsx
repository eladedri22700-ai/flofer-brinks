import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { RoundMapProps } from "./RoundMap";
import styles from "./RoundMap.module.css";

/**
 * Free OpenStreetMap version of the round map (Leaflet). Used when no Google
 * browser key is set or Google rejects it — same pins, path and selection.
 */

function pinHtml(label: string, fill: string, selected: boolean): string {
  const size = selected ? 42 : 34;
  const stroke = selected ? "#0b1f3a" : "#ffffff";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${Math.round(size * 1.28)}" viewBox="0 0 36 46" aria-hidden="true">
    <path d="M18 2C9.7 2 3 8.7 3 17c0 12.5 15 27 15 27s15-14.5 15-27C33 8.7 26.3 2 18 2z" fill="${fill}" stroke="${stroke}" stroke-width="2.5"/>
    <circle cx="18" cy="17" r="10" fill="#ffffff"/>
    <text x="18" y="21.5" text-anchor="middle" font-family="IBM Plex Mono,monospace" font-size="13" font-weight="700" fill="#0b1f3a">${label}</text>
  </svg>`;
}

function pinIcon(label: string, fill: string, selected: boolean): L.DivIcon {
  const w = selected ? 42 : 34;
  const h = Math.round(w * 1.28);
  return L.divIcon({
    html: pinHtml(label, fill, selected),
    className: styles.osmPin,
    iconSize: [w, h],
    iconAnchor: [w / 2, h],
    popupAnchor: [0, -h + 6],
  });
}

function escapeHtml(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function formatEta(iso: string | null | undefined): string {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString("he-IL", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jerusalem",
  });
}

export function OsmRoundMap({
  stops,
  depot,
  selectedStopId = null,
  onSelectStop,
  userPosition = null,
}: RoundMapProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);
  const userRef = useRef<L.CircleMarker | null>(null);
  const sigRef = useRef("");
  const onSelectRef = useRef(onSelectStop);
  onSelectRef.current = onSelectStop;

  useEffect(() => {
    if (!canvasRef.current || mapRef.current) return;
    const map = L.map(canvasRef.current, {
      zoomControl: true,
      attributionControl: true,
    });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "© OpenStreetMap",
    }).addTo(map);
    map.setView([32.08, 34.78], 12);
    layerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    const obs = new ResizeObserver(() => map.invalidateSize());
    obs.observe(canvasRef.current);
    return () => {
      obs.disconnect();
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
      userRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer) return;
    layer.clearLayers();

    const path: L.LatLngExpression[] = [];
    if (depot) {
      path.push([depot.lat, depot.lng]);
      L.marker([depot.lat, depot.lng], {
        icon: pinIcon("ב", "#c9a227", false),
        title: depot.name,
        zIndexOffset: 0,
      }).addTo(layer);
    }

    stops.forEach((s, i) => {
      path.push([s.lat, s.lng]);
      const selected = s.id === selectedStopId;
      const fill = selected ? "#c9a227" : s.priority === "vip" ? "#b8860b" : "#0f2d52";
      const eta = formatEta(s.eta);
      const marker = L.marker([s.lat, s.lng], {
        icon: pinIcon(String(i + 1), fill, selected),
        title: `${i + 1}. ${s.customer_name}`,
        zIndexOffset: selected ? 1000 : 10 + i,
        keyboard: true,
      }).addTo(layer);
      marker.bindPopup(
        `<div dir="rtl" style="font-family:Varela Round,sans-serif;max-width:220px">
          <div style="font-weight:700;font-size:15px;color:#0b1f3a">${i + 1}. ${escapeHtml(s.customer_name)}</div>
          <div style="font-size:13px;color:#3d516c;margin-top:4px">${escapeHtml(s.address)}</div>
          ${eta ? `<div style="font-family:IBM Plex Mono,monospace;margin-top:6px;font-weight:700;color:#8a6a12">הגעה ${eta}</div>` : ""}
        </div>`,
      );
      marker.on("click", () => onSelectRef.current?.(s.id));
    });

    if (depot) path.push([depot.lat, depot.lng]);
    if (path.length > 1) {
      L.polyline(path, { color: "#8a6a12", weight: 4, opacity: 0.9 }).addTo(layer);
    }

    const sig = `${depot ? `${depot.lat},${depot.lng}` : "x"}|${stops.map((s) => `${s.id}:${s.lat},${s.lng}`).join(";")}`;
    if (sig !== sigRef.current && path.length > 0) {
      sigRef.current = sig;
      map.fitBounds(L.latLngBounds(path as L.LatLngTuple[]), { padding: [40, 40] });
    } else if (selectedStopId != null) {
      const sel = stops.find((s) => s.id === selectedStopId);
      if (sel) map.setView([sel.lat, sel.lng], Math.max(14, Math.min(16, map.getZoom())));
    }
  }, [stops, depot, selectedStopId]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!userPosition) {
      userRef.current?.remove();
      userRef.current = null;
      return;
    }
    if (!userRef.current) {
      userRef.current = L.circleMarker([userPosition.lat, userPosition.lng], {
        radius: 9,
        color: "#ffffff",
        weight: 3,
        fillColor: "#2a66c8",
        fillOpacity: 1,
      }).addTo(map);
    } else {
      userRef.current.setLatLng([userPosition.lat, userPosition.lng]);
    }
  }, [userPosition]);

  return <div ref={canvasRef} className={styles.canvas} role="img" aria-label="מפת סבב היום" />;
}
