"""
alert_engine.py — Threshold checks and alert generation.
"""

from sqlalchemy.ext.asyncio import AsyncSession

from models import Alert

# Sensor value thresholds
THRESHOLDS = {
    "n": {"low": 20, "critical": 15, "label": "Nitrogen"},
    "p": {"low": 15, "critical": 10, "label": "Phosphorus"},
    "k": {"low": 20, "critical": 15, "label": "Potassium"},
    "soil_moisture": {"low": 15, "critical": 10, "label": "Soil moisture"},
}


async def generate_alerts_from_reading(
    sensor_id: int,
    reading: dict,
    db: AsyncSession,
) -> list[Alert]:
    """Check sensor reading values against thresholds and create alerts."""
    alerts = []
    for key, thresh in THRESHOLDS.items():
        value = reading.get(key, None)
        if value is None:
            continue
        if value < thresh["critical"]:
            alert = Alert(
                sensor_id=sensor_id,
                alert_type="sensor_threshold",
                message=f"Critical: {thresh['label']} = {value:.1f} (below {thresh['critical']})",
                severity="critical",
            )
            db.add(alert)
            alerts.append(alert)
        elif value < thresh["low"]:
            alert = Alert(
                sensor_id=sensor_id,
                alert_type="sensor_threshold",
                message=f"Warning: {thresh['label']} = {value:.1f} (below {thresh['low']})",
                severity="warning",
            )
            db.add(alert)
            alerts.append(alert)
    return alerts


async def generate_alerts_from_analysis(
    sensor_id: int,
    prediction: str,
    confidence: float,
    db: AsyncSession,
) -> list[Alert]:
    """Create alerts based on model predictions."""
    if prediction == "healthy":
        return []

    severity = "critical" if confidence > 80 else "warning"
    alert_type_map = {
        "disease_stress": "disease_stress",
        "nutrient_stress": "nutrient_low",
        "water_stress": "water_stress",
    }

    alert = Alert(
        sensor_id=sensor_id,
        alert_type=alert_type_map.get(prediction, prediction),
        message=f"{prediction.replace('_', ' ').title()} detected with {confidence:.1f}% confidence",
        severity=severity,
    )
    db.add(alert)
    return [alert]
