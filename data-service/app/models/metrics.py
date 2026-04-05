from datetime import datetime
from sqlalchemy import BIGINT, Float, Integer, String, DateTime
from sqlalchemy.orm import Mapped, mapped_column

from ..db.session import Base

class MetricSnapshot(Base):
    """
    SQLAlchemy 2.0 Declarative Model for the metric_snapshots table.
    Mapped specifically to support the TimescaleDB hypertable schema.
    """
    __tablename__ = "metric_snapshots"

    # Mapped Types (typing.Annotated for Python 3.9+)
    # time is the primary partitioning dimension for TimescaleDB
    time: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), 
        primary_key=True, 
        nullable=False
    )
    
    namespace: Mapped[str] = mapped_column(
        String, 
        primary_key=True, # Combined with time for unique constraint
        index=True
    )
    
    pod_name: Mapped[str] = mapped_column(
        String, 
        primary_key=True, # Combined with time for unique constraint
        index=True
    )
    
    cpu_usage: Mapped[float] = mapped_column(
        Float, 
        nullable=True
    )
    
    memory_bytes: Mapped[int] = mapped_column(
        BIGINT, 
        nullable=True
    )
    
    restart_count: Mapped[int] = mapped_column(
        Integer, 
        nullable=True
    )

    def __repr__(self) -> str:
        return f"<MetricSnapshot(pod_name={self.pod_name}, time={self.time})>"
