import { apiFetch, type UserPrefs } from "./client";
import { apiUrl } from "./base";

export type DashboardDto = {
  today_start_at: string | null;
  today_end_at: string | null;
  today_elapsed_min: number;
  week_min: number;
  week_standard_min: number;
  month_min: number;
  month_overtime_min: number;
  cumulative_min: number;
  work_days_count: number;
  daily_avg_min: number;
  daily_avg_trend_min: number;
  composition: {
    driving_min: number;
    service_min: number;
    waiting_min: number;
    break_min: number;
    waiting_pct: number;
    insight_he: string;
  };
  standard_day_min: number;
  disclaimer_he: string;
};

export type WorkDayRow = {
  id: number;
  date: string;
  start_at: string | null;
  end_at: string | null;
  break_min: number;
  total_min: number | null;
  overtime_min: number;
  stops_done: number;
  manually_edited: boolean;
  edit_note: string | null;
};

export const getDashboard = () => apiFetch<DashboardDto>("/api/hours/dashboard");
export const getWorkDays = (month: string) =>
  apiFetch<WorkDayRow[]>(`/api/hours/days?month=${month}`);
export const patchWorkDay = (
  id: number,
  body: { start_at?: string; end_at?: string; note?: string },
) =>
  apiFetch<WorkDayRow>(`/api/hours/days/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });

export function exportHoursUrl(month: string, format: "csv" | "pdf") {
  return apiUrl(`/api/hours/export?month=${month}&format=${format}`);
}

export const getHistory = () => apiFetch<Record<string, unknown>[]>("/api/routes/history");
export const getRouteCompare = (routeId: number) =>
  apiFetch<{
    route_id: number;
    date: string;
    status: string;
    optimized_duration_min: number | null;
    naive_duration_min: number | null;
    median_abs_error_min: number | null;
    stops: {
      id: number;
      sequence_order: number;
      customer_name: string;
      status: string;
      eta: string | null;
      actual_arrival: string | null;
      actual_departure: string | null;
      eta_error_min: number | null;
      exception_code: string;
    }[];
  }>(`/api/routes/${routeId}/compare`);
export const getSummary = (routeId: number) =>
  apiFetch<Record<string, unknown>>(`/api/routes/${routeId}/summary`);
export const duplicateRoute = (routeId: number) =>
  apiFetch(`/api/routes/${routeId}/duplicate`, { method: "POST", body: "{}" });
export const getAccuracy = () =>
  apiFetch<{ weeks: { week: string; median_error_min: number; n: number }[]; improvement_he: string | null }>(
    "/api/analytics/accuracy",
  );

export const enableDemo = () =>
  apiFetch("/api/settings/demo/enable", { method: "POST", body: "{}" });
/** Demo customers + empty today route — for interactive guided practice. */
export const enableDemoPractice = () =>
  apiFetch<{ ok: boolean; practice?: boolean }>("/api/settings/demo/practice", {
    method: "POST",
    body: "{}",
  });
export const disableDemo = () =>
  apiFetch("/api/settings/demo/disable", { method: "POST", body: "{}" });

export type { UserPrefs };
