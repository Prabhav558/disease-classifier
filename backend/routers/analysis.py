"""
routers/analysis.py — Crop analysis and disease analysis endpoints.
"""

import asyncio
import os

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from database import get_db
from models import AnalysisResult, DroneImage, FarmConfig, Sensor
from schemas import AnalysisResultResponse, DiseaseAnalysisRequest

UPLOADS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "uploads")

router = APIRouter()


@router.get("/crop", response_model=list[dict])
async def get_crop_analysis(db: AsyncSession = Depends(get_db)):
    """Get latest multimodal analysis result per zone."""
    # Get active config
    config_result = await db.execute(
        select(FarmConfig).where(FarmConfig.is_active == True)
    )
    config = config_result.scalar_one_or_none()
    if not config:
        return []

    # Get all sensors
    sensors_result = await db.execute(
        select(Sensor)
        .where(Sensor.farm_config_id == config.id)
        .order_by(Sensor.zone_index)
    )
    sensors = sensors_result.scalars().all()

    results = []
    for sensor in sensors:
        # Get latest multimodal analysis for this zone
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

        # Get the image path if available
        image_path = None
        if analysis:
            img_result = await db.execute(
                select(DroneImage).where(DroneImage.id == analysis.drone_image_id)
            )
            img = img_result.scalar_one_or_none()
            if img:
                image_path = img.image_path

        results.append({
            "sensor_id": sensor.id,
            "zone_index": sensor.zone_index,
            "zone_row": sensor.zone_row,
            "zone_col": sensor.zone_col,
            "prediction": analysis.prediction if analysis else None,
            "confidence": analysis.confidence if analysis else None,
            "all_probs": analysis.all_probs_json if analysis else None,
            "analyzed_at": analysis.analyzed_at.isoformat() if analysis else None,
            "image_path": image_path,
        })

    return results


@router.post("/disease", response_model=AnalysisResultResponse)
async def run_disease_analysis(
    body: DiseaseAnalysisRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Run the original ViT 13-class disease classification on a stored image."""
    # Get the image
    result = await db.execute(
        select(DroneImage).where(DroneImage.id == body.drone_image_id)
    )
    image = result.scalar_one_or_none()
    if not image:
        raise HTTPException(status_code=404, detail="Image not found")

    filepath = os.path.join(UPLOADS_DIR, image.image_path)
    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="Image file not found on disk")

    # Check if already analyzed with this model
    existing = await db.execute(
        select(AnalysisResult).where(
            AnalysisResult.drone_image_id == body.drone_image_id,
            AnalysisResult.model_type == "vit_disease",
        )
    )
    existing_result = existing.scalar_one_or_none()
    if existing_result:
        return AnalysisResultResponse.model_validate(existing_result)

    # Run inference
    from services.inference import run_disease_classification

    prediction_result = await asyncio.to_thread(
        run_disease_classification, filepath, request.app.state.models
    )

    analysis = AnalysisResult(
        drone_image_id=body.drone_image_id,
        sensor_reading_id=None,
        model_type="vit_disease",
        prediction=prediction_result["prediction"],
        confidence=prediction_result["confidence"],
        all_probs_json=prediction_result["all_probs"],
    )
    db.add(analysis)
    await db.commit()
    await db.refresh(analysis)

    return AnalysisResultResponse.model_validate(analysis)


@router.get("/disease/results", response_model=list[AnalysisResultResponse])
async def list_disease_results(
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
):
    """List past disease analysis results."""
    result = await db.execute(
        select(AnalysisResult)
        .where(AnalysisResult.model_type == "vit_disease")
        .order_by(AnalysisResult.analyzed_at.desc())
        .limit(limit)
    )
    return result.scalars().all()
