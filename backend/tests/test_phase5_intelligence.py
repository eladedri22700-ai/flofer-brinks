"""Phase 5: variance band, hours helpers, conflict report."""

from datetime import time

from src.services.conflicts import build_conflict_report
from src.services.hours import _fmt_hm
from src.services.matrix_mock import build_mock_matrices
from src.services.optimizer import StopInput, solve_vrptw


def _base_stops() -> list[StopInput]:
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
            customer_name="B",
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
            customer_name="C",
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


def test_variance_extra_within_7pct_band():
    stops = _base_stops()
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
        variance_mode=True,
        allow_drop=False,
        historical_sequences=[[1, 2, 3, 4], [1, 3, 2, 4]],
    )
    assert result.feasible is True
    assert result.duration_min is not None
    extra = result.variance_extra_min or 0
    # Chosen duration must stay within ~7% of best among candidates
    assert extra <= int(result.duration_min * 0.07) + 2
    assert result.explanation.get("variance_mode") is True


def test_hours_fmt_hm():
    assert _fmt_hm(0) == "0:00"
    assert _fmt_hm(516) == "8:36"
    assert _fmt_hm(90) == "1:30"
    assert _fmt_hm(None) == "0:00"


def test_hours_overtime_math():
    standard = 516
    total = 560
    overtime = max(0, total - standard)
    assert overtime == 44
    assert max(0, 400 - standard) == 0


def test_conflict_report_impossible_deadlines():
    """Two distant stops with same tight deadline → drop/conflict options in Hebrew."""
    stops = [
        StopInput(
            stop_id=1,
            lat=32.00,
            lng=34.70,
            service_min=45,
            tw_type="before",
            tw_start=None,
            tw_end=time(8, 15),
            priority="normal",
            locked=False,
            sequence_order=0,
            customer_name="צפון",
        ),
        StopInput(
            stop_id=2,
            lat=32.20,
            lng=34.90,
            service_min=45,
            tw_type="before",
            tw_start=None,
            tw_end=time(8, 15),
            priority="normal",
            locked=False,
            sequence_order=1,
            customer_name="דרום",
        ),
    ]
    depot = (32.0853, 34.7818)
    coords = [depot] + [(s.lat, s.lng) for s in stops]
    matrices = build_mock_matrices(coords, time(7, 0))
    # Inflate travel so both cannot be met
    for bucket in matrices:
        for i in range(len(matrices[bucket])):
            for j in range(len(matrices[bucket])):
                if i != j:
                    matrices[bucket][i][j] = max(matrices[bucket][i][j], 90)

    report = build_conflict_report(
        matrices=matrices,
        stops=stops,
        departure_time=time(7, 0),
        break_duration_min=30,
        break_window_start=time(11, 30),
        break_window_end=time(14, 0),
        deadline_buffer_min=10,
        vip_weight=1.0,
        variance_mode=False,
    )
    assert report.feasible is False or report.dropped_names or report.conflicts
    assert any("חיץ" in o.label_he or "חלונות" in o.label_he for o in report.options)
    assert all("message_he" in c for c in report.conflicts)
