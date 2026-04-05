from datetime import datetime
from sqlalchemy import String, DateTime
from sqlalchemy.orm import Mapped, mapped_column
from app.db.session import Base

class DeploymentEvent(Base):
    __tablename__ = "deployment_events"

    # Primary key is (time, service_name) for TimescaleDB compatibility
    time: Mapped[datetime] = mapped_column(DateTime(timezone=True), primary_key=True)
    service_name: Mapped[str] = mapped_column(String, primary_key=True)
    
    commit_hash: Mapped[str] = mapped_column(String, nullable=False)
    author: Mapped[str] = mapped_column(String, nullable=False)
    branch: Mapped[str] = mapped_column(String, nullable=False)
    status: Mapped[str] = mapped_column(String, nullable=False)

    def __repr__(self) -> str:
        return f"<DeploymentEvent(service={self.service_name}, status={self.status}, time={self.time})>"
