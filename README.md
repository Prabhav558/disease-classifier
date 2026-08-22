# AgriSense — Multimodal Crop Disease Dashboard

A full-stack web dashboard for real-time crop disease detection, irrigation control, and AI-assisted farm management. Uses a multimodal Vision Transformer (ViT) that fuses drone imagery with IoT sensor data (NPK, soil moisture) and weather information.

## Architecture

```
Frontend (React + Vite)       Backend (FastAPI)           Database (PostgreSQL)
  localhost:5173          ──▶   localhost:8000         ──▶   Docker :5434
       │                            │
       │                     ┌──────────────┐
       │                     │ MultimodalViT │  (4-class: healthy / disease / nutrient / water stress)
       │                     │ Original ViT  │  (13-class: specific disease identification)
       │                     └──────────────┘
       │                            │
       │         ┌──────────────────┼──────────────────┐
       │    OpenWeatherMap     Groq LLM (Llama 3.3)   Scheduler
       │   (temp + humidity)   (AI Assistant + tools)  (cron irrigation)
```

### Models
- **Multimodal ViT** (Crop Analysis) — Fuses ViT-Tiny image features with sensor data (N, P, K, soil moisture, temperature, humidity). Outputs 4 conditions: `healthy`, `disease_stress`, `nutrient_stress`, `water_stress`. Test accuracy: **93 %**.
- **Original ViT** (Disease Analysis) — Image-only classifier from `wambugu71/crop_leaf_diseases_vit`. Identifies 13 specific diseases (Corn Common Rust, Potato Late Blight, etc.).

### AI Assistant (AgriBot)
An agentic chatbot powered by **Groq (Llama 3.3 70B)** with function/tool calling. AgriBot can:
- Dismiss alerts, start/stop irrigation, create schedules
- Query sensor readings, farm config, and analysis results
- Answer general agriculture questions

The frontend supports **browser-native voice I/O** (Web Speech API):
- 🎙️ Mic button for speech-to-text input (auto-sends on silence)
- 🔊 Auto-speak toggle to read every reply aloud
- 🔈 Per-message speaker icon for on-demand TTS

## Prerequisites

- **Python 3.12+** with pip
- **Node.js 18+** with npm
- **Docker Desktop** (for PostgreSQL)
- **NVIDIA GPU** (optional — CPU works fine)
- **Groq API key** (free at https://console.groq.com — required for AI Assistant only)

## Setup

### 1. Clone and enter the project

```bash
git clone <repo-url>
cd "disease classifier"
```

### 2. Environment variables

```bash
cp .env.example .env
```

Edit `.env` and fill in your values:

| Variable | Purpose | Required? |
|----------|---------|-----------|
| `POSTGRES_*` | Database credentials | ✅ (defaults work) |
| `OPENWEATHERMAP_API_KEY` | Weather for multimodal model | Optional (falls back to 25 °C / 60 %) |
| `GROQ_API_KEY` | AI Assistant (AgriBot) | Optional (chat page won't work without it) |
| `GROQ_MODEL` | LLM model name | Optional (default: `llama-3.3-70b-versatile`) |
| `CHECKPOINT_PATH` | Trained model checkpoint | Optional (default: `results/checkpoint-8800/model.safetensors`) |

### 3. Start PostgreSQL DB

```bash
docker compose up -d postgres
```

Verify it's running:
```bash
docker exec crop_disease_db psql -U crop_user -d crop_disease -c "SELECT 1"
```

### 4. Python virtual environment

```bash
python -m venv agri_ai
# Windows
agri_ai\Scripts\activate
# Linux/Mac
source agri_ai/bin/activate
```

### 5. Install Python dependencies

```bash
pip install -r backend/requirements.txt
```

If you have an NVIDIA GPU, install PyTorch with CUDA support:
```bash
pip install torch torchvision --index-url https://download.pytorch.org/whl/cu128
```

### 6. Download dataset and train (or use existing checkpoint)

If you don't have a trained model checkpoint yet:

```bash
# Generate the multimodal CSV dataset
python generate_dataset.py

# Train the model (~5 epochs)
python train.py
```

The best checkpoint will be saved in `results/checkpoint-*/model.safetensors`. Update `CHECKPOINT_PATH` in `.env` if the step number differs from the default.

### 7. Start the backend

```bash
python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000
```

Wait for `All models loaded successfully.` in the console. First startup downloads the pretrained ViT model (~25 MB) from HuggingFace.

API docs available at: http://localhost:8000/docs

### 8. Start the frontend

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173 in your browser.

## Docker Deployment (Full Stack)

To run the entire stack (PostgreSQL + FastAPI backend + React frontend) in Docker:

```bash
docker compose up -d
```

| Service | Container | Exposed port |
|---------|-----------|-------------|
| PostgreSQL | `crop_disease_db` | 5434 |
| FastAPI backend | `crop_disease_backend` | 8000 |
| React frontend (nginx) | `crop_disease_frontend` | 5173 → :80 |

**Requirements before running:**
- Train the model first (`python train.py`) — the backend mounts `./results` read-only
- Fill in `.env` with your API keys

The frontend container is served by nginx and proxies `/api/*` requests to the backend container. Open http://localhost:5173 as usual.

To view logs:
```bash
docker compose logs -f backend
docker compose logs -f frontend
```

## Usage

### First-time setup
1. Open the dashboard — you'll be redirected to the **Calibration** page
2. Enter your field dimensions (e.g., 8 m × 14 m), sensor spacing (e.g., 2 m), crop type, and region
3. Click **Save Configuration** — this creates your sensor grid

### Uploading drone data (POC)
Since there's no real drone, use the API endpoint directly:

```bash
curl -X POST http://localhost:8000/api/drone/upload \
  -F "zone_id=1" \
  -F "image=@path/to/crop_image.jpg" \
  -F "n=45.0" \
  -F "p=30.0" \
  -F "k=40.0" \
  -F "soil_moisture=28.0"
```

This will:
1. Save the image
2. Fetch current weather (temperature + humidity) from OpenWeatherMap
3. Run the multimodal model on image + sensor + weather data
4. Store the analysis result and generate alerts if stress is detected

### Dashboard pages

| Page | Description |
|------|-------------|
| **Main page** | Field grid visualization with color-coded zones and active alerts |
| **Crop Analysis** | Per-zone multimodal model results (4-class) |
| **Disease Analysis** | Browse uploaded images and run the 13-class disease identifier |
| **Drone Management** | API reference and upload history |
| **Water Supply** | Start/stop irrigation per zone or globally, view active and historical logs |
| **AI Assistant** | Voice-enabled chatbot (AgriBot) that can query data and perform actions via natural language |

## Testing

### Backend health check
```bash
curl http://localhost:8000/api/health
# {"status":"ok","models_loaded":true}
```

### Create a farm config
```bash
curl -X POST http://localhost:8000/api/config \
  -H "Content-Type: application/json" \
  -d '{"field_width": 8, "field_height": 14, "sensor_spacing": 2, "crop_type": "Corn", "region": "Delhi"}'
```

### Upload a test image and get analysis
```bash
curl -X POST http://localhost:8000/api/drone/upload \
  -F "zone_id=1" \
  -F "image=@data/Crop___Disease/Corn/Corn___Common_Rust/image (1).JPG" \
  -F "n=40.7" -F "p=23.7" -F "k=31.8" -F "soil_moisture=43.0"
```

Expected response includes:
- `analysis.prediction`: `disease_stress`
- `analysis.confidence`: ~94 %

### Run disease classification on an uploaded image
```bash
curl -X POST http://localhost:8000/api/analysis/disease \
  -H "Content-Type: application/json" \
  -d '{"drone_image_id": 1}'
```

Expected: `prediction: Corn___Common_Rust` with ~100 % confidence.

### Check dashboard grid state
```bash
curl http://localhost:8000/api/dashboard/grid
```

### Check alerts
```bash
curl http://localhost:8000/api/alerts
```

### Submit sensor readings (without drone images)
```bash
curl -X POST http://localhost:8000/api/sensors/1/reading \
  -H "Content-Type: application/json" \
  -d '{"n": 12, "p": 9, "k": 14, "soil_moisture": 8}'
```

Low values will trigger threshold-based alerts.

### IoT Sensor Simulator

Simulates a grid of IoT sensor nodes sending NPK + soil moisture readings to the backend. Automatically cycles through stress scenarios (healthy → nutrient stress → water stress → disease stress → critical).

```bash
python tests/simulate_live.py
```

**Controls:**
- Press **Enter** to skip to the next scenario immediately
- Press **Ctrl+C** to stop

The simulator sends readings for all sensors every 15 seconds and auto-advances scenarios every 3 rounds. Readings are displayed in a live table with color-coded status.

### Drone Flight Simulator

Sends real crop images from `data/Crop___Disease/` to the drone upload endpoint, triggering the full ML pipeline.

**Interactive mode** (pick a plant type from a menu, uploads 10 images):
```bash
python tests/drone_test.py
```

**Specify plant type and count:**
```bash
python tests/drone_test.py --plant Corn --count 5
python tests/drone_test.py --plant Wheat --count 10 --scenario healthy
```

**Single image upload to a specific zone:**
```bash
python tests/drone_test.py --zone 1 --scenario disease
```

**Full sweep over all zones:**
```bash
python tests/drone_test.py --sweep
```

| Flag | Description |
|------|-------------|
| `--plant` | Plant type: `Corn`, `Potato`, `Rice`, `Wheat` |
| `--count` | Number of images to upload (default: 10) |
| `--scenario` | NPK profile: `healthy`, `disease`, `nutrient`, `water` |
| `--zone` | Target a specific sensor/zone ID |
| `--sweep` | Fly over all zones with mixed scenarios |

## Project Structure

```
disease classifier/
├── .env.example              # Environment template
├── .dockerignore             # Docker build ignores
├── docker-compose.yml        # PostgreSQL service
├── config.py                 # ML config (model name, hyperparameters)
├── model.py                  # MultimodalViT architecture
├── dataset.py                # Dataset & DataLoader
├── train.py                  # Training script
├── predict.py                # CLI inference script
├── generate_dataset.py       # CSV dataset generator
│
├── backend/
│   ├── Dockerfile            # Backend container image
│   ├── main.py               # FastAPI app entry point
│   ├── database.py           # SQLAlchemy async setup
│   ├── models.py             # ORM models
│   ├── schemas.py            # Pydantic request/response schemas
│   ├── requirements.txt      # Python dependencies
│   ├── routers/
│   │   ├── config.py         # Farm setup endpoints
│   │   ├── sensors.py        # Sensor CRUD + readings
│   │   ├── drone.py          # Image upload + ML inference
│   │   ├── analysis.py       # Crop & disease analysis
│   │   ├── alerts.py         # Alert management
│   │   ├── dashboard.py      # Grid state + image serving
│   │   ├── water.py          # Irrigation start/stop/status
│   │   ├── schedules.py      # Scheduled task CRUD
│   │   └── chat.py           # AI Assistant (Groq LLM + tool calling)
│   ├── services/
│   │   ├── inference.py      # Model loading & prediction
│   │   ├── weather.py        # OpenWeatherMap client
│   │   ├── alert_engine.py   # Threshold & model-based alerts
│   │   ├── chat_agent.py     # Tool definitions & executor for AgriBot
│   │   ├── scheduler.py      # Cron-style irrigation scheduler
│   │   └── heartbeat.py      # Background health heartbeat
│   └── uploads/              # Stored drone images
│
├── frontend/
│   ├── Dockerfile            # Multi-stage build (Node → nginx)
│   ├── nginx.conf            # SPA routing + /api proxy to backend
│   ├── src/
│   │   ├── App.jsx           # Router + sidebar layout
│   │   ├── index.css         # Global styles + animations
│   │   ├── api/client.js     # Axios API client
│   │   ├── hooks/
│   │   │   └── useVoice.js   # Speech-to-text & text-to-speech hook
│   │   ├── pages/
│   │   │   ├── DashboardPage.jsx
│   │   │   ├── CropAnalysisPage.jsx
│   │   │   ├── DiseaseAnalysisPage.jsx
│   │   │   ├── DroneManagementPage.jsx
│   │   │   ├── WaterSupplyPage.jsx
│   │   │   ├── ChatPage.jsx          # AI Assistant with voice I/O
│   │   │   └── CalibrationPage.jsx
│   │   └── components/       # Sidebar, grid, alerts, etc.
│   └── vite.config.js        # Vite + proxy
│
├── tests/
│   ├── simulate_live.py      # IoT sensor simulator
│   └── drone_test.py         # Drone flight simulator
│
├── results/                  # Model checkpoints (git-ignored)
└── data/                     # Training images (git-ignored)
```

## API Endpoints

### Farm Config
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/config` | Create farm config |
| GET | `/api/config/active` | Get active config |

### Sensors
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/sensors` | List all sensors |
| PUT | `/api/sensors/{id}/status` | Update sensor status |
| POST | `/api/sensors/{id}/reading` | Submit sensor reading |
| POST | `/api/sensors/bulk-reading` | Bulk submit readings |

### Drone
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/drone/upload` | Upload image + sensor data → ML inference |
| GET | `/api/drone/flights` | Upload history |
| GET | `/api/drone/status` | Drone API reference |

### Analysis
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/analysis/crop` | Latest crop analysis per zone |
| POST | `/api/analysis/disease` | Run 13-class disease classification |

### Alerts
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/alerts` | List alerts |
| PUT | `/api/alerts/{id}/acknowledge` | Dismiss an alert |

### Dashboard
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/dashboard/grid` | Grid state for visualization |
| GET | `/api/dashboard/images` | Browse images (last 2 days) |
| GET | `/api/dashboard/images/{id}/file` | Serve an image file |

### Water Supply
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/water` | Recent irrigation logs |
| GET | `/api/water/active` | Currently irrigating zones |
| GET | `/api/water/zone/{zone_id}` | Zone irrigation history |
| POST | `/api/water/start/{zone_id}` | Start irrigation for a zone |
| POST | `/api/water/start-all` | Start irrigation for all zones |
| POST | `/api/water/stop/{zone_id}` | Stop irrigation for a zone |
| POST | `/api/water/stop-all` | Stop all active irrigation |

### Schedules
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/schedules` | List all schedules |
| POST | `/api/schedules` | Create a schedule |
| PATCH | `/api/schedules/{id}/toggle` | Enable/disable a schedule |
| DELETE | `/api/schedules/{id}` | Delete a schedule |

### AI Assistant
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/chat` | Send a message to AgriBot (supports tool calling) |

### System
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Health check |
