"""
routers/config.py — Farm configuration and calibration endpoints.
"""

import math

from fastapi import APIRouter, Depends
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models import FarmConfig, Sensor
from schemas import FarmConfigCreate, FarmConfigResponse
from services.weather import geocode_region

router = APIRouter()


@router.post("", response_model=FarmConfigResponse)
async def create_farm_config(body: FarmConfigCreate, db: AsyncSession = Depends(get_db)):
    # Deactivate any previous active config
    await db.execute(update(FarmConfig).where(FarmConfig.is_active == True).values(is_active=False))

    # Calculate grid dimensions
    grid_rows = math.ceil(body.field_width / body.sensor_spacing)
    grid_cols = math.ceil(body.field_height / body.sensor_spacing)

    # Geocode region
    lat, lon = None, None
    coords = await geocode_region(body.region)
    if coords:
        lat, lon = coords

    config = FarmConfig(
        field_width=body.field_width,
        field_height=body.field_height,
        sensor_spacing=body.sensor_spacing,
        grid_rows=grid_rows,
        grid_cols=grid_cols,
        crop_type=body.crop_type,
        region=body.region,
        latitude=lat,
        longitude=lon,
        is_active=True,
    )
    db.add(config)
    await db.flush()

    # Create sensor records for every zone
    sensor_count = 0
    for row in range(grid_rows):
        for col in range(grid_cols):
            sensor = Sensor(
                farm_config_id=config.id,
                zone_index=sensor_count,
                zone_row=row,
                zone_col=col,
                status="active",
            )
            db.add(sensor)
            sensor_count += 1

    await db.commit()
    await db.refresh(config)

    resp = FarmConfigResponse.model_validate(config)
    resp.sensor_count = sensor_count
    return resp


@router.get("/active", response_model=FarmConfigResponse | None)
async def get_active_config(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(FarmConfig).where(FarmConfig.is_active == True)
    )
    config = result.scalar_one_or_none()
    if not config:
        return None

    # Count sensors
    sensor_result = await db.execute(
        select(Sensor).where(Sensor.farm_config_id == config.id)
    )
    sensors = sensor_result.scalars().all()

    resp = FarmConfigResponse.model_validate(config)
    resp.sensor_count = len(sensors)
    return resp
