import {
  apiFetch,
  type OptimizeResult,
  type RouteDto,
  type StopDto,
  type UserPrefs,
} from "./client";
import { enqueueAction, flushQueue } from "../lib/offlineQueue";

export const getPrefs = () => apiFetch<UserPrefs>("/api/settings/prefs");

export const putPrefs = (body: Partial<UserPrefs>) =>
  apiFetch<UserPrefs>("/api/settings/prefs", {
    method: "PUT",
    body: JSON.stringify(body),
  });

export const startRoute = (routeId: number) =>
  apiFetch<RouteDto>(`/api/routes/${routeId}/start`, { method: "POST", body: "{}" });

export const arriveStop = (stopId: number, lat?: number, lng?: number) =>
  apiFetch<{ ok: boolean; stop: StopDto }>(`/api/stops/${stopId}/arrive`, {
    method: "POST",
    body: JSON.stringify({ lat, lng }),
  });

export const completeStop = (
  stopId: number,
  body: {
    exception_code?: string;
    exception_note?: string;
    lat?: number;
    lng?: number;
  },
) =>
  apiFetch<{ ok: boolean }>(`/api/stops/${stopId}/complete`, {
    method: "POST",
    body: JSON.stringify(body),
  });

export const skipStop = (stopId: number, note?: string) =>
  apiFetch<{ ok: boolean }>(`/api/stops/${stopId}/skip`, {
    method: "POST",
    body: JSON.stringify({ note }),
  });

export const workDayEvent = (
  routeId: number,
  body: { event?: string; start_at?: string; end_at?: string; note?: string },
) =>
  apiFetch<Record<string, unknown>>(`/api/routes/${routeId}/work-day`, {
    method: "POST",
    body: JSON.stringify(body),
  });

export const logRouteEvent = (
  routeId: number,
  type: string,
  payload?: Record<string, unknown>,
) =>
  apiFetch<{ id: number }>(`/api/routes/${routeId}/events`, {
    method: "POST",
    body: JSON.stringify({ type, payload }),
  });

export const getDelay = (routeId: number) =>
  apiFetch<{
    delay_min: number;
    should_propose: boolean;
    geofence_radius_m: number;
    adjusted_return_at: string | null;
  }>(`/api/routes/${routeId}/delay`);

export const notifyApproach = (
  routeId: number,
  body: { stop_id?: number; distance_m?: number },
) =>
  apiFetch<{ ok: boolean; telegram_sent: boolean }>(
    `/api/routes/${routeId}/notify-approach`,
    { method: "POST", body: JSON.stringify(body) },
  );

export const reoptimizePropose = (routeId: number, lat: number, lng: number) =>
  apiFetch<{
    delay_min: number;
    savings_min: number;
    message_he: string;
    sequence_stop_ids: number[];
    feasible: boolean;
  }>(`/api/routes/${routeId}/reoptimize-propose`, {
    method: "POST",
    body: JSON.stringify({ lat, lng }),
  });

export const reoptimizeApply = (routeId: number, lat: number, lng: number) =>
  apiFetch<RouteDto>(`/api/routes/${routeId}/reoptimize-apply`, {
    method: "POST",
    body: JSON.stringify({ lat, lng }),
  });

export const whatIfStop = (
  routeId: number,
  body: Record<string, unknown>,
) =>
  apiFetch<{
    added_min: number;
    new_return_at: string | null;
    deadlines_ok: boolean;
    message_he: string;
  }>(`/api/routes/${routeId}/what-if`, {
    method: "POST",
    body: JSON.stringify(body),
  });

/** Complete with offline fallback — never blocks the driver. */
export async function completeStopResilient(
  stopId: number,
  body: {
    exception_code?: string;
    exception_note?: string;
    lat?: number;
    lng?: number;
  },
): Promise<"ok" | "queued"> {
  try {
    await completeStop(stopId, body);
    return "ok";
  } catch {
    if (!navigator.onLine) {
      await enqueueAction(`/api/stops/${stopId}/complete`, "POST", body);
      return "queued";
    }
    throw new Error("complete failed");
  }
}

export async function syncOfflineQueue(): Promise<number> {
  return flushQueue(async (path, method, body) => {
    await apiFetch(path, {
      method,
      body: body != null ? JSON.stringify(body) : undefined,
    });
  });
}

export type { OptimizeResult };
