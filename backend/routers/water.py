"""
routers/water.py — Water supply control and status endpoints.
"""

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models import FarmConfig, Sensor, WaterSupplyLog
from schemas import WaterControlRequest, WaterSupplyLogResponse

router = APIRouter()


@router.get("", response_model=list[WaterSupplyLogResponse])
async def get_water_status(db: AsyncSession = Depends(get_db)):
    """Get recent water supply logs for all zones."""
    result = await db.execute(
        select(WaterSupplyLog)
        .order_by(desc(WaterSupplyLog.started_at))
        .limit(50)
    )
    return result.scalars().all()


@router.get("/active", response_model=list[WaterSupplyLogResponse])
async def get_active_irrigation(db: AsyncSession = Depends(get_db)):
    """Get all zones currently being irrigated."""
    result = await db.execute(
        select(WaterSupplyLog)
        .where(WaterSupplyLog.status == "active")
        .order_by(desc(WaterSupplyLog.started_at))
    )
    return result.scalars().all()


@router.get("/zone/{zone_id}", response_model=list[WaterSupplyLogResponse])
async def get_zone_water_history(zone_id: int, db: AsyncSession = Depends(get_db)):
    """Get water supply history for a specific zone."""
    result = await db.execute(
        select(WaterSupplyLog)
        .where(WaterSupplyLog.sensor_id == zone_id)
        .order_by(desc(WaterSupplyLog.started_at))
        .limit(20)
    )
    return result.scalars().all()


@router.post("/start/{zone_id}", response_model=WaterSupplyLogResponse)
async def start_irrigation(
    zone_id: int,
    body: WaterControlRequest,
    db: AsyncSession = Depends(get_db),
):
    """Start irrigation for a specific zone."""
    # Verify zone exists
    sensor_result = await db.execute(select(Sensor).where(Sensor.id == zone_id))
    sensor = sensor_result.scalar_one_or_none()
    if not sensor:
        raise HTTPException(status_code=404, detail=f"Zone {zone_id} not found")

    log = WaterSupplyLog(
        sensor_id=zone_id,
        status="active",
        triggered_by=body.triggered_by,
    )
    db.add(log)
    await db.commit()
    await db.refresh(log)
    return log


@router.post("/start-all", response_model=list[WaterSupplyLogResponse])
async def start_all_irrigation(
    body: WaterControlRequest,
    db: AsyncSession = Depends(get_db),
):
    """Start irrigation for all zones in the active farm."""
    cfg_result = await db.execute(select(FarmConfig).where(FarmConfig.is_active == True))
    config = cfg_result.scalar_one_or_none()
    if not config:
        raise HTTPException(status_code=404, detail="No active farm configuration")

    sensors_result = await db.execute(
        select(Sensor).where(Sensor.farm_config_id == config.id)
    )
    sensors = sensors_result.scalars().all()

    logs = []
    for sensor in sensors:
        log = WaterSupplyLog(
            sensor_id=sensor.id,
            status="active",
            triggered_by=body.triggered_by,
        )
        db.add(log)
        logs.append(log)

    await db.commit()
    for log in logs:
        await db.refresh(log)
    return logs


@router.post("/stop/{zone_id}", response_model=WaterSupplyLogResponse)
async def stop_irrigation(zone_id: int, db: AsyncSession = Depends(get_db)):
    """Stop irrigation for a specific zone."""
    result = await db.execute(
        select(WaterSupplyLog)
        .where(WaterSupplyLog.sensor_id == zone_id, WaterSupplyLog.status == "active")
        .order_by(desc(WaterSupplyLog.started_at))
        .limit(1)
    )
    log = result.scalar_one_or_none()
    if not log:
        raise HTTPException(status_code=404, detail=f"No active irrigation for zone {zone_id}")

    log.status = "stopped"
    log.stopped_at = datetime.utcnow()
    await db.commit()
    await db.refresh(log)
    return log


@router.post("/stop-all")
async def stop_all_irrigation(db: AsyncSession = Depends(get_db)):
    """Stop all active irrigation."""
    result = await db.execute(
        select(WaterSupplyLog).where(WaterSupplyLog.status == "active")
    )
    logs = result.scalars().all()
    if not logs:
        return {"message": "No active irrigation to stop", "stopped_count": 0}

    for log in logs:
        log.status = "stopped"
        log.stopped_at = datetime.utcnow()

    await db.commit()
    return {"message": f"Stopped irrigation for {len(logs)} zone(s)", "stopped_count": len(logs)}
