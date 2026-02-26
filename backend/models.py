"""
models.py — SQLAlchemy ORM models for the crop disease dashboard.
"""

from datetime import datetime

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from database import Base


class FarmConfig(Base):
    __tablename__ = "farm_config"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    field_width: Mapped[float] = mapped_column(Float, nullable=False)
    field_height: Mapped[float] = mapped_column(Float, nullable=False)
    sensor_spacing: Mapped[float] = mapped_column(Float, nullable=False)
    grid_rows: Mapped[int] = mapped_column(Integer, nullable=False)
    grid_cols: Mapped[int] = mapped_column(Integer, nullable=False)
    crop_type: Mapped[str] = mapped_column(String(20), nullable=False)
    region: Mapped[str] = mapped_column(String(100), nullable=False)
    latitude: Mapped[float] = mapped_column(Float, nullable=True)
    longitude: Mapped[float] = mapped_column(Float, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    sensors: Mapped[list["Sensor"]] = relationship(back_populates="farm_config")


class Sensor(Base):
    __tablename__ = "sensors"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    farm_config_id: Mapped[int] = mapped_column(ForeignKey("farm_config.id"))
    zone_index: Mapped[int] = mapped_column(Integer, nullable=False)
    zone_row: Mapped[int] = mapped_column(Integer, nullable=False)
    zone_col: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="active")
    last_reading_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    farm_config: Mapped["FarmConfig"] = relationship(back_populates="sensors")
    readings: Mapped[list["SensorReading"]] = relationship(back_populates="sensor")
    images: Mapped[list["DroneImage"]] = relationship(back_populates="sensor")
    alerts: Mapped[list["Alert"]] = relationship(back_populates="sensor")


class SensorReading(Base):
    __tablename__ = "sensor_readings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    sensor_id: Mapped[int] = mapped_column(ForeignKey("sensors.id"))
    n: Mapped[float] = mapped_column(Float, nullable=False)
    p: Mapped[float] = mapped_column(Float, nullable=False)
    k: Mapped[float] = mapped_column(Float, nullable=False)
    soil_moisture: Mapped[float] = mapped_column(Float, nullable=False)
    air_temperature: Mapped[float] = mapped_column(Float, nullable=False)
    humidity: Mapped[float] = mapped_column(Float, nullable=False)
    timestamp: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    sensor: Mapped["Sensor"] = relationship(back_populates="readings")
    analysis_results: Mapped[list["AnalysisResult"]] = relationship(back_populates="sensor_reading")


class DroneImage(Base):
    __tablename__ = "drone_images"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    sensor_id: Mapped[int] = mapped_column(ForeignKey("sensors.id"))
    image_path: Mapped[str] = mapped_column(String(500), nullable=False)
    captured_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    sensor: Mapped["Sensor"] = relationship(back_populates="images")
    analysis_results: Mapped[list["AnalysisResult"]] = relationship(back_populates="drone_image")


class AnalysisResult(Base):
    __tablename__ = "analysis_results"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    drone_image_id: Mapped[int] = mapped_column(ForeignKey("drone_images.id"))
    sensor_reading_id: Mapped[int | None] = mapped_column(ForeignKey("sensor_readings.id"), nullable=True)
    model_type: Mapped[str] = mapped_column(String(20), nullable=False)
    prediction: Mapped[str] = mapped_column(String(50), nullable=False)
    confidence: Mapped[float] = mapped_column(Float, nullable=False)
    all_probs_json: Mapped[dict] = mapped_column(JSONB, nullable=False)
    analyzed_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    drone_image: Mapped["DroneImage"] = relationship(back_populates="analysis_results")
    sensor_reading: Mapped["SensorReading | None"] = relationship(back_populates="analysis_results")


class Alert(Base):
    __tablename__ = "alerts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    sensor_id: Mapped[int] = mapped_column(ForeignKey("sensors.id"))
    alert_type: Mapped[str] = mapped_column(String(50), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    severity: Mapped[str] = mapped_column(String(20), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    acknowledged: Mapped[bool] = mapped_column(Boolean, default=False)

    sensor: Mapped["Sensor"] = relationship(back_populates="alerts")
