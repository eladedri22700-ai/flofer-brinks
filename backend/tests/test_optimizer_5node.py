"""Unit test: 5-node synthetic VRPTW with known preference."""

from datetime import time

from src.services.matrix_mock import build_mock_matrices
from src.services.optimizer import StopInput, naive_duration_min, solve_vrptw


def _stops() -> list[StopInput]:
    # Depot imagined at (32.08, 34.78); stops nearby in Gush Dan
    return [
        StopInput(
            stop_id=1,
            lat=32.09,
            lng=34.80,
            service_min=10,
            tw_type="none",
            tw_start=None,
            tw_end=None,
            priority="normal",
            locked=False,
            sequence_order=0,
            customer_name="A",
        ),
        StopInput(
            stop_id=2,
            lat=32.05,
            lng=34.75,
            service_min=10,
            tw_type="before",
            tw_start=None,
            tw_end=time(9, 0),
            priority="normal",
            locked=False,
            sequence_order=1,
            customer_name="B-deadline",
        ),
        StopInput(
            stop_id=3,
            lat=32.10,
            lng=34.82,
            service_min=10,
            tw_type="none",
            tw_start=None,
            tw_end=None,
            priority="vip",
            locked=False,
            sequence_order=2,
            customer_name="C-vip",
        ),
        StopInput(
            stop_id=4,
            lat=32.07,
            lng=34.78,
            service_min=10,
            tw_type="none",
            tw_start=None,
            tw_end=None,
            priority="normal",
            locked=False,
            sequence_order=3,
            customer_name="D",
        ),
    ]


def test_vrptw_respects_deadline_and_returns_feasible():
    stops = _stops()
    depot = (32.0853, 34.7818)
    coords = [depot] + [(s.lat, s.lng) for s in stops]
    matrices = build_mock_matrices(coords, time(7, 0))

    result = solve_vrptw(
        matrices=matrices,
        stops=stops,
        departure_time=time(7, 0),
        break_duration_min=30,
        break_window_start=time(11, 30),
        break_window_end=time(14, 0),
        deadline_buffer_min=10,
        vip_weight=1.0,
        variance_mode=False,
        allow_drop=False,
    )

    assert result.feasible is True
    assert len(result.sequence_stop_ids) == 4
    # Deadline stop B should appear early (not last)
    assert result.sequence_stop_ids.index(2) < 3
    assert result.return_min is not None
    assert result.duration_min is not None
    assert result.duration_min > 0

    naive = naive_duration_min(
        matrices,
        stops,
        time(7, 0),
        30,
        time(11, 30),
        time(14, 0),
    )
    assert naive > 0


def test_solver_deterministic():
    stops = _stops()
    depot = (32.0853, 34.7818)
    coords = [depot] + [(s.lat, s.lng) for s in stops]
    matrices = build_mock_matrices(coords, time(7, 0))
    kwargs = dict(
        matrices=matrices,
        stops=stops,
        departure_time=time(7, 0),
        break_duration_min=30,
        break_window_start=time(11, 30),
        break_window_end=time(14, 0),
        deadline_buffer_min=10,
        vip_weight=1.0,
        variance_mode=False,
        allow_drop=False,
    )
    a = solve_vrptw(**kwargs)
    b = solve_vrptw(**kwargs)
    assert a.sequence_stop_ids == b.sequence_stop_ids
