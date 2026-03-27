FROM python:3.11-slim

# System deps: build tools + OpenMP (required by torch)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python dependencies first (cached layer)
COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy the full project:
#   - backend/   (FastAPI app)
#   - model.py, config.py, etc. (at project root, imported by backend)
# Large artifacts (results/, data/) are excluded via .dockerignore
COPY . .

# Ensure uploads dir exists at runtime
RUN mkdir -p backend/uploads

EXPOSE 8000

# Run from project root so PROJECT_ROOT resolves correctly in main.py
CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000"]
