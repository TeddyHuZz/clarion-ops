"""AI Root Cause Analysis results for incidents."""

from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


class AIAnalysis(Base):
    __tablename__ = "ai_analysis"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    incident_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("incident_events.id", ondelete="CASCADE"), nullable=False, index=True
    )
    root_cause_summary: Mapped[str] = mapped_column(Text, nullable=False)
    confidence_score: Mapped[int] = mapped_column(Integer, nullable=False)
    recommended_action: Mapped[str] = mapped_column(Text, nullable=False)
    pod_logs: Mapped[str | None] = mapped_column(Text, nullable=True)
    analyzed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default="now()"
    )

    def __repr__(self) -> str:
        return (
            f"<AIAnalysis(id={self.id}, incident={self.incident_id}, "
            f"confidence={self.confidence_score}, action={self.recommended_action})>"
        )
