"""Seed team_leader user, settings, and depot."""

import logging

from src.core.security import hash_password
from src.db.session import SessionLocal
from src.models.depot import Depot
from src.models.user import User
from src.models.user_settings import UserSettings

logger = logging.getLogger(__name__)

SEED_USERNAME = "leader"
SEED_PASSWORD = "Brinks2026!"
SEED_FULL_NAME = "ראש צוות"


def seed() -> None:
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.username == SEED_USERNAME).first()
        if user is None:
            user = User(
                username=SEED_USERNAME,
                password_hash=hash_password(SEED_PASSWORD),
                full_name=SEED_FULL_NAME,
                role="team_leader",
            )
            db.add(user)
            db.flush()
            db.add(UserSettings(user_id=user.id))
            logger.info("Seeded user '%s'", SEED_USERNAME)
        else:
            logger.info("User '%s' already exists — skipped", SEED_USERNAME)

        depot = db.query(Depot).filter(Depot.name == "סניף ברינקס").first()
        if depot is None:
            db.add(
                Depot(
                    name="סניף ברינקס",
                    address="סניף ברינקס — כתובת זמנית",
                    lat=32.0853,
                    lng=34.7818,
                )
            )
            logger.info("Seeded depot 'סניף ברינקס'")
        else:
            logger.info("Depot already exists — skipped")

        db.commit()
        print(f"Seed OK. Login with username={SEED_USERNAME} password={SEED_PASSWORD}")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    seed()
