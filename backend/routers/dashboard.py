"""
routers/dashboard.py — Dashboard grid state, image browsing, and image serving.
"""

import os
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models import Alert, AnalysisResult, DroneImage, FarmConfig, Sensor
from schemas import DroneImageResponse, GridCellResponse

UPLOADS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "uploads")

router = APIRouter()


@router.get("/grid", response_model=list[GridCellResponse])
async def get_grid_state(db: AsyncSession = Depends(get_db)):
    """Full grid state for the dashboard visualization."""
    config_result = await db.execute(
        select(FarmConfig).where(FarmConfig.is_active == True)
    )
    config = config_result.scalar_one_or_none()
    if not config:
        return []

    sensors_result = await db.execute(
        select(Sensor)
        .where(Sensor.farm_config_id == config.id)
        .order_by(Sensor.zone_index)
    )
    sensors = sensors_result.scalars().all()

    cells = []
    for sensor in sensors:
        # Get latest analysis
        analysis_result = await db.execute(
            select(AnalysisResult)
            .join(DroneImage)
            .where(
                DroneImage.sensor_id == sensor.id,
                AnalysisResult.model_type == "multimodal",
            )
            .order_by(AnalysisResult.analyzed_at.desc())
            .limit(1)
        )
        analysis = analysis_result.scalar_one_or_none()

        # Check for unacknowledged alerts
        alert_result = await db.execute(
            select(Alert).where(
                Alert.sensor_id == sensor.id,
                Alert.acknowledged == False,
            ).limit(1)
        )
        has_alert = alert_result.scalar_one_or_none() is not None

        cells.append(GridCellResponse(
            sensor_id=sensor.id,
            zone_index=sensor.zone_index,
            zone_row=sensor.zone_row,
            zone_col=sensor.zone_col,
            status=sensor.status,
            latest_prediction=analysis.prediction if analysis else None,
            latest_confidence=analysis.confidence if analysis else None,
            has_alert=has_alert,
        ))

    return cells


@router.get("/images", response_model=list[DroneImageResponse])
async def browse_images(
    sensor_id: int | None = None,
    db: AsyncSession = Depends(get_db),
):
    """Browse drone images from the last 2 days."""
    cutoff = datetime.utcnow() - timedelta(days=2)
    query = (
        select(DroneImage)
        .where(DroneImage.captured_at >= cutoff)
        .order_by(DroneImage.captured_at.desc())
    )
    if sensor_id is not None:
        query = query.where(DroneImage.sensor_id == sensor_id)

    result = await db.execute(query)
    return result.scalars().all()


@router.get("/images/{image_id}/file")
async def serve_image(image_id: int, db: AsyncSession = Depends(get_db)):
    """Serve an uploaded image file."""
    result = await db.execute(select(DroneImage).where(DroneImage.id == image_id))
    image = result.scalar_one_or_none()
    if not image:
        raise HTTPException(status_code=404, detail="Image not found")

    filepath = os.path.join(UPLOADS_DIR, image.image_path)
    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="Image file not found on disk")

    return FileResponse(filepath)
