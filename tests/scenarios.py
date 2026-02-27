"""
scenarios.py — Named NPK + moisture profiles for demo simulation.

Alert thresholds (from backend/services/alert_engine.py):
  N  : warning < 20,  critical < 15
  P  : warning < 15,  critical < 10
  K  : warning < 20,  critical < 15
  Moisture: warning < 15, critical < 10
"""

import random

# ── Named scenarios ───────────────────────────────────────────────────────────
SCENARIOS: dict[str, dict] = {
    "healthy": {
        "label": "Healthy",
        "n": 45, "p": 30, "k": 40, "soil_moisture": 58,
        "description": "All values well above thresholds — no alerts",
    },
    "nutrient_stress": {
        "label": "Nutrient Stress",
        "n": 18, "p": 12, "k": 17, "soil_moisture": 45,
        "description": "N/P/K below warning thresholds — triggers nutrient alerts",
    },
    "water_stress": {
        "label": "Water Stress",
        "n": 40, "p": 28, "k": 35, "soil_moisture": 12,
        "description": "Moisture below critical threshold — triggers water alert",
    },
    "disease_stress": {
        "label": "Disease Stress",
        "n": 22, "p": 16, "k": 21, "soil_moisture": 38,
        "description": "Borderline values — stresses the ML pipeline",
    },
    "critical": {
        "label": "Critical",
        "n": 12, "p": 8, "k": 13, "soil_moisture": 8,
        "description": "All values below critical thresholds — maximum alerts",
    },
}

# Cycle order for the live demo (auto-advances every N rounds)
DEMO_CYCLE = ["healthy", "nutrient_stress", "water_stress", "disease_stress", "healthy"]


def get_reading(scenario_key: str, jitter: float = 3.0) -> dict:
    """Return a reading dict for the given scenario with small random jitter."""
    s = SCENARIOS[scenario_key]
    return {
        "n":             round(max(0, s["n"]             + random.uniform(-jitter, jitter)), 2),
        "p":             round(max(0, s["p"]             + random.uniform(-jitter, jitter)), 2),
        "k":             round(max(0, s["k"]             + random.uniform(-jitter, jitter)), 2),
        "soil_moisture": round(max(0, s["soil_moisture"] + random.uniform(-jitter, jitter)), 2),
    }
