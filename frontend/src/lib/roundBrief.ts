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
    case "completed":
      return "הושלם";
    case "planning":
      return "בתכנון";
    default:
      return status || "—";
  }
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
