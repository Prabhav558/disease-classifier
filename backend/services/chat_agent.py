"""
services/chat_agent.py — Grok agent system prompt builder, tool definitions,
and tool executor for the agentic chatbot.

Tools the agent can call:
  - list_alerts          — get active alerts
  - dismiss_alert        — acknowledge/delete a false alert
  - get_sensor_readings  — latest sensor data for a zone
  - get_farm_info        — farm config details
  - trigger_scan         — re-run inference on latest image for a zone
  - start_water_supply   — start irrigation for a zone
  - stop_water_supply    — stop irrigation for a zone
  - get_water_status     — irrigation status for all or specific zone
  - create_schedule      — create a scheduled task (watering, sensor reads)
  - list_schedules       — view existing schedules
  - delete_schedule      — remove a schedule
"""

import json
from datetime import datetime

from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from models import (
    Alert, AnalysisResult, DroneImage, FarmConfig,
    Schedule, Sensor, SensorReading, WaterSupplyLog,
)
from schemas import ScheduleCreate


# ── Tool definitions (Grok / OpenAI function-calling format) ──────────────────

TOOL_DEFINITIONS = [
    {
        "type": "function",
        "function": {
            "name": "list_alerts",
            "description": "Get all active (unacknowledged) alerts from the farm.",
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "dismiss_alert",
            "description": "Dismiss (acknowledge) a specific alert by its ID. Use this when the user says an alert is a false alarm or wants it removed.",
            "parameters": {
                "type": "object",
                "properties": {
                    "alert_id": {"type": "integer", "description": "The numeric ID of the alert to dismiss"},
                },
                "required": ["alert_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_sensor_readings",
            "description": "Get the latest sensor readings (N, P, K, soil moisture, temperature, humidity) for a specific zone.",
            "parameters": {
                "type": "object",
                "properties": {
                    "zone_id": {"type": "integer", "description": "Sensor/zone ID"},
                },
                "required": ["zone_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_farm_info",
            "description": "Get the current farm configuration: crop type, soil type, region, grid size.",
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "start_water_supply",
            "description": "Start irrigation/water supply for a specific zone or all zones.",
            "parameters": {
                "type": "object",
                "properties": {
                    "zone_id": {"type": "integer", "description": "Sensor/zone ID to irrigate. Use -1 for all zones."},
                    "triggered_by": {"type": "string", "description": "Who triggered this (default: 'agent')"},
                },
                "required": ["zone_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "stop_water_supply",
            "description": "Stop irrigation/water supply for a specific zone or all zones.",
            "parameters": {
                "type": "object",
                "properties": {
                    "zone_id": {"type": "integer", "description": "Sensor/zone ID to stop irrigation. Use -1 for all zones."},
                },
                "required": ["zone_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_water_status",
            "description": "Get the current irrigation status for all zones or a specific zone.",
            "parameters": {
                "type": "object",
                "properties": {
                    "zone_id": {"type": "integer", "description": "Optional zone ID. Omit for all zones."},
                },
                "required": [],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "create_schedule",
            "description": "Create a scheduled task, e.g. 'water zone 2 every day at 6am' or 'collect sensor data every day at 8am'.",
            "parameters": {
                "type": "object",
                "properties": {
                    "name": {"type": "string", "description": "Descriptive name for the schedule"},
                    "action_type": {
                        "type": "string",
                        "enum": ["water_start", "water_stop", "sensor_read", "scan"],
                        "description": "Type of action to schedule",
                    },
                    "zone_id": {"type": "integer", "description": "Sensor/zone ID. Omit for all zones."},
                    "time_of_day": {"type": "string", "description": "Time in HH:MM 24-hour format, e.g. '06:00'"},
                    "repeat": {
                        "type": "string",
                        "enum": ["daily", "weekdays", "once"],
                        "description": "How often to repeat (default: daily)",
                    },
                },
                "required": ["name", "action_type", "time_of_day"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "list_schedules",
            "description": "List all existing scheduled tasks.",
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "delete_schedule",
            "description": "Delete a scheduled task by its ID.",
            "parameters": {
                "type": "object",
                "properties": {
                    "schedule_id": {"type": "integer", "description": "The ID of the schedule to delete"},
                },
                "required": ["schedule_id"],
            },
        },
    },
]


# ── System prompt builder ─────────────────────────────────────────────────────

async def build_system_prompt(db: AsyncSession) -> str:
    """Fetch live farm context and build the system prompt."""
    # Farm config
    cfg_result = await db.execute(select(FarmConfig).where(FarmConfig.is_active == True))
    config = cfg_result.scalar_one_or_none()

    # Active alerts
    alert_result = await db.execute(
        select(Alert).where(Alert.acknowledged == False).order_by(desc(Alert.created_at)).limit(10)
    )
    alerts = alert_result.scalars().all()

    # Latest analysis results
    analysis_result = await db.execute(
        select(AnalysisResult).order_by(desc(AnalysisResult.analyzed_at)).limit(5)
    )
    analyses = analysis_result.scalars().all()

    # Sensor count
    sensor_count = 0
    if config:
        sensor_res = await db.execute(
            select(Sensor).where(Sensor.farm_config_id == config.id)
        )
        sensor_count = len(sensor_res.scalars().all())

    farm_info = "No farm configured yet."
    if config:
        farm_info = (
            f"Crop: {config.crop_type} | Soil: {config.soil_type} | "
            f"Region: {config.region} | Grid: {config.grid_rows}x{config.grid_cols} "
            f"({sensor_count} zones)"
        )

    alerts_info = "No active alerts."
    if alerts:
        alerts_info = "\n".join(
            f"  Alert #{a.id} [Zone {a.sensor_id}] {a.severity.upper()}: {a.message}"
            for a in alerts
        )

    analyses_info = "No analyses yet."
    if analyses:
        analyses_info = "\n".join(
            f"  Analysis #{a.id} [Zone {a.drone_image_id}]: {a.prediction} ({a.confidence}% confidence)"
            for a in analyses
        )

    return f"""You are AgriBot, an expert AI agricultural assistant for the AgriSense farm management system.
You have deep knowledge of crop diseases, soil health, irrigation, nutrient management, and precision agriculture.

CURRENT FARM STATUS (live data):
- Farm: {farm_info}
- Active Alerts:
{alerts_info}
- Recent Analyses:
{analyses_info}

YOUR CAPABILITIES:
You can answer questions AND take actions in the system using the available tools.
When the user asks you to do something (dismiss an alert, start irrigation, set a schedule, etc.),
use the appropriate tool to carry out the action — don't just describe it.

GUIDELINES:
- Be concise but informative
- When dismissing alerts, confirm what you dismissed
- When creating schedules, confirm the time and zone
- When starting/stopping water, confirm the zone and action
- If a zone_id is ambiguous, ask for clarification
- Always explain WHY a recommendation makes sense agronomically
- Current time: {datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')}
"""


# ── Tool executor ─────────────────────────────────────────────────────────────

async def execute_tool(tool_name: str, args: dict, db: AsyncSession) -> str:
    """Dispatch tool calls to the appropriate DB operations."""

    if tool_name == "list_alerts":
        result = await db.execute(
            select(Alert).where(Alert.acknowledged == False).order_by(desc(Alert.created_at))
        )
        alerts = result.scalars().all()
        if not alerts:
            return "No active alerts."
        return json.dumps([
            {"id": a.id, "zone_id": a.sensor_id, "type": a.alert_type,
             "message": a.message, "severity": a.severity,
             "created_at": a.created_at.isoformat()}
            for a in alerts
        ])

    elif tool_name == "dismiss_alert":
        alert_id = args["alert_id"]
        result = await db.execute(select(Alert).where(Alert.id == alert_id))
        alert = result.scalar_one_or_none()
        if not alert:
            return f"Alert #{alert_id} not found."
        alert.acknowledged = True
        await db.commit()
        return f"Alert #{alert_id} dismissed successfully."

    elif tool_name == "get_sensor_readings":
        zone_id = args["zone_id"]
        result = await db.execute(
            select(SensorReading)
            .where(SensorReading.sensor_id == zone_id)
            .order_by(desc(SensorReading.timestamp))
            .limit(1)
        )
        reading = result.scalar_one_or_none()
        if not reading:
            return f"No readings found for zone {zone_id}."
        return json.dumps({
            "zone_id": zone_id,
            "N": reading.n, "P": reading.p, "K": reading.k,
            "soil_moisture": reading.soil_moisture,
            "air_temperature": reading.air_temperature,
            "humidity": reading.humidity,
            "timestamp": reading.timestamp.isoformat(),
        })

    elif tool_name == "get_farm_info":
        result = await db.execute(select(FarmConfig).where(FarmConfig.is_active == True))
        config = result.scalar_one_or_none()
        if not config:
            return "No active farm configuration."
        return json.dumps({
            "crop_type": config.crop_type,
            "soil_type": config.soil_type,
            "region": config.region,
            "grid": f"{config.grid_rows}x{config.grid_cols}",
            "field_size": f"{config.field_width}m x {config.field_height}m",
        })

    elif tool_name == "start_water_supply":
        zone_id = args["zone_id"]
        triggered_by = args.get("triggered_by", "agent")

        if zone_id == -1:
            # All zones
            sensors_result = await db.execute(
                select(Sensor).join(FarmConfig).where(FarmConfig.is_active == True)
            )
            sensors = sensors_result.scalars().all()
            for sensor in sensors:
                log = WaterSupplyLog(sensor_id=sensor.id, status="active", triggered_by=triggered_by)
                db.add(log)
            await db.commit()
            return f"Irrigation started for all {len(sensors)} zones."
        else:
            log = WaterSupplyLog(sensor_id=zone_id, status="active", triggered_by=triggered_by)
            db.add(log)
            await db.commit()
            return f"Irrigation started for zone {zone_id}."

    elif tool_name == "stop_water_supply":
        zone_id = args["zone_id"]

        if zone_id == -1:
            result = await db.execute(
                select(WaterSupplyLog)
                .join(Sensor)
                .join(FarmConfig)
                .where(FarmConfig.is_active == True, WaterSupplyLog.status == "active")
            )
            logs = result.scalars().all()
            for log in logs:
                log.status = "stopped"
                log.stopped_at = datetime.utcnow()
            await db.commit()
            return f"Irrigation stopped for {len(logs)} active zones."
        else:
            result = await db.execute(
                select(WaterSupplyLog)
                .where(WaterSupplyLog.sensor_id == zone_id, WaterSupplyLog.status == "active")
                .order_by(desc(WaterSupplyLog.started_at))
                .limit(1)
            )
            log = result.scalar_one_or_none()
            if not log:
                return f"No active irrigation found for zone {zone_id}."
            log.status = "stopped"
            log.stopped_at = datetime.utcnow()
            await db.commit()
            return f"Irrigation stopped for zone {zone_id}."

    elif tool_name == "get_water_status":
        zone_id = args.get("zone_id")
        query = (
            select(WaterSupplyLog)
            .order_by(desc(WaterSupplyLog.started_at))
        )
        if zone_id:
            query = query.where(WaterSupplyLog.sensor_id == zone_id).limit(5)
        else:
            query = query.limit(20)

        result = await db.execute(query)
        logs = result.scalars().all()
        if not logs:
            return "No water supply records found."
        return json.dumps([
            {"id": l.id, "zone_id": l.sensor_id, "status": l.status,
             "started_at": l.started_at.isoformat(),
             "stopped_at": l.stopped_at.isoformat() if l.stopped_at else None,
             "triggered_by": l.triggered_by}
            for l in logs
        ])

    elif tool_name == "create_schedule":
        schedule = Schedule(
            name=args["name"],
            action_type=args["action_type"],
            zone_id=args.get("zone_id"),
            time_of_day=args["time_of_day"],
            repeat=args.get("repeat", "daily"),
            enabled=True,
        )
        db.add(schedule)
        await db.commit()
        await db.refresh(schedule)
        zone_label = f"zone {schedule.zone_id}" if schedule.zone_id else "all zones"
        return f"Schedule '{schedule.name}' created: {schedule.action_type} for {zone_label} at {schedule.time_of_day} ({schedule.repeat}). ID: {schedule.id}"

    elif tool_name == "list_schedules":
        result = await db.execute(select(Schedule).order_by(desc(Schedule.created_at)))
        schedules = result.scalars().all()
        if not schedules:
            return "No schedules configured."
        return json.dumps([
            {"id": s.id, "name": s.name, "action_type": s.action_type,
             "zone_id": s.zone_id, "time_of_day": s.time_of_day,
             "repeat": s.repeat, "enabled": s.enabled}
            for s in schedules
        ])

    elif tool_name == "delete_schedule":
        schedule_id = args["schedule_id"]
        result = await db.execute(select(Schedule).where(Schedule.id == schedule_id))
        schedule = result.scalar_one_or_none()
        if not schedule:
            return f"Schedule #{schedule_id} not found."
        await db.delete(schedule)
        await db.commit()
        return f"Schedule #{schedule_id} '{schedule.name}' deleted."

    return f"Unknown tool: {tool_name}"
