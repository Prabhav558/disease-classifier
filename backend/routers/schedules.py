"""
routers/schedules.py — CRUD endpoints for scheduled tasks.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models import Schedule
from schemas import ScheduleCreate, ScheduleResponse

router = APIRouter()


@router.get("", response_model=list[ScheduleResponse])
async def list_schedules(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Schedule).order_by(desc(Schedule.created_at)))
    return result.scalars().all()


@router.post("", response_model=ScheduleResponse)
async def create_schedule(body: ScheduleCreate, db: AsyncSession = Depends(get_db)):
    schedule = Schedule(
        name=body.name,
        action_type=body.action_type,
        zone_id=body.zone_id,
        time_of_day=body.time_of_day,
        repeat=body.repeat,
        enabled=True,
    )
    db.add(schedule)
    await db.commit()
    await db.refresh(schedule)
    return schedule


@router.patch("/{schedule_id}/toggle", response_model=ScheduleResponse)
async def toggle_schedule(schedule_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Schedule).where(Schedule.id == schedule_id))
    schedule = result.scalar_one_or_none()
    if not schedule:
        raise HTTPException(status_code=404, detail="Schedule not found")
    schedule.enabled = not schedule.enabled
    await db.commit()
    await db.refresh(schedule)
    return schedule


@router.delete("/{schedule_id}")
async def delete_schedule(schedule_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Schedule).where(Schedule.id == schedule_id))
    schedule = result.scalar_one_or_none()
    if not schedule:
        raise HTTPException(status_code=404, detail="Schedule not found")
    await db.delete(schedule)
    await db.commit()
    return {"message": f"Schedule #{schedule_id} deleted"}
