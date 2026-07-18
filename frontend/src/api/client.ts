import { useAuthStore, type AuthUser } from "../store/authStore";
import { apiUrl } from "./base";

export type ApiError = {
  code: string;
  message_he: string;
};

type ErrorPayload = {
  error?: ApiError;
};

async function parseError(res: Response): Promise<ApiError> {
  try {
    const data = (await res.json()) as ErrorPayload;
    if (data.error?.message_he) {
      return data.error;
    }
  } catch {
    /* ignore */
  }
  return {
    code: "unknown",
    message_he: "אירעה תקלה. נסו שוב.",
  };
}

export async function apiFetch<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const token = useAuthStore.getState().token;
  const headers = new Headers(init.headers);
  const isForm = typeof FormData !== "undefined" && init.body instanceof FormData;
  if (!isForm && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  let res: Response;
  try {
    res = await fetch(apiUrl(path), { ...init, headers });
  } catch {
    throw {
      code: "network",
      message_he: "אין חיבור לשרת. בדקו רשת או שה-API רץ.",
    } satisfies ApiError;
  }

  if (res.status === 401) {
    useAuthStore.getState().clearSession();
    useAuthStore.getState().hydrate();
    const err = await parseError(res);
    throw err;
  }

  if (!res.ok) {
    throw await parseError(res);
  }

  if (res.status === 204) {
    return undefined as T;
  }

  return (await res.json()) as T;
}

export type LoginResponse = {
  access_token: string;
  token_type: string;
  user: AuthUser;
};

export function loginRequest(username: string, password: string) {
  return apiFetch<LoginResponse>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
}

export function meRequest() {
  return apiFetch<AuthUser>("/api/auth/me");
}

export type KeysStatus = {
  google_server: boolean;
  google_browser: boolean;
  anthropic: boolean;
  telegram?: boolean;
  maps_mode: "mock" | "live";
  ocr_mode: "mock" | "live";
  telegram_mode?: "off" | "live";
};

export type PublicConfig = {
  google_maps_browser_key: string | null;
  maps_mode: "mock" | "live";
  ocr_mode: "mock" | "live";
};

export type StopDto = {
  id: number;
  route_id: number;
  customer_id: number | null;
  customer_name: string;
  address: string;
  lat: number;
  lng: number;
  sequence_order: number;
  locked: boolean;
  priority: string;
  tw_type: string;
  tw_start: string | null;
  tw_end: string | null;
  service_duration_min: number;
  service_estimate_source: string;
  notes: string | null;
  status: string;
  eta?: string | null;
  actual_arrival?: string | null;
  actual_departure?: string | null;
  geocode_confidence: number | null;
  learned_badge: string | null;
  parking_badge?: string | null;
  parking_lat?: number | null;
  parking_lng?: number | null;
  phone?: string | null;
  exception_code?: string | null;
};

export type UserPrefs = {
  geofence_radius_m: number;
  sos_phone: string | null;
  standard_day_min: number;
  standard_week_min: number;
  theme: string;
  demo_mode?: boolean;
  telegram_chat_id?: string | null;
  telegram_enabled?: boolean;
};

export type RouteDto = {
  id: number;
  user_id: number;
  date: string;
  status: string;
  departure_time: string;
  break_duration_min: number;
  break_window_start: string;
  break_window_end: string;
  deadline_buffer_min: number;
  vip_weight: number;
  variance_mode: boolean;
  created_at: string;
  optimized_at?: string | null;
  naive_duration_min?: number | null;
  optimized_duration_min?: number | null;
  solver_explanation?: Record<string, unknown> | null;
  stops: StopDto[];
};

export type OptimizeResult = {
  feasible: boolean;
  route_id?: number | null;
  sequence_stop_ids?: number[];
  etas?: Record<string, string | null>;
  break_after_stop_id?: number | null;
  break_start?: string | null;
  return_at?: string | null;
  naive_duration_min?: number | null;
  optimized_duration_min?: number | null;
  savings_min?: number | null;
  solver_explanation?: Record<string, unknown> | null;
  conflicts: { type?: string; stop_ids?: number[]; message_he: string }[];
  options: { id: string; label_he: string }[];
  dropped_names?: string[];
  warnings_he?: string[];
  duration_min?: number | null;
};

export type DraftStop = {
  customer_name: string;
  address: string;
  time_note?: string | null;
  lat?: number | null;
  lng?: number | null;
  geocode_confidence?: number | null;
  category?: string;
};

export type CustomerDto = {
  id: number;
  name: string;
  address: string;
  lat: number;
  lng: number;
  category: string;
  service_duration_min: number;
  service_estimate_source: string;
  service_sample_count: number;
  geocode_confidence: number | null;
};

export type PlaceSuggestion = { place_id: string; description: string };

export type Depot = {
  id: number;
  name: string;
  address: string;
  lat: number;
  lng: number;
};
