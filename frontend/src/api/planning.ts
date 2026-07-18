import {
  apiFetch,
  type CustomerDto,
  type Depot,
  type DraftStop,
  type KeysStatus,
  type OptimizeResult,
  type PlaceSuggestion,
  type PublicConfig,
  type RouteDto,
  type StopDto,
} from "./client";

export const getKeysStatus = () =>
  apiFetch<KeysStatus>("/api/settings/keys/status");

export const putKeys = (body: {
  google_maps_server_key?: string;
  google_maps_browser_key?: string;
  anthropic_api_key?: string;
  telegram_bot_token?: string;
}) =>
  apiFetch<KeysStatus>("/api/settings/keys", {
    method: "PUT",
    body: JSON.stringify(body),
  });

export const getPublicConfig = () =>
  apiFetch<PublicConfig>("/api/settings/public-config");

export const testTelegram = () =>
  apiFetch<{ ok: boolean; message_he: string }>("/api/settings/telegram/test", {
    method: "POST",
    body: JSON.stringify({}),
  });

export const getDepot = () => apiFetch<Depot>("/api/settings/depot");

export const putDepot = (body: {
  name?: string;
  address?: string;
  lat?: number | null;
  lng?: number | null;
}) =>
  apiFetch<Depot>("/api/settings/depot", {
    method: "PUT",
    body: JSON.stringify(body),
  });

export const getTodayRoute = () =>
  apiFetch<RouteDto | null>("/api/routes/today");

export const createTodayRoute = (body: Record<string, unknown> = {}) =>
  apiFetch<RouteDto>("/api/routes", {
    method: "POST",
    body: JSON.stringify(body),
  });

export const patchRoute = (id: number, body: Record<string, unknown>) =>
  apiFetch<RouteDto>(`/api/routes/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });

export const addStop = (routeId: number, body: Record<string, unknown>) =>
  apiFetch<StopDto>(`/api/routes/${routeId}/stops`, {
    method: "POST",
    body: JSON.stringify(body),
  });

export const addStopsBulk = (routeId: number, stops: Record<string, unknown>[]) =>
  apiFetch<StopDto[]>(`/api/routes/${routeId}/stops/bulk`, {
    method: "POST",
    body: JSON.stringify({ stops }),
  });

export const listCustomers = (q = "", limit = 80) => {
  const params = new URLSearchParams();
  if (q.trim()) params.set("q", q.trim());
  params.set("limit", String(limit));
  const qs = params.toString();
  return apiFetch<CustomerDto[]>(`/api/customers${qs ? `?${qs}` : ""}`);
};

export const addStopsFromCustomers = (routeId: number, customerIds: number[]) =>
  apiFetch<StopDto[]>(`/api/routes/${routeId}/stops/from-customers`, {
    method: "POST",
    body: JSON.stringify({ customer_ids: customerIds }),
  });

export const patchStop = (stopId: number, body: Record<string, unknown>) =>
  apiFetch<StopDto>(`/api/stops/${stopId}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });

export const deleteStop = (stopId: number) =>
  apiFetch<{ ok: boolean }>(`/api/stops/${stopId}`, { method: "DELETE" });

export const reorderStops = (routeId: number, stopIds: number[]) =>
  apiFetch<StopDto[]>(`/api/routes/${routeId}/stops/reorder`, {
    method: "PATCH",
    body: JSON.stringify({ stop_ids: stopIds }),
  });

export const autocomplete = (query: string) =>
  apiFetch<PlaceSuggestion[]>("/api/places/autocomplete", {
    method: "POST",
    body: JSON.stringify({ query }),
  });

export const placeDetails = (place_id: string) =>
  apiFetch<{
    formatted_address: string;
    lat: number;
    lng: number;
    confidence: number;
  }>("/api/places/details", {
    method: "POST",
    body: JSON.stringify({ place_id }),
  });

export const geocode = (address: string) =>
  apiFetch<{
    formatted_address: string;
    lat: number;
    lng: number;
    confidence: number;
  }>("/api/geocode", {
    method: "POST",
    body: JSON.stringify({ address }),
  });

export async function importFile(routeId: number, file: File) {
  const form = new FormData();
  form.append("file", file);
  return apiFetch<DraftStop[]>(`/api/routes/${routeId}/import-file`, {
    method: "POST",
    body: form,
  });
}

export async function extractFromImage(file: File) {
  const form = new FormData();
  form.append("file", file);
  return apiFetch<DraftStop[]>("/api/stops/extract-from-image", {
    method: "POST",
    body: form,
  });
}

export const optimizeRoute = (
  routeId: number,
  body: { resolve_option?: string } = {},
) =>
  apiFetch<OptimizeResult>(`/api/routes/${routeId}/optimize`, {
    method: "POST",
    body: JSON.stringify(body),
  });

export const reorderManual = (routeId: number, stopIds: number[]) =>
  apiFetch<OptimizeResult>(`/api/routes/${routeId}/reorder-manual`, {
    method: "POST",
    body: JSON.stringify({ stop_ids: stopIds }),
  });
