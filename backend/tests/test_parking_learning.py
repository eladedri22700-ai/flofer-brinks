"""Parking median update on customer."""

from src.db.session import SessionLocal
from src.models.customer import Customer
from src.services.learning import record_parking_fix


def test_parking_median_after_three_fixes():
    db = SessionLocal()
    try:
        c = Customer(
            name="__test_park__",
            normalized_address="__test_park_addr__",
            lat=32.0,
            lng=34.0,
            category="other",
            parking_fixes=[],
        )
        db.add(c)
        db.flush()
        record_parking_fix(db, c, 32.01, 34.01)
        record_parking_fix(db, c, 32.03, 34.03)
        assert c.parking_lat is None
        record_parking_fix(db, c, 32.02, 34.02)
        db.flush()
        assert c.parking_sample_count == 3
        assert c.parking_lat == 32.02
        assert c.parking_lng == 34.02
        db.rollback()
    finally:
        db.close()
