"""
predict.py — Run real-world predictions using the trained MultimodalViT model.

Loads the best checkpoint, rebuilds the StandardScaler from training data,
then tests 6 carefully crafted scenarios — including tricky cases where
image alone would give the wrong answer but sensor data corrects it.
"""

import math
import os

import numpy as np
import pandas as pd
import torch
from PIL import Image
from safetensors.torch import load_file
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from transformers import AutoImageProcessor

from config import (
    CSV_PATH,
    IMAGE_BASE_DIR,
    LABEL_NAMES,
    MODEL_NAME,
    NUMERIC_SENSOR_COLS,
    PLANT_TYPE_CATEGORIES,
    SEED,
    TEST_SIZE,
)
from model import MultimodalViT

# ── Paths ─────────────────────────────────────────────────────────────────────
BEST_CHECKPOINT = os.path.join("results", "checkpoint-8800", "model.safetensors")
PROJECT_ROOT    = os.path.dirname(os.path.abspath(__file__))


# ── 1. Rebuild scaler from training split (deterministic, same seed) ──────────
def rebuild_scaler() -> StandardScaler:
    df = pd.read_csv(CSV_PATH)
    train_df, _ = train_test_split(df, test_size=TEST_SIZE, random_state=SEED)

    numeric  = train_df[NUMERIC_SENSOR_COLS].values.astype(np.float32)
    one_hot  = (
        pd.get_dummies(train_df["plant_type"], prefix="plant_type")
        .reindex(columns=[f"plant_type_{c}" for c in PLANT_TYPE_CATEGORIES], fill_value=0)
        .values.astype(np.float32)
    )
    scaler = StandardScaler()
    scaler.fit(np.concatenate([numeric, one_hot], axis=1))
    return scaler


# ── 2. Load model ─────────────────────────────────────────────────────────────
def load_model() -> MultimodalViT:
    model = MultimodalViT()
    state_dict = load_file(BEST_CHECKPOINT)
    model.load_state_dict(state_dict)
    model.eval()
    return model


# ── 3. Core predict function ──────────────────────────────────────────────────
def predict(
    image_path: str,
    N: float,
    P: float,
    K: float,
    soil_moisture: float,
    air_temperature: float,
    humidity: float,
    hour: float,                # 0-23, auto-converted to sin/cos
    plant_type: str,            # "Corn" | "Potato" | "Rice" | "Wheat"
    model: MultimodalViT,
    processor,
    scaler: StandardScaler,
) -> dict:
    # ── Image ─────────────────────────────────────────────────────────────────
    full_path = os.path.join(IMAGE_BASE_DIR, image_path)
    image     = Image.open(full_path).convert("RGB")
    pixel_values = (
        processor(images=image, return_tensors="pt")["pixel_values"]
        .float()
    )  # (1, 3, 224, 224)

    # ── Sensor features ───────────────────────────────────────────────────────
    sin_time = math.sin(2 * math.pi * hour / 24)
    cos_time = math.cos(2 * math.pi * hour / 24)

    numeric = np.array(
        [N, P, K, soil_moisture, air_temperature, humidity, sin_time, cos_time],
        dtype=np.float32,
    ).reshape(1, -1)

    one_hot = np.array(
        [1.0 if plant_type == c else 0.0 for c in PLANT_TYPE_CATEGORIES],
        dtype=np.float32,
    ).reshape(1, -1)

    raw       = np.concatenate([numeric, one_hot], axis=1)       # (1, 12)
    scaled    = scaler.transform(raw).astype(np.float32)
    sensor_t  = torch.from_numpy(scaled)                         # (1, 12)

    # ── Inference ─────────────────────────────────────────────────────────────
    with torch.no_grad():
        output = model(pixel_values=pixel_values, sensor_features=sensor_t)

    probs      = torch.softmax(output.logits, dim=-1)[0]
    pred_idx   = probs.argmax().item()
    pred_label = LABEL_NAMES[pred_idx]
    confidence = probs[pred_idx].item() * 100

    return {
        "prediction": pred_label,
        "confidence": f"{confidence:.1f}%",
        "all_probs": {
            LABEL_NAMES[i]: f"{probs[i].item()*100:.1f}%"
            for i in range(len(LABEL_NAMES))
        },
    }


# ── 4. Pretty printer ─────────────────────────────────────────────────────────
def print_result(case_name: str, result: dict, real_world_note: str):
    bar = "-" * 70
    print(f"\n{bar}")
    print(f"  CASE : {case_name}")
    print(f"  PRED : {result['prediction'].upper()}  ({result['confidence']})")
    print(f"  PROBS: ", end="")
    for label, prob in result["all_probs"].items():
        print(f"{label}={prob}  ", end="")
    print(f"\n  WHY  : {real_world_note}")
    print(bar)


# ── 5. Run all test cases ─────────────────────────────────────────────────────
def run_tests(model, processor, scaler):

    # ── CASE 1: Genuinely healthy corn ────────────────────────────────────────
    # Balanced NPK, normal moisture, mid-morning, low humidity -> should be healthy
    r1 = predict(
        image_path      = "Crop___Disease/Corn/Corn___Healthy/image (1).jpg",
        N=53.1, P=35.6, K=40.4,
        soil_moisture   = 28.0,
        air_temperature = 26.0,
        humidity        = 57.0,
        hour            = 9,           # 9 AM
        plant_type      = "Corn",
        model=model, processor=processor, scaler=scaler,
    )
    print_result(
        "Healthy Corn — good nutrients, normal moisture, morning",
        r1,
        "Balanced NPK + ~28% moisture + 57% humidity = textbook healthy field."
        " Image shows clean leaf. Both paths agree -> healthy.",
    )

    # ── CASE 2: Fungal disease stress (Corn Common Rust) ──────────────────────
    # Diseased image + high humidity (classic fungal condition)
    r2 = predict(
        image_path      = "Crop___Disease/Corn/Corn___Common_Rust/image (1).JPG",
        N=40.7, P=23.7, K=31.8,
        soil_moisture   = 43.0,
        air_temperature = 21.3,
        humidity        = 87.0,         # very high -> fungal conditions
        hour            = 6,            # dawn — peak spore release time
        plant_type      = "Corn",
        model=model, processor=processor, scaler=scaler,
    )
    print_result(
        "Corn Common Rust — diseased leaf + humid dawn",
        r2,
        "Rust spores thrive above 80% humidity. Dawn = dew on leaves = peak infection."
        " Image shows orange pustules. Sensors confirm fungal environment -> disease_stress.",
    )

    # ── CASE 3: Nutrient stress (very low NPK) ────────────────────────────────
    # Healthy-looking wheat image but critically low nitrogen
    r3 = predict(
        image_path      = "Crop___Disease/Wheat/Wheat___Healthy/Healthy002.jpg",
        N=12.0, P=9.0, K=14.0,         # critically low — deficiency range
        soil_moisture   = 34.0,
        air_temperature = 24.0,
        humidity        = 58.0,
        hour            = 11,
        plant_type      = "Wheat",
        model=model, processor=processor, scaler=scaler,
    )
    print_result(
        "Wheat Nutrient Deficiency — low NPK despite healthy-looking leaf",
        r3,
        "N<15 causes yellowing (chlorosis) within days — not yet visible in leaf photo."
        " This is exactly what image-only models MISS. Sensors catch it early -> nutrient_stress.",
    )

    # ── CASE 4: Water / drought stress ────────────────────────────────────────
    # Healthy leaf image but very dry soil + scorching afternoon heat
    r4 = predict(
        image_path      = "Crop___Disease/Rice/Rice___Healthy/IMG_20190419_094251.jpg",
        N=47.0, P=30.0, K=41.0,
        soil_moisture   = 7.0,          # critically dry (field capacity = 25-30%)
        air_temperature = 39.0,         # heat stress threshold for rice = 35°C
        humidity        = 28.0,
        hour            = 14,           # 2 PM — hottest part of day
        plant_type      = "Rice",
        model=model, processor=processor, scaler=scaler,
    )
    print_result(
        "Rice Drought Stress — good nutrients but scorching dry afternoon",
        r4,
        "Rice needs 25-50% soil moisture. At 7% + 39°C the plant wilts and stomata close."
        " Leaf looks OK at photo time but is actively stressed -> water_stress.",
    )

    # ── CASE 5 (TRICKY): Diseased image — but sensors say nutrient stress ─────
    # Real-world: yellowing from rust vs yellowing from N-deficiency looks identical.
    # Sensors have critically low N -> model should read sensors over image appearance.
    r5 = predict(
        image_path      = "Crop___Disease/Corn/Corn___Common_Rust/image (100).JPG",
        N=11.0, P=8.0, K=13.0,         # critically low NPK
        soil_moisture   = 33.0,
        air_temperature = 25.0,
        humidity        = 48.0,         # low humidity — NOT a fungal environment
        hour            = 10,
        plant_type      = "Corn",
        model=model, processor=processor, scaler=scaler,
    )
    print_result(
        "TRICKY — Rust-looking leaf but sensors say nutrient deficiency",
        r5,
        "Low humidity (48%) makes fungal infection unlikely — rust needs >70%."
        " Very low NPK is the real culprit. Image-only model would wrongly say disease."
        " Multimodal model uses sensors to correct the diagnosis -> nutrient_stress.",
    )

    # ── CASE 6 (TRICKY): Healthy image — but sensors say water stress ─────────
    # Early drought: leaf not yet visibly wilted but soil already critically dry.
    # This is EARLY DETECTION — the model should catch it before visual symptoms.
    r6 = predict(
        image_path      = "Crop___Disease/Potato/Potato___Healthy/00fc2ee5-729f-4757-8aeb-65c3355874f2___RS_HL 1864.JPG",
        N=50.0, P=32.0, K=44.0,
        soil_moisture   = 6.0,          # critically dry
        air_temperature = 37.0,
        humidity        = 22.0,
        hour            = 13,           # early afternoon heat
        plant_type      = "Potato",
        model=model, processor=processor, scaler=scaler,
    )
    print_result(
        "TRICKY — Healthy-looking potato but early drought stress",
        r6,
        "Potato wilting appears 24-48h AFTER soil dries below 10%."
        " At photo time the leaf looks fine — image-only model says healthy."
        " Sensors catch the drought early -> water_stress. This is the core value"
        " of multimodal: catching stress BEFORE visible damage.",
    )


# ── Entrypoint ────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    print("Loading model from best checkpoint (step 8800, val_acc=95.34%)...")
    scaler    = rebuild_scaler()
    processor = AutoImageProcessor.from_pretrained(MODEL_NAME)
    model     = load_model()
    print("Model ready.\n")

    run_tests(model, processor, scaler)
