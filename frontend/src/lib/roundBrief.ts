import type { RouteDto, StopDto } from "../api/client";

export function formatTimeHe(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("he-IL", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jerusalem",
  });
}

export function sortedStops(route: RouteDto | null | undefined): StopDto[] {
  return [...(route?.stops ?? [])].sort(
    (a, b) => a.sequence_order - b.sequence_order,
  );
}

export function nextOpenStop(stops: StopDto[]): StopDto | null {
  return (
    stops.find((s) => s.status !== "done" && s.status !== "skipped") ?? null
  );
}

export function returnTimeLabel(route: RouteDto | null | undefined): string {
  if (!route) return "—";
  const expl = route.solver_explanation;
  if (expl && typeof expl.return_hm === "string" && expl.return_hm) {
    return String(expl.return_hm);
  }
  if (expl && typeof expl.return_at === "string" && expl.return_at) {
    return formatTimeHe(String(expl.return_at));
  }
  const stops = sortedStops(route);
  const last = [...stops].reverse().find((s) => s.eta);
  return last?.eta ? formatTimeHe(last.eta) : "—";
}

export function roundStatusHe(status: string | undefined): string {
  switch (status) {
    case "in_progress":
      return "בנסיעה";
    case "optimized":
      return "מוכן לאישור";
    case "manual":
      return "סדר ידני · מוכן";
    case "completed":
      return "הושלם";
    case "planning":
      return "בתכנון";
    default:
      return status || "—";
  }
}

/** Route has a computed / editable order ready for board or drive. */
export function isRoundReady(status: string | undefined): boolean {
  return status === "optimized" || status === "manual" || status === "in_progress";
}

export function isRoundLive(status: string | undefined): boolean {
  return status === "in_progress";
}

export type RoundBrief = {
  stops: StopDto[];
  next: StopDto | null;
  nextEta: string;
  returnHm: string;
  doneCount: number;
  pendingCount: number;
  durationMin: number | null;
  statusHe: string;
  status: string;
};

/** Short Hebrew time-window chip for list / board scan. */
export function stopWindowHe(
  stop: Pick<StopDto, "tw_type" | "tw_start" | "tw_end">,
): string | null {
  const hm = (t: string | null | undefined) => (t ? t.slice(0, 5) : "");
  if (stop.tw_type === "before" && stop.tw_end) return `עד ${hm(stop.tw_end)}`;
  if (stop.tw_type === "after" && stop.tw_start) return `מ־${hm(stop.tw_start)}`;
  if (stop.tw_type === "window" && stop.tw_start && stop.tw_end) {
    return `${hm(stop.tw_start)}–${hm(stop.tw_end)}`;
  }
  return null;
}

/** Time-of-day (Asia/Jerusalem) an ISO datetime falls on, as "HH:MM". */
function timeOfDayHe(iso: string): string {
  return new Date(iso).toLocaleTimeString("he-IL", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jerusalem",
    hour12: false,
  });
}

/**
 * A VIP stop is "at risk" when its computed ETA falls on or after the end
 * of its time window. Only meaningful for priority "vip" stops that carry
 * a tw_end and haven't been completed/skipped yet.
 */
export function isVipAtRisk(stop: StopDto): boolean {
  if (stop.priority !== "vip" || stop.status === "done" || stop.status === "skipped") {
    return false;
  }
  if (!stop.tw_end || !stop.eta) return false;
  const etaHm = timeOfDayHe(stop.eta);
  return etaHm >= stop.tw_end.slice(0, 5);
}

export function firstVipAtRisk(stops: StopDto[]): StopDto | null {
  return stops.find(isVipAtRisk) ?? null;
}

export function buildRoundBrief(route: RouteDto | null | undefined): RoundBrief | null {
  if (!route || !route.stops?.length) return null;
  const stops = sortedStops(route);
  const next = nextOpenStop(stops);
  const doneCount = stops.filter(
    (s) => s.status === "done" || s.status === "skipped",
  ).length;
  return {
    stops,
    next,
    nextEta: formatTimeHe(next?.eta),
    returnHm: returnTimeLabel(route),
    doneCount,
    pendingCount: stops.length - doneCount,
    durationMin: route.optimized_duration_min ?? null,
    statusHe: roundStatusHe(route.status),
    status: route.status,
  };
}
