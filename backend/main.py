"""
main.py — FastAPI application entry point.

Loads both ML models at startup via lifespan context manager.
"""

import asyncio
import os
import sys

# Add project root and backend to path
BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(BACKEND_DIR)
sys.path.insert(0, BACKEND_DIR)
sys.path.insert(0, PROJECT_ROOT)

from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

load_dotenv(os.path.join(PROJECT_ROOT, ".env"))

from database import create_tables
from services.heartbeat import heartbeat_monitor
from services.inference import load_all_models


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: create tables and load models
    await create_tables()
    print("Database tables created.")

    # Load models in a thread to avoid blocking the event loop
    models = await asyncio.to_thread(load_all_models)
    app.state.models = models

    # Start background task: marks sensors offline if no reading in >2 min
    app.state.heartbeat_task = asyncio.create_task(heartbeat_monitor())
    print("Heartbeat monitor started.")

    yield

    # Shutdown: cancel the heartbeat task gracefully
    app.state.heartbeat_task.cancel()
    try:
        await app.state.heartbeat_task
    except asyncio.CancelledError:
        pass


app = FastAPI(title="Crop Disease Dashboard API", lifespan=lifespan)

# CORS for React dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.environ.get("CORS_ORIGINS", "http://localhost:5173").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
from routers import alerts, analysis, config, dashboard, drone, sensors

app.include_router(config.router, prefix="/api/config", tags=["Farm Config"])
app.include_router(sensors.router, prefix="/api/sensors", tags=["Sensors"])
app.include_router(drone.router, prefix="/api/drone", tags=["Drone"])
app.include_router(analysis.router, prefix="/api/analysis", tags=["Analysis"])
app.include_router(alerts.router, prefix="/api/alerts", tags=["Alerts"])
app.include_router(dashboard.router, prefix="/api/dashboard", tags=["Dashboard"])


@app.get("/api/health")
async def health_check():
    return {"status": "ok", "models_loaded": hasattr(app.state, "models")}
