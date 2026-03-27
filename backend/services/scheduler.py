"""
services/scheduler.py — Background task that checks for scheduled actions
every 60 seconds and executes them (water start/stop, sensor reads, scans).
"""

import asyncio
import logging
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import async_session as AsyncSessionLocal
from models import FarmConfig, Schedule, Sensor, SensorReading, WaterSupplyLog
from services.weather import get_current_weather

logger = logging.getLogger(__name__)


async def _run_scheduled_action(schedule: Schedule, db: AsyncSession) -> None:
    """Execute a single scheduled action."""
    try:
        if schedule.action_type == "water_start":
            if schedule.zone_id:
                log = WaterSupplyLog(
                    sensor_id=schedule.zone_id,
                    status="active",
                    triggered_by=f"schedule:{schedule.id}",
                )
                db.add(log)
            else:
                # All zones in active farm
                sensors_result = await db.execute(
                    select(Sensor).join(FarmConfig).where(FarmConfig.is_active == True)
                )
                sensors = sensors_result.scalars().all()
                for sensor in sensors:
                    log = WaterSupplyLog(
                        sensor_id=sensor.id,
                        status="active",
                        triggered_by=f"schedule:{schedule.id}",
                    )
                    db.add(log)
            await db.commit()
            logger.info(f"[Scheduler] water_start executed for schedule {schedule.id}")

        elif schedule.action_type == "water_stop":
            from datetime import datetime as dt
            query = select(WaterSupplyLog).where(WaterSupplyLog.status == "active")
            if schedule.zone_id:
                query = query.where(WaterSupplyLog.sensor_id == schedule.zone_id)
            result = await db.execute(query)
            logs = result.scalars().all()
            for log in logs:
                log.status = "stopped"
                log.stopped_at = dt.utcnow()
            await db.commit()
            logger.info(f"[Scheduler] water_stop executed for schedule {schedule.id}")

        elif schedule.action_type == "sensor_read":
            # Fetch weather and create a reading for the scheduled zone(s)
            cfg_result = await db.execute(select(FarmConfig).where(FarmConfig.is_active == True))
            config = cfg_result.scalar_one_or_none()
            if not config:
                return

            weather = await get_current_weather(config.latitude or 0, config.longitude or 0)

            sensor_query = select(Sensor).where(Sensor.farm_config_id == config.id)
            if schedule.zone_id:
                sensor_query = sensor_query.where(Sensor.id == schedule.zone_id)
            sensors_result = await db.execute(sensor_query)
            sensors = sensors_result.scalars().all()

            for sensor in sensors:
                # Use last reading values as baseline (simulate IoT tick)
                last_result = await db.execute(
                    select(SensorReading)
                    .where(SensorReading.sensor_id == sensor.id)
                    .order_by(SensorReading.timestamp.desc())
                    .limit(1)
                )
                last = last_result.scalar_one_or_none()
                if last:
                    reading = SensorReading(
                        sensor_id=sensor.id,
                        n=last.n, p=last.p, k=last.k,
                        soil_moisture=last.soil_moisture,
                        air_temperature=weather["air_temperature"],
                        humidity=weather["humidity"],
                    )
                    db.add(reading)
                    sensor.last_reading_at = datetime.utcnow()

            await db.commit()
            logger.info(f"[Scheduler] sensor_read executed for schedule {schedule.id}")

        # Disable one-time schedules after execution
        if schedule.repeat == "once":
            schedule.enabled = False
            await db.commit()

    except Exception as e:
        logger.error(f"[Scheduler] Error executing schedule {schedule.id}: {e}")


async def scheduler_task() -> None:
    """Background loop: check schedules every 60 seconds."""
    logger.info("[Scheduler] Background scheduler started.")
    while True:
        try:
            now = datetime.utcnow()
            current_time = now.strftime("%H:%M")
            current_weekday = now.weekday()  # 0=Monday, 6=Sunday

            async with AsyncSessionLocal() as db:
                result = await db.execute(
                    select(Schedule).where(Schedule.enabled == True)
                )
                schedules = result.scalars().all()

                for schedule in schedules:
                    if schedule.time_of_day != current_time:
                        continue
                    if schedule.repeat == "weekdays" and current_weekday >= 5:
                        continue  # skip weekends
                    await _run_scheduled_action(schedule, db)

        except Exception as e:
            logger.error(f"[Scheduler] Loop error: {e}")

        await asyncio.sleep(60)
