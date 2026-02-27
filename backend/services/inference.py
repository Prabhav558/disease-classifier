"""
inference.py — Model loading and prediction wrappers.

Loads both models once at startup:
  1. MultimodalViT (our trained 4-class model)
  2. Original ViT (wambugu71/crop_leaf_diseases_vit, 13-class image-only)
"""

import math
import os
import sys

import numpy as np
import torch
from PIL import Image
from safetensors.torch import load_file
from transformers import AutoImageProcessor, AutoModelForImageClassification

# Add project root to path so we can import model, predict
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from model import MultimodalViT
from predict import rebuild_scaler

# ── Constants (previously in root config.py) ──────────────────────────────────
MODEL_NAME = "wambugu71/crop_leaf_diseases_vit"
LABEL_NAMES = ["disease_stress", "healthy", "nutrient_stress", "water_stress"]
PLANT_TYPE_CATEGORIES = ["Corn", "Potato", "Rice", "Wheat"]

BEST_CHECKPOINT = os.path.join(
    PROJECT_ROOT,
    os.environ.get("CHECKPOINT_PATH", "results/checkpoint-8800/model.safetensors"),
)


def load_all_models() -> dict:
    """Load both models, processor, and scaler. Called once at startup."""
    print("Loading MultimodalViT from checkpoint...")
    multimodal_model = MultimodalViT()
    state_dict = load_file(BEST_CHECKPOINT)
    multimodal_model.load_state_dict(state_dict)
    multimodal_model.eval()

    print("Loading original ViT disease classifier...")
    vit_disease_model = AutoModelForImageClassification.from_pretrained(MODEL_NAME)
    vit_disease_model.eval()

    processor = AutoImageProcessor.from_pretrained(MODEL_NAME)

    print("Rebuilding StandardScaler from training data...")
    scaler = rebuild_scaler()

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
    models: dict,
) -> dict:
    """Run the 4-class multimodal prediction (image + sensor data)."""
    model = models["multimodal_model"]
    processor = models["processor"]
    scaler = models["scaler"]

    # Image
    image = Image.open(image_path).convert("RGB")
    pixel_values = processor(images=image, return_tensors="pt")["pixel_values"].float()

    # Sensor features
    sin_time = math.sin(2 * math.pi * hour / 24)
    cos_time = math.cos(2 * math.pi * hour / 24)

    numeric = np.array(
        [n, p, k, soil_moisture, air_temperature, humidity, sin_time, cos_time],
        dtype=np.float32,
    ).reshape(1, -1)

    one_hot = np.array(
        [1.0 if crop_type == c else 0.0 for c in PLANT_TYPE_CATEGORIES],
        dtype=np.float32,
    ).reshape(1, -1)

    raw = np.concatenate([numeric, one_hot], axis=1)
    scaled = scaler.transform(raw).astype(np.float32)
    sensor_t = torch.from_numpy(scaled)

    with torch.no_grad():
        output = model(pixel_values=pixel_values, sensor_features=sensor_t)

    probs = torch.softmax(output.logits, dim=-1)[0]
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
    model = models["vit_disease_model"]
    processor = models["processor"]
    disease_labels = models["disease_labels"]

    image = Image.open(image_path).convert("RGB")
    inputs = processor(images=image, return_tensors="pt")

    with torch.no_grad():
        output = model(**inputs)

    probs = torch.softmax(output.logits, dim=-1)[0]
    pred_idx = probs.argmax().item()

    return {
        "prediction": disease_labels.get(pred_idx, f"class_{pred_idx}"),
        "confidence": round(probs[pred_idx].item() * 100, 1),
        "all_probs": {
            disease_labels.get(i, f"class_{i}"): round(probs[i].item() * 100, 1)
            for i in range(len(probs))
        },
    }
