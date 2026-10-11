"""Regression (field report 2026-10-11): short rounds were padded to lunch.

The lunch break was a mandatory node in the 11:30-14:00 window, so a round
that could be back by ~09:30 idled until 11:30, and solver slack spread odd
waiting gaps between stops ("unbalanced" ETAs).
"""

from datetime import time

from src.services.optimizer import StopInput, simulate_route_duration, solve_vrptw


def _stop(i: int, **kw) -> StopInput:
    base = dict(
        stop_id=i, lat=32.0, lng=34.8, service_min=10, tw_type="none", tw_start=None,
        tw_end=None, priority="normal", locked=False, sequence_order=i, customer_name=f"S{i}",
    )
    base.update(kw)
    return StopInput(**base)


def _matrix(n: int, leg: int) -> dict[str, list[list[int]]]:
    m = [[0 if i == j else leg for j in range(n)] for i in range(n)]
    return {"morning": m, "midday": m, "afternoon": m}


def _solve(stops, leg, dep=time(7, 0)):
    return solve_vrptw(
        matrices=_matrix(len(stops) + 1, leg),
        stops=stops,
        departure_time=dep,
        break_duration_min=30,
        break_window_start=time(11, 30),
        break_window_end=time(14, 0),
    )


def test_short_morning_round_has_no_lunch_and_no_idle_gaps():
    stops = [_stop(i) for i in range(1, 6)]
    res = _solve(stops, leg=15)
    assert res.feasible
    # 5 legs out + back: 6*15 travel + 5*10 service = 140 min -> back 09:20
    assert res.return_min == 7 * 60 + 140
    assert res.break_start_min is None
    etas = [res.etas_min_from_midnight[sid] for sid in res.sequence_stop_ids]
    gaps = [b - a for a, b in zip(etas, etas[1:])]
    assert all(g == 25 for g in gaps), gaps  # 10 service + 15 drive, no slack


def test_long_round_takes_lunch_inside_window():
    stops = [_stop(i) for i in range(1, 13)]
    res = _solve(stops, leg=25)
    assert res.feasible
    assert res.break_start_min is not None
    assert 11 * 60 + 30 <= res.break_start_min <= 14 * 60


def test_opening_time_wait_only_at_that_stop():
    ret, arrivals, brk = simulate_route_duration(
        _matrix(3, 10),
        stop_indices=[1, 2],
        services=[10, 10],
        departure_min=7 * 60,
        break_duration=30,
        break_window=(11 * 60 + 30, 14 * 60),
        tw_starts=[None, 8 * 60],
    )
    assert arrivals == [7 * 60 + 10, 8 * 60]
    assert brk is None and ret == 8 * 60 + 20
