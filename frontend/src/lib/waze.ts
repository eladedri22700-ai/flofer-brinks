/** Open Waze app if installed, else the web navigator. */
export function openWaze(lat: number, lng: number): void {
  const app = `waze://?ll=${lat},${lng}&navigate=yes`;
  const web = `https://waze.com/ul?ll=${lat},${lng}&navigate=yes`;
  window.location.href = app;
  window.setTimeout(() => {
    window.open(web, "_blank", "noopener,noreferrer");
  }, 800);
}

export function navCoords(stop: {
  lat: number;
  lng: number;
  parking_lat?: number | null;
  parking_lng?: number | null;
}): { lat: number; lng: number } {
  if (stop.parking_lat != null && stop.parking_lng != null) {
    return { lat: stop.parking_lat, lng: stop.parking_lng };
  }
  return { lat: stop.lat, lng: stop.lng };
}
