from sqlalchemy import Float, String
from sqlalchemy.orm import Mapped, mapped_column

from src.db.base import Base


class Depot(Base):
    __tablename__ = "depots"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    address: Mapped[str] = mapped_column(String(255), nullable=False)
    lat: Mapped[float] = mapped_column(Float, nullable=False)
    lng: Mapped[float] = mapped_column(Float, nullable=False)
