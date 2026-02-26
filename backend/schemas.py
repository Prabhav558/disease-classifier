"""
schemas.py — Pydantic request/response models for all API endpoints.
"""

from datetime import datetime

from pydantic import BaseModel


# ── Farm Config ──────────────────────────────────────────────────────────────

class FarmConfigCreate(BaseModel):
    field_width: float
    field_height: float
    sensor_spacing: float
    crop_type: str
    region: str


class FarmConfigResponse(BaseModel):
    id: int
    field_width: float
    field_height: float
    sensor_spacing: float
    grid_rows: int
    grid_cols: int
    crop_type: str
    region: str
    latitude: float | None
    longitude: float | None
    is_active: bool
    created_at: datetime
    sensor_count: int | None = None

    model_config = {"from_attributes": True}


# ── Sensors ──────────────────────────────────────────────────────────────────

class SensorResponse(BaseModel):
    id: int
    zone_index: int
    zone_row: int
    zone_col: int
    status: str
    last_reading_at: datetime | None

    model_config = {"from_attributes": True}


class SensorStatusUpdate(BaseModel):
    status: str  # active / error / offline


class SensorReadingCreate(BaseModel):
    n: float
    p: float
    k: float
    soil_moisture: float


class BulkSensorReading(BaseModel):
    sensor_id: int
    n: float
    p: float
    k: float
    soil_moisture: float


class SensorReadingResponse(BaseModel):
    id: int
    sensor_id: int
    n: float
    p: float
    k: float
    soil_moisture: float
    air_temperature: float
    humidity: float
    timestamp: datetime

    model_config = {"from_attributes": True}


# ── Analysis ─────────────────────────────────────────────────────────────────

class AnalysisResultResponse(BaseModel):
    id: int
    drone_image_id: int
    sensor_reading_id: int | None
    model_type: str
    prediction: str
    confidence: float
    all_probs_json: dict
    analyzed_at: datetime

    model_config = {"from_attributes": True}


class DiseaseAnalysisRequest(BaseModel):
    drone_image_id: int


# ── Drone ────────────────────────────────────────────────────────────────────

class DroneImageResponse(BaseModel):
    id: int
    sensor_id: int
    image_path: str
    captured_at: datetime

    model_config = {"from_attributes": True}


class DroneUploadResponse(BaseModel):
    drone_image: DroneImageResponse
    sensor_reading: SensorReadingResponse
    analysis: AnalysisResultResponse


# ── Alerts ───────────────────────────────────────────────────────────────────

class AlertResponse(BaseModel):
    id: int
    sensor_id: int
    alert_type: str
    message: str
    severity: str
    created_at: datetime
    acknowledged: bool

    model_config = {"from_attributes": True}


# ── Dashboard ────────────────────────────────────────────────────────────────

class GridCellResponse(BaseModel):
    sensor_id: int
    zone_index: int
    zone_row: int
    zone_col: int
    status: str
    latest_prediction: str | None = None
    latest_confidence: float | None = None
    has_alert: bool = False
