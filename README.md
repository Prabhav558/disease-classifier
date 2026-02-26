# AgriSense - Multimodal Crop Disease Dashboard

A web dashboard for real-time crop disease detection using a multimodal Vision Transformer (ViT) that fuses drone imagery with IoT sensor data (NPK, soil moisture) and weather information.

## Architecture

```
Frontend (React + Vite)       Backend (FastAPI)         Database (PostgreSQL)
  localhost:5173          -->   localhost:8000       -->   Docker :5434
       |                            |
       |                     +--------------+
       |                     | MultimodalViT |  (4-class: healthy, disease/nutrient/water stress)
       |                     | Original ViT  |  (13-class: specific disease identification)
       |                     +--------------+
       |                            |
       |                     OpenWeatherMap API  (temperature + humidity)
```

### Models
- **Multimodal ViT** (Crop Analysis): Fuses ViT-Tiny image features with sensor data (N, P, K, soil moisture, temperature, humidity). Outputs 4 conditions: `healthy`, `disease_stress`, `nutrient_stress`, `water_stress`. Test accuracy: 93%.
- **Original ViT** (Disease Analysis): Image-only classifier from `wambugu71/crop_leaf_diseases_vit`. Identifies 13 specific diseases (Corn Common Rust, Potato Late Blight, etc.).

## Prerequisites

- **Python 3.12+** with pip
- **Node.js 18+** with npm
- **Docker Desktop** (for PostgreSQL)
- **NVIDIA GPU** (optional, for faster inference; CPU works fine)

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
- `POSTGRES_*` — database credentials (defaults work out of the box)
- `OPENWEATHERMAP_API_KEY` — get a free key at https://openweathermap.org/appid (optional; falls back to 25C/60% humidity without it)
- `CHECKPOINT_PATH` — path to trained model checkpoint (default: `results/checkpoint-8800/model.safetensors`)

### 3. Start PostgreSQL

```bash
docker compose up -d
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

Wait for `All models loaded successfully.` in the console. First startup downloads the pretrained ViT model (~25MB) from HuggingFace.

API docs available at: http://localhost:8000/docs

### 8. Start the frontend

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173 in your browser.

## Usage

### First-time setup
1. Open the dashboard — you'll be redirected to the **Calibration** page
2. Enter your field dimensions (e.g., 8m x 14m), sensor spacing (e.g., 2m), crop type, and region
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
- **Main page** — Field grid visualization with color-coded zones and alerts
- **Crop Analysis** — Per-zone multimodal model results (4-class)
- **Disease Analysis** — Browse uploaded images and run the 13-class disease identifier
- **Drone Management** — API reference and upload history

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
- `analysis.confidence`: ~94%

### Run disease classification on an uploaded image
```bash
curl -X POST http://localhost:8000/api/analysis/disease \
  -H "Content-Type: application/json" \
  -d '{"drone_image_id": 1}'
```

Expected: `prediction: Corn___Common_Rust` with ~100% confidence.

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

## Project Structure

```
disease classifier/
|-- .env.example          # Environment template
|-- docker-compose.yml    # PostgreSQL service
|-- config.py             # ML config (model name, hyperparameters)
|-- model.py              # MultimodalViT architecture
|-- dataset.py            # Dataset & DataLoader
|-- train.py              # Training script
|-- predict.py            # CLI inference script
|-- generate_dataset.py   # CSV dataset generator
|
|-- backend/
|   |-- main.py           # FastAPI app entry point
|   |-- database.py       # SQLAlchemy async setup
|   |-- models.py         # ORM models (6 tables)
|   |-- schemas.py        # Pydantic schemas
|   |-- requirements.txt  # Python dependencies
|   |-- routers/
|   |   |-- config.py     # Farm setup endpoints
|   |   |-- sensors.py    # Sensor CRUD + readings
|   |   |-- drone.py      # Image upload + inference
|   |   |-- analysis.py   # Crop & disease analysis
|   |   |-- alerts.py     # Alert management
|   |   |-- dashboard.py  # Grid state + image serving
|   |-- services/
|   |   |-- inference.py  # Model loading & prediction
|   |   |-- weather.py    # OpenWeatherMap client
|   |   |-- alert_engine.py  # Threshold & model alerts
|   |-- uploads/          # Stored drone images
|
|-- frontend/
|   |-- src/
|   |   |-- App.jsx       # Router + layout
|   |   |-- api/client.js # Axios API client
|   |   |-- pages/        # 5 page components
|   |   |-- components/   # Sidebar, grid, alerts
|   |-- vite.config.js    # Vite + Tailwind + proxy
|
|-- results/              # Model checkpoints (git-ignored)
|-- data/                 # Training images (git-ignored)
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Health check |
| POST | `/api/config` | Create farm config |
| GET | `/api/config/active` | Get active config |
| GET | `/api/sensors` | List all sensors |
| PUT | `/api/sensors/{id}/status` | Update sensor status |
| POST | `/api/sensors/{id}/reading` | Submit sensor reading |
| POST | `/api/sensors/bulk-reading` | Bulk submit readings |
| POST | `/api/drone/upload` | Upload image + sensor data |
| GET | `/api/drone/flights` | Upload history |
| GET | `/api/drone/status` | Drone API reference |
| GET | `/api/analysis/crop` | Latest crop analysis per zone |
| POST | `/api/analysis/disease` | Run disease classification |
| GET | `/api/alerts` | List alerts |
| PUT | `/api/alerts/{id}/acknowledge` | Dismiss alert |
| GET | `/api/dashboard/grid` | Grid state for visualization |
| GET | `/api/dashboard/images` | Browse images (last 2 days) |
| GET | `/api/dashboard/images/{id}/file` | Serve image file |
