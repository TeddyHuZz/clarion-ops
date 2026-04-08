"""Audit log entries for incident lifecycle events."""

from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


class IncidentLog(Base):
    __tablename__ = "incident_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    time: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default="now()"
    )
    incident_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("incident_events.id", ondelete="CASCADE"), nullable=False, index=True
    )
    message: Mapped[str] = mapped_column(Text, nullable=False)

    def __repr__(self) -> str:
        return f"<IncidentLog(id={self.id}, incident={self.incident_id}, time={self.time})>"
