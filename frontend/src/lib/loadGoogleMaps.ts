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
        ControlPosition?: { RIGHT_BOTTOM: number };
        event: {
          clearInstanceListeners: (t: unknown) => void;
          trigger: (instance: unknown, eventName: string) => void;
        };
      };
    };
  }
}

export type LatLng = { lat: number; lng: number };

export type GoogleMapInstance = {
  fitBounds: (b: GoogleBounds, padding?: number | Record<string, number>) => void;
  panTo: (c: LatLng) => void;
  setZoom: (z: number) => void;
  getZoom: () => number | undefined;
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

/** Light operational map — clear roads + readable street names for field use. */
export const ROUND_MAP_STYLES: Record<string, unknown>[] = [
  { elementType: "geometry", stylers: [{ color: "#f0f4f8" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#1a2f4a" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#ffffff" }, { weight: 3 }] },
  {
    featureType: "road",
    elementType: "geometry",
    stylers: [{ color: "#ffffff" }],
  },
  {
    featureType: "road",
    elementType: "geometry.stroke",
    stylers: [{ color: "#b8c5d6" }],
  },
  {
    featureType: "road",
    elementType: "labels.text.fill",
    stylers: [{ color: "#0f2d52" }, { visibility: "on" }],
  },
  {
    featureType: "road.highway",
    elementType: "geometry",
    stylers: [{ color: "#dde6f2" }],
  },
  {
    featureType: "water",
    elementType: "geometry",
    stylers: [{ color: "#c5d6ea" }],
  },
  {
    featureType: "poi",
    stylers: [{ visibility: "simplified" }],
  },
  {
    featureType: "poi.business",
    stylers: [{ visibility: "off" }],
  },
  {
    featureType: "transit",
    stylers: [{ visibility: "off" }],
  },
];
