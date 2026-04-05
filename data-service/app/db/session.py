from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import DeclarativeBase
from typing import AsyncGenerator

from ..core.config import settings

# 1. Database Connection URL Formatting
# Ensure URL uses the asyncpg driver (postgresql+asyncpg://...)
database_url = settings.DATABASE_URL
if database_url.startswith("postgresql://"):
    database_url = database_url.replace("postgresql://", "postgresql+asyncpg://", 1)

# 2. Create the Async Engine
# pool_size and max_overflow should be tuned for production load
engine = create_async_engine(
    database_url,
    echo=False, # Set to True for SQL debug logging
    future=True,
    pool_pre_ping=True
)

# 3. Session Factory
# Expire_on_commit=False prevents unwanted lookups after session closes
async_session = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False
)

# 4. Global Declarative Base
class Base(DeclarativeBase):
    pass

# 5. Dependency for FastAPI
async def get_session() -> AsyncGenerator[AsyncSession, None]:
    """
    Dependency generator for database sessions.
    Automatically closes the session after the request is finished.
    """
    async with async_session() as session:
        yield session
