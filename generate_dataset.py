"""
Multimodal Agriculture Dataset Generator
=========================================
Walks the Crop___Disease image folder tree, pairs each image with simulated
soil-nutrient, environmental, and time-context sensor readings, and writes:
  1. agri_multimodal_dataset.csv  (one row per image)
  2. dataset_summary.json         (class counts, mean NPK, moisture dist)

Reproducible via fixed random seed (42).
"""

import os
import math
import json
import random
from pathlib import Path

import numpy as np
import pandas as pd

# ── Configuration ────────────────────────────────────────────────────────────
SEED = 42
random.seed(SEED)
np.random.seed(SEED)

BASE_DIR = Path(__file__).resolve().parent
DATASET_DIR = BASE_DIR / "Crop___Disease"
OUTPUT_CSV = BASE_DIR / "agri_multimodal_dataset.csv"
OUTPUT_JSON = BASE_DIR / "dataset_summary.json"

IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".bmp", ".webp", ".tiff"}

# Fungal-disease folder keywords
FUNGAL_KEYWORDS = [
    "Common_Rust", "Leaf_Blight", "Brown_Rust", "Yellow_Rust",
    "Early_Blight", "Late_Blight", "Leaf_Blast", "Brown_Spot",
    "Gray_Leaf_Spot",
]

# Probability of applying stress simulations to diseased / healthy samples
NUTRIENT_STRESS_PROB = 0.15   # 15 % of samples get nutrient stress
WATER_STRESS_PROB = 0.10      # 10 % of samples get water stress


# ── Helper functions ─────────────────────────────────────────────────────────

def add_noise(value: float, noise_pct: float = 0.075) -> float:
    """Add Gaussian noise (default ±7.5 %) to a value."""
    return value * (1 + np.random.normal(0, noise_pct))


def clamp(value: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, value))


def is_fungal(disease_label: str) -> bool:
    return any(kw.lower() in disease_label.lower() for kw in FUNGAL_KEYWORDS)


def parse_folder(folder_name: str):
    """Return (plant_type, disease_label) from e.g. 'Corn___Common_Rust'."""
    parts = folder_name.split("___")
    plant_type = parts[0]
    disease_label = parts[1] if len(parts) > 1 else "Unknown"
    return plant_type, disease_label


# ── Sensor-value generators ─────────────────────────────────────────────────

def generate_healthy_baseline():
    """Balanced nutrients, moderate moisture & humidity."""
    return {
        "N": clamp(add_noise(np.random.uniform(35, 60)), 10, 80),
        "P": clamp(add_noise(np.random.uniform(20, 40)), 5,  60),
        "K": clamp(add_noise(np.random.uniform(30, 50)), 10, 70),
        "soil_moisture": clamp(add_noise(np.random.uniform(25, 40)), 5, 60),
        "air_temperature": clamp(add_noise(np.random.uniform(22, 32)), 20, 38),
        "humidity": clamp(add_noise(np.random.uniform(45, 70)), 40, 90),
    }


def generate_fungal_stress():
    """High humidity, normal-to-slightly-high moisture, mostly balanced NPK."""
    return {
        "N": clamp(add_noise(np.random.uniform(35, 60)), 10, 80),
        "P": clamp(add_noise(np.random.uniform(20, 40)), 5,  60),
        "K": clamp(add_noise(np.random.uniform(30, 50)), 10, 70),
        "soil_moisture": clamp(add_noise(np.random.uniform(28, 45)), 10, 60),
        "air_temperature": clamp(add_noise(np.random.uniform(22, 34)), 20, 38),
        "humidity": clamp(add_noise(np.random.uniform(65, 90)), 40, 95),
    }


def apply_nutrient_stress(sensor: dict) -> dict:
    """Reduce ONE nutrient to 10–25 range."""
    nutrient = random.choice(["N", "P", "K"])
    sensor[nutrient] = clamp(add_noise(np.random.uniform(10, 25), 0.05), 5, 30)
    return sensor


def apply_water_stress(sensor: dict) -> dict:
    """Low moisture, slightly elevated temperature."""
    sensor["soil_moisture"] = clamp(add_noise(np.random.uniform(5, 20), 0.05), 3, 25)
    sensor["air_temperature"] = clamp(
        add_noise(np.random.uniform(30, 38), 0.05), 25, 42
    )
    return sensor


# ── Main generation logic ───────────────────────────────────────────────────

def collect_images():
    """Walk DATASET_DIR and yield (image_path, plant_type, disease_label)."""
    for plant_dir in sorted(DATASET_DIR.iterdir()):
        if not plant_dir.is_dir():
            continue
        for disease_dir in sorted(plant_dir.iterdir()):
            if not disease_dir.is_dir():
                continue
            plant_type, disease_label = parse_folder(disease_dir.name)
            for img_file in sorted(disease_dir.iterdir()):
                if img_file.suffix.lower() in IMAGE_EXTENSIONS:
                    # Store relative path for portability
                    rel_path = img_file.relative_to(BASE_DIR).as_posix()
                    yield rel_path, plant_type, disease_label


def generate_row(plant_type: str, disease_label: str):
    """Generate sensor values + condition label for one sample."""
    is_healthy = disease_label.lower() == "healthy"
    fungal = is_fungal(disease_label)

    # --- base sensor profile ---
    if is_healthy:
        sensor = generate_healthy_baseline()
    elif fungal:
        sensor = generate_fungal_stress()
    else:
        sensor = generate_healthy_baseline()  # fallback for any unknown

    # --- condition label (start with base) ---
    if is_healthy:
        condition = "healthy"
    else:
        condition = "disease_stress"

    # --- random stress overlays (can override condition) ---
    roll = random.random()
    if roll < WATER_STRESS_PROB:
        sensor = apply_water_stress(sensor)
        condition = "water_stress"
    elif roll < WATER_STRESS_PROB + NUTRIENT_STRESS_PROB:
        sensor = apply_nutrient_stress(sensor)
        condition = "nutrient_stress"

    # --- cyclic time encoding ---
    hour = np.random.randint(0, 24)
    sin_time = round(math.sin(2 * math.pi * hour / 24), 6)
    cos_time = round(math.cos(2 * math.pi * hour / 24), 6)

    # Round sensor values for cleanliness
    for k in sensor:
        sensor[k] = round(sensor[k], 2)

    return {**sensor, "sin_time": sin_time, "cos_time": cos_time,
            "final_condition_label": condition}


def build_dataset():
    rows = []
    for img_path, plant_type, disease_label in collect_images():
        sensor = generate_row(plant_type, disease_label)
        rows.append({
            "image_path": img_path,
            "plant_type": plant_type,
            "disease_label": disease_label,
            **sensor,
        })
    return pd.DataFrame(rows)


def build_summary(df: pd.DataFrame) -> dict:
    """Build the dataset_summary.json contents."""
    # Class counts
    class_counts = df["final_condition_label"].value_counts().to_dict()

    # Mean NPK per condition
    mean_npk = (
        df.groupby("final_condition_label")[["N", "P", "K"]]
        .mean()
        .round(2)
        .to_dict(orient="index")
    )

    # Moisture distribution
    moisture_stats = {
        "mean": round(df["soil_moisture"].mean(), 2),
        "std": round(df["soil_moisture"].std(), 2),
        "min": round(df["soil_moisture"].min(), 2),
        "max": round(df["soil_moisture"].max(), 2),
        "quartiles": {
            "25%": round(df["soil_moisture"].quantile(0.25), 2),
            "50%": round(df["soil_moisture"].quantile(0.50), 2),
            "75%": round(df["soil_moisture"].quantile(0.75), 2),
        },
    }

    # Per-plant counts
    plant_counts = df["plant_type"].value_counts().to_dict()

    # Disease label counts
    disease_counts = df["disease_label"].value_counts().to_dict()

    return {
        "total_samples": len(df),
        "class_counts": class_counts,
        "plant_counts": plant_counts,
        "disease_label_counts": disease_counts,
        "mean_npk_per_condition": mean_npk,
        "moisture_distribution": moisture_stats,
    }


# ── Entrypoint ──────────────────────────────────────────────────────────────

def main():
    print("🌾 Multimodal Agriculture Dataset Generator")
    print(f"   Dataset root : {DATASET_DIR}")

    # 1. Build DataFrame
    df = build_dataset()
    print(f"   Total images found : {len(df)}")

    # 2. Quality checks
    assert df.isnull().sum().sum() == 0, "❌ Missing values detected!"
    assert df.duplicated().sum() == 0, "❌ Duplicate rows detected!"
    expected_cols = {
        "image_path", "plant_type", "disease_label",
        "N", "P", "K", "soil_moisture", "air_temperature", "humidity",
        "sin_time", "cos_time", "final_condition_label",
    }
    assert set(df.columns) == expected_cols, f"❌ Column mismatch: {set(df.columns)}"

    # 3. Save CSV
    df.to_csv(OUTPUT_CSV, index=False)
    print(f"   ✅ CSV saved  → {OUTPUT_CSV.name}  ({len(df)} rows)")

    # 4. Save summary
    summary = build_summary(df)
    with open(OUTPUT_JSON, "w") as f:
        json.dump(summary, f, indent=2)
    print(f"   ✅ JSON saved → {OUTPUT_JSON.name}")

    # 5. Quick report
    print("\n── Summary ──────────────────────────────────")
    print(f"   Condition distribution:")
    for cond, cnt in summary["class_counts"].items():
        print(f"      {cond:20s} : {cnt}")
    print(f"   Mean soil moisture : {summary['moisture_distribution']['mean']}%")
    print("──────────────────────────────────────────────\n")


if __name__ == "__main__":
    main()
