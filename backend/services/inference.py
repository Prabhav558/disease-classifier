"""
inference.py — Model loading and prediction wrappers.

Loads both models once at startup:
  1. MultimodalViT (our trained 4-class model) — 18-dim sensor input
  2. Original ViT (wambugu71/crop_leaf_diseases_vit, 13-class image-only)

The StandardScaler is loaded from the saved file (results/scaler.pkl) produced
by train.py, which guarantees exact reproducibility with training-time scaling.
"""

import math
import os
import pickle
import sys

import numpy as np
import torch
from PIL import Image
from safetensors.torch import load_file
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from transformers import AutoImageProcessor, AutoModelForImageClassification

# Add project root to path so we can import model, config
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from model import MultimodalViT

# ── Constants ─────────────────────────────────────────────────────────────────
MODEL_NAME            = "wambugu71/crop_leaf_diseases_vit"
LABEL_NAMES           = ["disease_stress", "healthy", "nutrient_stress", "water_stress"]
PLANT_TYPE_CATEGORIES = ["Corn", "Potato", "Rice", "Wheat"]
SOIL_TYPE_CATEGORIES  = ["Alluvial", "Black", "Clay", "Loamy", "Red", "Sandy"]

BEST_CHECKPOINT = os.path.join(
    PROJECT_ROOT,
    os.environ.get("CHECKPOINT_PATH", "results/checkpoint-8800/model.safetensors"),
)
SCALER_PATH = os.path.join(PROJECT_ROOT, "results", "scaler.pkl")


def _load_scaler() -> StandardScaler:
    """Load scaler from disk if available, otherwise rebuild from training data."""
    if os.path.exists(SCALER_PATH):
        with open(SCALER_PATH, "rb") as f:
            scaler = pickle.load(f)
        print(f"Scaler loaded from {SCALER_PATH}")
        return scaler

    print("Scaler file not found — rebuilding from training split (run train.py to persist it)")
    import pandas as pd
    from config import CSV_PATH, NUMERIC_SENSOR_COLS, SEED, TEST_SIZE

    df = pd.read_csv(CSV_PATH)
    train_df, _ = train_test_split(df, test_size=TEST_SIZE, random_state=SEED)

    numeric = train_df[NUMERIC_SENSOR_COLS].values.astype(np.float32)
    plant_oh = (
        pd.get_dummies(train_df["plant_type"], prefix="plant_type")
        .reindex(columns=[f"plant_type_{c}" for c in PLANT_TYPE_CATEGORIES], fill_value=0)
        .values.astype(np.float32)
    )
    soil_oh = (
        pd.get_dummies(train_df["soil_type"], prefix="soil_type")
        .reindex(columns=[f"soil_type_{c}" for c in SOIL_TYPE_CATEGORIES], fill_value=0)
        .values.astype(np.float32)
    )
    scaler = StandardScaler()
    scaler.fit(np.concatenate([numeric, plant_oh, soil_oh], axis=1))
    return scaler


def load_all_models() -> dict:
    """Load both models, processor, and scaler. Called once at startup."""
    print("Loading MultimodalViT from checkpoint...")
    multimodal_model = MultimodalViT()
    state_dict = load_file(BEST_CHECKPOINT)
    multimodal_model.load_state_dict(state_dict, strict=False)
    multimodal_model.eval()

    print("Loading original ViT disease classifier...")
    vit_disease_model = AutoModelForImageClassification.from_pretrained(MODEL_NAME)
    vit_disease_model.eval()

    processor = AutoImageProcessor.from_pretrained(MODEL_NAME)

    print("Loading StandardScaler...")
    scaler = _load_scaler()

    # Extract disease label names from original model config
    disease_labels = {int(k): v for k, v in vit_disease_model.config.id2label.items()}

    print("All models loaded successfully.")
    return {
        "multimodal_model": multimodal_model,
        "vit_disease_model": vit_disease_model,
        "processor": processor,
        "scaler": scaler,
        "disease_labels": disease_labels,
    }


def run_multimodal_prediction(
    image_path: str,
    n: float,
    p: float,
    k: float,
    soil_moisture: float,
    air_temperature: float,
    humidity: float,
    hour: float,
    crop_type: str,
    soil_type: str,
    models: dict,
) -> dict:
    """Run the 4-class multimodal prediction (image + sensor data)."""
    model     = models["multimodal_model"]
    processor = models["processor"]
    scaler    = models["scaler"]

    # Image
    image        = Image.open(image_path).convert("RGB")
    pixel_values = processor(images=image, return_tensors="pt")["pixel_values"].float()

    # Sensor features (18-dim)
    sin_time = math.sin(2 * math.pi * hour / 24)
    cos_time = math.cos(2 * math.pi * hour / 24)

    numeric = np.array(
        [n, p, k, soil_moisture, air_temperature, humidity, sin_time, cos_time],
        dtype=np.float32,
    ).reshape(1, -1)

    plant_oh = np.array(
        [1.0 if crop_type == c else 0.0 for c in PLANT_TYPE_CATEGORIES],
        dtype=np.float32,
    ).reshape(1, -1)

    soil_oh = np.array(
        [1.0 if soil_type == c else 0.0 for c in SOIL_TYPE_CATEGORIES],
        dtype=np.float32,
    ).reshape(1, -1)

    raw      = np.concatenate([numeric, plant_oh, soil_oh], axis=1)  # (1, 18)
    scaled   = scaler.transform(raw).astype(np.float32)
    sensor_t = torch.from_numpy(scaled)

    with torch.no_grad():
        output = model(pixel_values=pixel_values, sensor_features=sensor_t)

    probs    = torch.softmax(output.logits, dim=-1)[0]
    pred_idx = probs.argmax().item()

    return {
        "prediction": LABEL_NAMES[pred_idx],
        "confidence": round(probs[pred_idx].item() * 100, 1),
        "all_probs": {
            LABEL_NAMES[i]: round(probs[i].item() * 100, 1)
            for i in range(len(LABEL_NAMES))
        },
    }


def run_disease_classification(image_path: str, models: dict) -> dict:
    """Run the 13-class image-only disease classification."""
    model          = models["vit_disease_model"]
    processor      = models["processor"]
    disease_labels = models["disease_labels"]

    image  = Image.open(image_path).convert("RGB")
    inputs = processor(images=image, return_tensors="pt")

    with torch.no_grad():
        output = model(**inputs)

    probs    = torch.softmax(output.logits, dim=-1)[0]
    pred_idx = probs.argmax().item()

    return {
        "prediction": disease_labels.get(pred_idx, f"class_{pred_idx}"),
        "confidence": round(probs[pred_idx].item() * 100, 1),
        "all_probs": {
            disease_labels.get(i, f"class_{i}"): round(probs[i].item() * 100, 1)
            for i in range(len(probs))
        },
    }
