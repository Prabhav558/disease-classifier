"""
config.py — Central configuration for the multimodal crop disease classifier.
All hyperparameters, paths, and architecture constants live here.
"""

import os

# ── Paths ─────────────────────────────────────────────────────────────────────
PROJECT_ROOT   = os.path.dirname(os.path.abspath(__file__))
CSV_PATH       = os.path.join(PROJECT_ROOT, "agri_multimodal_dataset.csv")
# CSV image_path column stores e.g. "Crop___Disease/Corn/.../image.JPG"
# relative to the project root; the actual folder lives under data/
IMAGE_BASE_DIR = os.path.join(PROJECT_ROOT, "data")

# ── HuggingFace model ─────────────────────────────────────────────────────────
MODEL_NAME = "wambugu71/crop_leaf_diseases_vit"

# ── Target classes ────────────────────────────────────────────────────────────
# final_condition_label from the CSV — sorted alphabetically for determinism
NUM_CLASSES = 4
LABEL_NAMES = ["disease_stress", "healthy", "nutrient_stress", "water_stress"]

# ── ViT-Tiny architecture (confirmed: WinKawaks/vit-tiny-patch16-224) ─────────
VIT_HIDDEN_SIZE       = 192   # CLS token embedding dimension
VIT_NUM_LAYERS        = 12    # total transformer blocks
FREEZE_FIRST_N_LAYERS = 6     # freeze first 50% (layers 0-5)

# ── Sensor MLP dimensions ─────────────────────────────────────────────────────
# 8 numeric cols + 4 one-hot plant-type categories = 12 total input features
SENSOR_INPUT_DIM  = 12
SENSOR_HIDDEN_DIM = 64
SENSOR_OUTPUT_DIM = 64
# fusion dim = VIT_HIDDEN_SIZE + SENSOR_OUTPUT_DIM = 192 + 64 = 256
FUSION_DROPOUT    = 0.3

# ── Sensor feature columns (order is fixed — must match dataset output) ───────
NUMERIC_SENSOR_COLS   = [
    "N", "P", "K",
    "soil_moisture", "air_temperature", "humidity",
    "sin_time", "cos_time",
]
# PlantType one-hot categories — alphabetical order guarantees determinism
PLANT_TYPE_CATEGORIES = ["Corn", "Potato", "Rice", "Wheat"]

# ── Data split ────────────────────────────────────────────────────────────────
SEED      = 42
TEST_SIZE = 0.15   # 15% → temp; then temp is split 50/50 into val/test

# ── Training hyperparameters ──────────────────────────────────────────────────
OUTPUT_DIR    = "./results"
BATCH_SIZE    = 4
NUM_EPOCHS    = 5
LR            = 2e-4
WEIGHT_DECAY  = 0.01
LOGGING_STEPS = 20
EVAL_STEPS    = 200
