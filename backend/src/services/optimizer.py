"""OR-Tools VRPTW solver — makespan objective. Never nearest-neighbor."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import time
from typing import Any

from ortools.constraint_solver import pywrapcp, routing_enums_pb2

from src.services.matrix import pick_matrix

FIXED_SEED = 42
# Hard cap for a single round (pilot / field).
MAX_STOPS = 40


def solver_time_limit_s(n_stops: int) -> int:
    """Scale search budget with problem size for short, efficient makespan plans."""
    n = max(0, n_stops)
    if n <= 12:
        return 8
    if n <= 20:
        return 14
    if n <= 30:
        return 20
    return 25


@dataclass
class StopInput:
    stop_id: int
    lat: float
    lng: float
    service_min: int
    tw_type: str  # none | before | after | window
    tw_start: time | None
    tw_end: time | None
    priority: str  # normal | vip
    locked: bool
    sequence_order: int
    customer_name: str
    status: str = "pending"


@dataclass
class SolveResult:
    feasible: bool
    sequence_stop_ids: list[int] = field(default_factory=list)
    etas_min_from_midnight: dict[int, int] = field(default_factory=dict)
    break_after_stop_id: int | None = None
    break_start_min: int | None = None
    return_min: int | None = None
    duration_min: int | None = None
    dropped_stop_ids: list[int] = field(default_factory=list)
    binding_stop_ids: list[int] = field(default_factory=list)
    explanation: dict[str, Any] = field(default_factory=dict)
    variance_extra_min: int | None = None


def _tmin(t: time | None) -> int | None:
    if t is None:
        return None
    return t.hour * 60 + t.minute


def _build_travel(
    matrices: dict[str, list[list[int]]],
    n_physical: int,
    departure_min: int,
) -> list[list[int]]:
    """Static travel matrix for solver (depot+stops). Break handled separately."""
    hour = departure_min // 60
    base = pick_matrix(matrices, hour)
    # n_physical = 1 depot + n stops
    return [row[:] for row in base]


def simulate_route_duration(
    matrices: dict[str, list[list[int]]],
    *,
    stop_indices: list[int],
    services: list[int],
    departure_min: int,
    break_duration: int,
    break_window: tuple[int, int],
    place_break: bool = True,
) -> tuple[int, list[int], int | None]:
    """
    Walk a stop order (node indices into coords matrix, 0=depot).
    Returns (return_min, arrival_mins_per_stop_in_order, break_start_min).
    """
    t = departure_min
    arrivals: list[int] = []
    break_start: int | None = None
    break_placed = not place_break
    bw0, bw1 = break_window

    path = [0] + stop_indices + [0]
    for k in range(len(path) - 1):
        i, j = path[k], path[k + 1]
        # optional break between stops (not before first / after last return)
        if (
            not break_placed
            and k > 0
            and path[k] != 0
            and path[k + 1] != 0
            and t >= bw0
        ):
            # place break when we're inside/after window start and before next travel
            wait = max(0, bw0 - t)
            t += wait
            if t <= bw1:
                break_start = t
                t += break_duration
                break_placed = True

        mat = pick_matrix(matrices, t // 60)
        travel = mat[i][j]
        t += travel
        if j != 0:
            arrivals.append(t)
            # service at stop
            idx_in_services = stop_indices.index(j)
            t += services[idx_in_services]
        # if break never placed and we're past window, force after last stop before return
    if not break_placed and place_break:
        # insert before return
        wait = max(0, bw0 - t)
        t += wait
        break_start = t
        t += break_duration
    return t, arrivals, break_start


def solve_vrptw(
    *,
    matrices: dict[str, list[list[int]]],
    stops: list[StopInput],
    departure_time: time,
    break_duration_min: int,
    break_window_start: time,
    break_window_end: time,
    deadline_buffer_min: int = 10,
    vip_weight: float = 1.0,
    variance_mode: bool = False,
    allow_drop: bool = False,
    drop_penalty: int = 100_000,
    include_break: bool = True,
    historical_sequences: list[list[int]] | None = None,
) -> SolveResult:
    n_stops = len(stops)
    if n_stops == 0:
        return SolveResult(feasible=True, duration_min=0, return_min=_tmin(departure_time))
    if n_stops > MAX_STOPS:
        return SolveResult(
            feasible=False,
            duration_min=0,
            return_min=_tmin(departure_time),
            explanation={
                "reason": "too_many_stops",
                "message_he": (
                    f"יותר מדי יעדים ({n_stops}). המקסימום לסבב הוא {MAX_STOPS}. "
                    "פצלו את הרשימה לשני סבבים."
                ),
            },
        )

    # Node layout: 0=depot, 1..n=stops, optionally n+1=break
    break_node = n_stops + 1 if include_break else -1
    n_nodes = n_stops + 2 if include_break else n_stops + 1
    departure_min = _tmin(departure_time) or 0
    bw0 = _tmin(break_window_start) or (11 * 60 + 30)
    bw1 = _tmin(break_window_end) or (14 * 60)
    day_end = departure_min + 16 * 60  # capacity

    travel = _build_travel(matrices, n_stops + 1, departure_min)

    # Expand travel with break row/col = 0
    full = [[0] * n_nodes for _ in range(n_nodes)]
    for i in range(n_stops + 1):
        for j in range(n_stops + 1):
            full[i][j] = travel[i][j]

    service = [0] * n_nodes
    for i, s in enumerate(stops):
        service[i + 1] = max(0, s.service_min)
    if include_break:
        service[break_node] = max(0, break_duration_min)

    manager = pywrapcp.RoutingIndexManager(n_nodes, 1, 0)
    routing = pywrapcp.RoutingModel(manager)

    def transit_cb(from_index: int, to_index: int) -> int:
        frm = manager.IndexToNode(from_index)
        to = manager.IndexToNode(to_index)
        return int(full[frm][to] + service[frm])

    transit_idx = routing.RegisterTransitCallback(transit_cb)
    routing.SetArcCostEvaluatorOfAllVehicles(transit_idx)

    routing.AddDimension(
        transit_idx,
        120,  # waiting slack
        day_end,
        False,
        "Time",
    )
    time_dim = routing.GetDimensionOrDie("Time")
    time_dim.CumulVar(routing.Start(0)).SetRange(departure_min, departure_min)

    # Stop time windows
    for i, s in enumerate(stops):
        index = manager.NodeToIndex(i + 1)
        tw = s.tw_type
        start_m = _tmin(s.tw_start)
        end_m = _tmin(s.tw_end)
        if tw == "before" and end_m is not None:
            time_dim.CumulVar(index).SetMax(max(departure_min, end_m - deadline_buffer_min))
        elif tw == "after" and start_m is not None:
            time_dim.CumulVar(index).SetMin(start_m)
        elif tw == "window" and start_m is not None and end_m is not None:
            hi = end_m - deadline_buffer_min
            if hi < start_m:
                hi = end_m
            time_dim.CumulVar(index).SetRange(start_m, hi)
        else:
            time_dim.CumulVar(index).SetRange(departure_min, day_end)

        # VIP soft: minimize arrival
        if s.priority == "vip" and vip_weight > 0:
            time_dim.SetCumulVarSoftUpperBound(
                index,
                departure_min,
                int(vip_weight * 50),
            )

    # Break node window
    if include_break:
        b_index = manager.NodeToIndex(break_node)
        time_dim.CumulVar(b_index).SetRange(bw0, bw1)

    # Locked / completed precedence (relative order)
    ordered = sorted(
        [s for s in stops if s.locked or s.status in ("done", "arrived")],
        key=lambda x: x.sequence_order,
    )
    for a, b in zip(ordered, ordered[1:]):
        ia = manager.NodeToIndex(stops.index(a) + 1)
        ib = manager.NodeToIndex(stops.index(b) + 1)
        routing.solver().Add(time_dim.CumulVar(ia) <= time_dim.CumulVar(ib))

    if allow_drop:
        for i in range(1, n_stops + 1):
            routing.AddDisjunction([manager.NodeToIndex(i)], drop_penalty)
        # break still mandatory
    else:
        # all stops + break mandatory (default)
        pass

    # Makespan: minimize return time at depot (End), NOT last delivery.
    # Span coefficient dominates arc travel so the solver prefers earlier
    # depot return even if total km rises slightly.
    time_dim.SetGlobalSpanCostCoefficient(500)
    routing.AddVariableMinimizedByFinalizer(time_dim.CumulVar(routing.End(0)))

    params = pywrapcp.DefaultRoutingSearchParameters()
    params.first_solution_strategy = (
        routing_enums_pb2.FirstSolutionStrategy.PATH_CHEAPEST_ARC
    )
    params.local_search_metaheuristic = (
        routing_enums_pb2.LocalSearchMetaheuristic.GUIDED_LOCAL_SEARCH
    )
    params.time_limit.FromSeconds(solver_time_limit_s(n_stops))

    def _extract(assignment) -> tuple[list[int], dict[int, int], int | None, int | None, int]:
        index = routing.Start(0)
        node_order: list[int] = []
        while not routing.IsEnd(index):
            node = manager.IndexToNode(index)
            if node != 0:
                node_order.append(node)
            index = assignment.Value(routing.NextVar(index))
        seq_ids: list[int] = []
        etas: dict[int, int] = {}
        break_after: int | None = None
        break_start: int | None = None
        prev_stop_id: int | None = None
        for node in node_order:
            idx = manager.NodeToIndex(node)
            arrival = assignment.Value(time_dim.CumulVar(idx))
            if include_break and node == break_node:
                break_start = arrival
                break_after = prev_stop_id
                continue
            stop = stops[node - 1]
            seq_ids.append(stop.stop_id)
            etas[stop.stop_id] = arrival
            prev_stop_id = stop.stop_id
        return_min = assignment.Value(time_dim.CumulVar(routing.End(0)))
        return seq_ids, etas, break_after, break_start, return_min

    candidates: list[tuple[list[int], dict[int, int], int | None, int | None, int]] = []
    seeds = [FIXED_SEED]
    if variance_mode:
        seeds = [FIXED_SEED + i * 17 + (departure_min % 41) for i in range(5)]

    for seed in seeds:
        routing.solver().ReSeed(seed)
        if variance_mode:
            params.time_limit.FromSeconds(2)
        assignment = routing.SolveWithParameters(params)
        if assignment is None:
            continue
        candidates.append(_extract(assignment))
        if not variance_mode:
            break

    if not candidates:
        return SolveResult(feasible=False, explanation={"reason": "no_assignment"})

    best_dur = min(c[4] - departure_min for c in candidates)
    within = [
        c
        for c in candidates
        if (c[4] - departure_min) <= best_dur * 1.07 + 0.5
    ]
    if not within:
        within = candidates

    chosen = within[0]
    variance_extra = 0
    if variance_mode and len(within) > 1:
        import random

        hist = historical_sequences or []
        def diff_score(seq: list[int]) -> int:
            if not hist:
                return 0
            score = 0
            for h in hist:
                # count position mismatches for shared ids
                for i, sid in enumerate(seq):
                    if i < len(h) and h[i] != sid:
                        score += 1
            return score

        within.sort(key=lambda c: (-diff_score(c[0]), c[4]))
        # Prefer most different from history, then random among top half
        top = within[: max(1, len(within) // 2 + 1)]
        rng = random.Random(FIXED_SEED + departure_min + n_stops)
        chosen = rng.choice(top)
        variance_extra = max(0, (chosen[4] - departure_min) - best_dur)

    seq_ids, etas, break_after, break_start, return_min = chosen
    duration = return_min - departure_min

    dropped: list[int] = []
    if allow_drop:
        visited = set(seq_ids)
        for s in stops:
            if s.stop_id not in visited:
                dropped.append(s.stop_id)

    binding = [
        s.stop_id
        for s in stops
        if s.tw_type in ("before", "window") and s.stop_id in etas
    ]

    explanation = {
        "break_after_stop_id": break_after,
        "break_start_min": break_start,
        "break_reason_he": (
            "ההפסקה שובצה בחלון שהוגדר, בנקודה שמצמצמת את זמן החזרה לסניף."
            if break_start is not None
            else "לא שובצה הפסקה במודל."
        ),
        "binding_stop_ids": binding,
        "makespan_min": return_min,
        "variance_mode": variance_mode,
        "variance_extra_min": variance_extra,
        "service_p80_note": (
            "Deadline stops planned on learned_service_p80 (worst-case), "
            "others on median."
        ),
    }

    if allow_drop and dropped:
        return SolveResult(
            feasible=False,
            sequence_stop_ids=seq_ids,
            etas_min_from_midnight=etas,
            break_after_stop_id=break_after,
            break_start_min=break_start,
            return_min=return_min,
            duration_min=duration,
            dropped_stop_ids=dropped,
            binding_stop_ids=binding,
            explanation=explanation,
            variance_extra_min=variance_extra,
        )

    return SolveResult(
        feasible=True,
        sequence_stop_ids=seq_ids,
        etas_min_from_midnight=etas,
        break_after_stop_id=break_after,
        break_start_min=break_start,
        return_min=return_min,
        duration_min=duration,
        binding_stop_ids=binding,
        explanation=explanation,
        variance_extra_min=variance_extra,
    )


def naive_duration_min(
    matrices: dict[str, list[list[int]]],
    stops: list[StopInput],
    departure_time: time,
    break_duration_min: int,
    break_window_start: time,
    break_window_end: time,
) -> int:
    """Simulate original sequence_order — same matrices, no solver reordering."""
    ordered = sorted(stops, key=lambda s: s.sequence_order)
    # map stop -> matrix index (1..n as in coords: depot=0, stop order by input list index)
    id_to_matrix = {s.stop_id: i + 1 for i, s in enumerate(stops)}
    stop_indices = [id_to_matrix[s.stop_id] for s in ordered]
    services = [s.service_min for s in ordered]
    # services aligned to stop_indices order — simulate_route_duration looks up by index in stop_indices
    # Fix: pass services in same order as stop_indices
    dep = _tmin(departure_time) or 0
    bw = (_tmin(break_window_start) or 690, _tmin(break_window_end) or 840)
    # Remap services list for simulate: services[i] for stop_indices[i]
    ret, _, _ = simulate_route_duration(
        matrices,
        stop_indices=stop_indices,
        services=services,
        departure_min=dep,
        break_duration=break_duration_min,
        break_window=bw,
        place_break=True,
    )
    return ret - dep
