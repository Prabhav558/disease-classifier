"""
routers/drone.py — Drone data ingestion endpoint.
"""

import asyncio
import os
import time
from datetime import datetime

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models import AnalysisResult, DroneImage, FarmConfig, Sensor, SensorReading
from schemas import DroneImageResponse, DroneUploadResponse
from services.alert_engine import generate_alerts_from_analysis, generate_alerts_from_reading
from services.weather import get_current_weather

UPLOADS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "uploads")

router = APIRouter()


@router.post("/upload", response_model=DroneUploadResponse)
async def upload_drone_data(
    request: Request,
    zone_id: int = Form(...),
    image: UploadFile = File(...),
    n: float = Form(...),
    p: float = Form(...),
    k: float = Form(...),
    soil_moisture: float = Form(...),
    db: AsyncSession = Depends(get_db),
):
    # Validate sensor/zone exists
    result = await db.execute(select(Sensor).where(Sensor.id == zone_id))
    sensor = result.scalar_one_or_none()
    if not sensor:
        raise HTTPException(status_code=404, detail=f"Sensor/zone {zone_id} not found")

    # Get farm config for weather + crop type
    config_result = await db.execute(
        select(FarmConfig).where(FarmConfig.id == sensor.farm_config_id)
    )
    config = config_result.scalar_one()

    # 1. Save image
    os.makedirs(UPLOADS_DIR, exist_ok=True)
    timestamp_epoch = int(time.time() * 1000)
    ext = os.path.splitext(image.filename or "img.jpg")[1] or ".jpg"
    filename = f"{zone_id}_{timestamp_epoch}{ext}"
    filepath = os.path.join(UPLOADS_DIR, filename)

    content = await image.read()
    with open(filepath, "wb") as f:
        f.write(content)

    # 2. Fetch weather
    weather = await get_current_weather(config.latitude or 0, config.longitude or 0)

    # 3. Create sensor reading
    reading = SensorReading(
        sensor_id=zone_id,
        n=n,
        p=p,
        k=k,
        soil_moisture=soil_moisture,
        air_temperature=weather["air_temperature"],
        humidity=weather["humidity"],
    )
    db.add(reading)

    # 4. Create drone image record
    drone_image = DroneImage(
        sensor_id=zone_id,
        image_path=filename,
    )
    db.add(drone_image)
    await db.flush()

    # 5. Run multimodal inference
    now = datetime.utcnow()
    hour = now.hour + now.minute / 60.0

    from services.inference import run_multimodal_prediction

    prediction_result = await asyncio.to_thread(
        run_multimodal_prediction,
        filepath,
        n, p, k, soil_moisture,
        weather["air_temperature"],
        weather["humidity"],
        hour,
        config.crop_type,
        request.app.state.models,
    )

    # 6. Store analysis result
    analysis = AnalysisResult(
        drone_image_id=drone_image.id,
        sensor_reading_id=reading.id,
        model_type="multimodal",
        prediction=prediction_result["prediction"],
        confidence=prediction_result["confidence"],
        all_probs_json=prediction_result["all_probs"],
    )
    db.add(analysis)

    # 7. Run alert engine
    reading_dict = {"n": n, "p": p, "k": k, "soil_moisture": soil_moisture}
    await generate_alerts_from_reading(zone_id, reading_dict, db)
    await generate_alerts_from_analysis(
        zone_id, prediction_result["prediction"], prediction_result["confidence"], db
    )

    # 8. Update sensor timestamp
    sensor.last_reading_at = datetime.utcnow()

    await db.commit()
    await db.refresh(reading)
    await db.refresh(drone_image)
    await db.refresh(analysis)

    return DroneUploadResponse(
        drone_image=DroneImageResponse.model_validate(drone_image),
        sensor_reading=drone_image_to_reading_response(reading),
        analysis=analysis_to_response(analysis),
    )


def drone_image_to_reading_response(reading):
    from schemas import SensorReadingResponse
    return SensorReadingResponse.model_validate(reading)


def analysis_to_response(analysis):
    from schemas import AnalysisResultResponse
    return AnalysisResultResponse.model_validate(analysis)


@router.get("/flights")
async def list_flights(
    limit: int = 50,
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(DroneImage)
        .order_by(DroneImage.captured_at.desc())
        .limit(limit)
        .offset(offset)
    )
    images = result.scalars().all()
    return [DroneImageResponse.model_validate(img) for img in images]


@router.get("/status")
async def drone_status():
    return {
        "status": "standby",
        "mode": "POC - No real drone connected",
        "upload_endpoint": "POST /api/drone/upload",
        "upload_params": {
            "zone_id": "int (sensor ID)",
            "image": "file (JPEG/PNG)",
            "n": "float (Nitrogen)",
            "p": "float (Phosphorus)",
            "k": "float (Potassium)",
            "soil_moisture": "float (%)",
        },
        "curl_example": (
            'curl -X POST http://localhost:8000/api/drone/upload '
            '-F "zone_id=1" -F "image=@photo.jpg" '
            '-F "n=45.0" -F "p=30.0" -F "k=40.0" -F "soil_moisture=28.0"'
        ),
    }
