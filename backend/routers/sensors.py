"""
routers/sensors.py — Sensor CRUD, status updates, and data ingestion.
"""

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models import FarmConfig, Sensor, SensorReading
from schemas import (
    BulkSensorReading,
    SensorReadingCreate,
    SensorReadingResponse,
    SensorResponse,
    SensorStatusUpdate,
)
from services.alert_engine import generate_alerts_from_reading
from services.weather import get_current_weather

router = APIRouter()


async def _get_active_config(db: AsyncSession) -> FarmConfig:
    result = await db.execute(select(FarmConfig).where(FarmConfig.is_active == True))
    config = result.scalar_one_or_none()
    if not config:
        raise HTTPException(status_code=404, detail="No active farm config found")
    return config


@router.get("", response_model=list[SensorResponse])
async def list_sensors(db: AsyncSession = Depends(get_db)):
    config = await _get_active_config(db)
    result = await db.execute(
        select(Sensor)
        .where(Sensor.farm_config_id == config.id)
        .order_by(Sensor.zone_index)
    )
    return result.scalars().all()


@router.put("/{sensor_id}/status", response_model=SensorResponse)
async def update_sensor_status(
    sensor_id: int, body: SensorStatusUpdate, db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(Sensor).where(Sensor.id == sensor_id))
    sensor = result.scalar_one_or_none()
    if not sensor:
        raise HTTPException(status_code=404, detail="Sensor not found")
    sensor.status = body.status
    await db.commit()
    await db.refresh(sensor)
    return sensor


@router.post("/{sensor_id}/reading", response_model=SensorReadingResponse)
async def create_sensor_reading(
    sensor_id: int,
    body: SensorReadingCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Sensor).where(Sensor.id == sensor_id))
    sensor = result.scalar_one_or_none()
    if not sensor:
        raise HTTPException(status_code=404, detail="Sensor not found")

    # Get farm config for lat/lon
    config_result = await db.execute(
        select(FarmConfig).where(FarmConfig.id == sensor.farm_config_id)
    )
    config = config_result.scalar_one()

    # Fetch weather data
    weather = await get_current_weather(config.latitude or 0, config.longitude or 0)

    reading = SensorReading(
        sensor_id=sensor_id,
        n=body.n,
        p=body.p,
        k=body.k,
        soil_moisture=body.soil_moisture,
        air_temperature=weather["air_temperature"],
        humidity=weather["humidity"],
    )
    db.add(reading)

    # Update sensor timestamp
    sensor.last_reading_at = datetime.utcnow()

    # Run alert engine on reading
    reading_dict = {"n": body.n, "p": body.p, "k": body.k, "soil_moisture": body.soil_moisture}
    await generate_alerts_from_reading(sensor_id, reading_dict, db)

    await db.commit()
    await db.refresh(reading)
    return reading


@router.post("/bulk-reading", response_model=list[SensorReadingResponse])
async def create_bulk_readings(
    readings: list[BulkSensorReading],
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    if not readings:
        return []

    # Get farm config for weather
    first_sensor_result = await db.execute(
        select(Sensor).where(Sensor.id == readings[0].sensor_id)
    )
    first_sensor = first_sensor_result.scalar_one_or_none()
    if not first_sensor:
        raise HTTPException(status_code=404, detail="Sensor not found")

    config_result = await db.execute(
        select(FarmConfig).where(FarmConfig.id == first_sensor.farm_config_id)
    )
    config = config_result.scalar_one()

    # Fetch weather once for the whole batch
    weather = await get_current_weather(config.latitude or 0, config.longitude or 0)

    created = []
    for r in readings:
        sensor_result = await db.execute(select(Sensor).where(Sensor.id == r.sensor_id))
        sensor = sensor_result.scalar_one_or_none()
        if not sensor:
            continue

        reading = SensorReading(
            sensor_id=r.sensor_id,
            n=r.n,
            p=r.p,
            k=r.k,
            soil_moisture=r.soil_moisture,
            air_temperature=weather["air_temperature"],
            humidity=weather["humidity"],
        )
        db.add(reading)
        sensor.last_reading_at = datetime.utcnow()

        reading_dict = {"n": r.n, "p": r.p, "k": r.k, "soil_moisture": r.soil_moisture}
        await generate_alerts_from_reading(r.sensor_id, reading_dict, db)
        created.append(reading)

    await db.commit()
    for reading in created:
        await db.refresh(reading)
    return created
