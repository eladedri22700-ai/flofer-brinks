/** Shared API base — prefer same-origin `/api` via Vite proxy in production-like local. */
export function getApiBase(): string {
  const env = import.meta.env.VITE_API_BASE_URL;
  if (env === "" || env === "/") return "";
  if (typeof env === "string" && env.length > 0) return env.replace(/\/$/, "");
  // Same-origin proxy (vite.config server.proxy)
  return "";
}

export function apiUrl(path: string): string {
  const base = getApiBase();
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${base}${p}`;
}
