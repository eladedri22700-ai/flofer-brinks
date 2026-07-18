declare global {
  interface Window {
    google?: {
      maps: {
        Map: new (
          el: HTMLElement,
          opts: Record<string, unknown>,
        ) => GoogleMapInstance;
        Marker: new (opts: Record<string, unknown>) => GoogleMarker;
        Polyline: new (opts: Record<string, unknown>) => { setMap: (m: unknown) => void };
        LatLngBounds: new () => GoogleBounds;
        InfoWindow: new (opts?: Record<string, unknown>) => GoogleInfoWindow;
        SymbolPath?: { CIRCLE: unknown };
        event: { clearInstanceListeners: (t: unknown) => void };
      };
    };
  }
}

export type LatLng = { lat: number; lng: number };

export type GoogleMapInstance = {
  fitBounds: (b: GoogleBounds, padding?: number | Record<string, number>) => void;
  panTo: (c: LatLng) => void;
  setZoom: (z: number) => void;
};

export type GoogleBounds = {
  extend: (p: LatLng) => void;
  isEmpty: () => boolean;
};

export type GoogleMarker = {
  setMap: (m: unknown) => void;
  setIcon: (icon: unknown) => void;
  setPosition: (p: LatLng) => void;
  setTitle: (t: string) => void;
  addListener: (event: string, fn: () => void) => void;
  getPosition: () => LatLng | null | undefined;
};

export type GoogleInfoWindow = {
  setContent: (html: string) => void;
  open: (opts: { map: GoogleMapInstance; anchor?: GoogleMarker }) => void;
  close: () => void;
};

export function loadGoogleMaps(key: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.google?.maps) {
      resolve();
      return;
    }
    const id = "gmaps-js";
    const existing = document.getElementById(id);
    if (existing) {
      const t = window.setInterval(() => {
        if (window.google?.maps) {
          window.clearInterval(t);
          resolve();
        }
      }, 80);
      window.setTimeout(() => {
        window.clearInterval(t);
        if (!window.google?.maps) reject(new Error("maps load timeout"));
      }, 15000);
      return;
    }
    const s = document.createElement("script");
    s.id = id;
    s.async = true;
    s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}`;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("maps load failed"));
    document.head.appendChild(s);
  });
}

/** Light operational map — navy roads, muted labels (works with light theme). */
export const ROUND_MAP_STYLES: Record<string, unknown>[] = [
  { elementType: "geometry", stylers: [{ color: "#e8eef6" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#3d516c" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#ffffff" }] },
  {
    featureType: "road",
    elementType: "geometry",
    stylers: [{ color: "#ffffff" }],
  },
  {
    featureType: "road",
    elementType: "geometry.stroke",
    stylers: [{ color: "#cfd9e8" }],
  },
  {
    featureType: "water",
    elementType: "geometry",
    stylers: [{ color: "#b8c9de" }],
  },
  {
    featureType: "poi",
    stylers: [{ visibility: "off" }],
  },
  {
    featureType: "transit",
    stylers: [{ visibility: "off" }],
  },
];
