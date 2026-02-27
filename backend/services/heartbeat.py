"""
services/heartbeat.py — Background task that marks sensors offline
when they have not reported in more than OFFLINE_THRESHOLD_SECONDS.
"""

import asyncio
import logging
from datetime import datetime, timedelta

from sqlalchemy import select

from database import async_session
from models import Sensor

log = logging.getLogger(__name__)

OFFLINE_THRESHOLD_SECONDS = 120  # 2 minutes
CHECK_INTERVAL_SECONDS = 60      # check every 1 minute


async def heartbeat_monitor():
    """
    Runs forever as an asyncio background task.
    Every CHECK_INTERVAL_SECONDS, finds sensors whose last_reading_at
    is older than OFFLINE_THRESHOLD_SECONDS and marks them offline.
    Sensors with last_reading_at=None (never reported) are left alone.
    """
    log.info("Heartbeat monitor started.")
    while True:
        await asyncio.sleep(CHECK_INTERVAL_SECONDS)
        try:
            cutoff = datetime.utcnow() - timedelta(seconds=OFFLINE_THRESHOLD_SECONDS)

            async with async_session() as db:
                result = await db.execute(
                    select(Sensor).where(Sensor.status.in_(["active", "error"]))
                )
                sensors = result.scalars().all()

                marked_offline = []
                for sensor in sensors:
                    # Only mark offline if the sensor previously reported but is now stale
                    if sensor.last_reading_at is not None and sensor.last_reading_at < cutoff:
                        sensor.status = "offline"
                        marked_offline.append(sensor.id)

                if marked_offline:
                    await db.commit()
                    log.warning(
                        "Heartbeat: marked %d sensor(s) offline: %s",
                        len(marked_offline),
                        marked_offline,
                    )
                else:
                    log.debug("Heartbeat: all sensors reporting normally.")

        except Exception as exc:
            log.error("Heartbeat monitor error: %s", exc)
            # Do not re-raise — the loop must keep running through transient errors
