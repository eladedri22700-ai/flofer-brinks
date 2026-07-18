"""Unit tests for learning helpers (median, outlier, parking)."""

from src.services.learning import (
    ewma_median,
    is_outlier_duration,
    percentile,
)


def test_ewma_median_basic():
    assert ewma_median([]) is None
    assert ewma_median([10]) == 10
    m = ewma_median([10, 12, 14, 100])
    assert m is not None
    assert 10 <= m <= 20  # recent-weighted but not pulled to 100 alone


def test_percentile_p80():
    vals = [10, 12, 14, 16, 18]
    p = percentile(vals, 80)
    assert p is not None
    assert p >= 14


def test_outlier_exception_and_triple():
    assert is_outlier_duration(15, "gate_wait", 12) is True
    assert is_outlier_duration(15, "none", 12) is False
    assert is_outlier_duration(40, "none", 12) is True
