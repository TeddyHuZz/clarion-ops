from datetime import datetime
from typing import Optional
from sqlalchemy import String, DateTime
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


class EscalationPolicy(Base):
    """
    SQLAlchemy 2.0 model for escalation routing per service.
    Defines tiered user contacts (L1 → L2 → L3) for incident escalation.
    """
    __tablename__ = "escalation_policies"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    service_name: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    level_1_user: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    level_2_user: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    level_3_user: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default="now()")
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default="now()")

    def __repr__(self) -> str:
        return (
            f"<EscalationPolicy(id={self.id}, service={self.service_name}, "
            f"L1={self.level_1_user}, L2={self.level_2_user}, L3={self.level_3_user})>"
        )
