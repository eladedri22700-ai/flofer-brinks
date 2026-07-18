"""P80 risk-aware solver service minutes."""

from src.models.customer import Customer
from src.services.customers import get_solver_service_min


def test_deadline_uses_p80():
    c = Customer(
        name="t",
        normalized_address="a",
        lat=1,
        lng=1,
        service_sample_count=5,
        learned_service_min=10,
        learned_service_p80=16,
    )
    assert get_solver_service_min(c, "before", 12) == 16
    assert get_solver_service_min(c, "window", 12) == 16
    assert get_solver_service_min(c, "none", 12) == 10


def test_below_threshold_falls_back():
    c = Customer(
        name="t2",
        normalized_address="b",
        lat=1,
        lng=1,
        service_sample_count=2,
        learned_service_min=10,
        learned_service_p80=16,
    )
    assert get_solver_service_min(c, "before", 12) == 12
