from datetime import datetime
from typing import Optional
from sqlalchemy import String, DateTime, Text, Integer
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import JSONB

from app.db.session import Base


class IncidentEvent(Base):
    """
    SQLAlchemy 2.0 model for the incident_events hypertable.
    Tracks operational incidents (outages, alerts, degradations)
    correlated to specific services and time windows.
    """
    __tablename__ = "incident_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True, nullable=False)
    time: Mapped[datetime] = mapped_column(DateTime(timezone=True), primary_key=True, nullable=False)
    service_name: Mapped[str] = mapped_column(Text, nullable=False)
    severity: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(Text, nullable=False, default="Open")
    raw_payload: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)

    def __repr__(self) -> str:
        return (
            f"<IncidentEvent(id={self.id}, service={self.service_name}, "
            f"severity={self.severity}, status={self.status})>"
        )
