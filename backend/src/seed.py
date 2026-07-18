"""Seed pilot users (isolated accounts), settings, and depot."""

import logging

from src.core.security import hash_password
from src.db.session import SessionLocal
from src.models.depot import Depot
from src.models.user import User
from src.models.user_settings import UserSettings

logger = logging.getLogger(__name__)

# Each username is a fully isolated account (own routes, prefs, demo, work days).
PILOT_USERS = [
    {
        "username": "daniel",
        "password": "DanielBrinks2026!",
        "full_name": "דניאל",
        "role": "team_leader",
    },
    {
        "username": "elad",
        "password": "EladBrinks2026!",
        "full_name": "אלעד",
        "role": "team_leader",
    },
    # Legacy seed name — keep for older bookmarks; same isolation as elad if recreated empty
    {
        "username": "leader",
        "password": "Brinks2026!",
        "full_name": "ראש צוות (בדיקות)",
        "role": "team_leader",
    },
]


def _ensure_user(db, *, username: str, password: str, full_name: str, role: str) -> User:
    user = db.query(User).filter(User.username == username).first()
    if user is None:
        user = User(
            username=username,
            password_hash=hash_password(password),
            full_name=full_name,
            role=role,
        )
        db.add(user)
        db.flush()
        db.add(UserSettings(user_id=user.id))
        logger.info("Seeded user '%s'", username)
    else:
        # Keep password in sync for pilot so shared credentials stay known.
        user.password_hash = hash_password(password)
        user.full_name = full_name
        if db.query(UserSettings).filter(UserSettings.user_id == user.id).first() is None:
            db.add(UserSettings(user_id=user.id))
        logger.info("Updated pilot user '%s'", username)
    return user


def seed() -> None:
    db = SessionLocal()
    try:
        for row in PILOT_USERS:
            _ensure_user(db, **row)

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
        print("Seed OK. Isolated pilot logins:")
        for row in PILOT_USERS:
            print(f"  {row['username']} / {row['password']}  ({row['full_name']})")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    seed()
