"""
database.py — Async SQLAlchemy setup for PostgreSQL via asyncpg.
"""

import os

from dotenv import load_dotenv
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

DB_USER = os.environ.get("POSTGRES_USER", "crop_user")
DB_PASS = os.environ.get("POSTGRES_PASSWORD", "crop_pass")
DB_HOST = os.environ.get("POSTGRES_HOST", "localhost")
DB_PORT = os.environ.get("POSTGRES_PORT", "5434")
DB_NAME = os.environ.get("POSTGRES_DB", "crop_disease")

DATABASE_URL = f"postgresql+asyncpg://{DB_USER}:{DB_PASS}@{DB_HOST}:{DB_PORT}/{DB_NAME}"

engine = create_async_engine(DATABASE_URL, echo=False)
async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def get_db():
    async with async_session() as session:
        yield session


async def create_tables():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def run_migrations():
    """Add new columns to existing tables that may have been created before schema updates."""
    migrations = [
        # soil_type added to farm_config after initial deployment
        "ALTER TABLE farm_config ADD COLUMN IF NOT EXISTS soil_type VARCHAR(20) NOT NULL DEFAULT 'Loamy'",
        # water_supply_logs and schedules tables are created by create_all, but ensure indexes exist
    ]
    async with engine.begin() as conn:
        for sql in migrations:
            try:
                await conn.execute(text(sql))
            except Exception as e:
                print(f"Migration note: {e}")
