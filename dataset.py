"""
dataset.py — Multimodal dataset for crop disease classification.

Provides:
  - MultimodalCropDataset  : torch Dataset returning pixel_values + sensor_features + labels
  - MultimodalCollator     : batches dicts of tensors for HuggingFace Trainer
  - build_datasets()       : factory that reads the CSV, splits, fits the scaler, and
                             returns (train_ds, val_ds, test_ds, scaler)
"""

import os

import numpy as np
import pandas as pd
import torch
from PIL import Image
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from torch.utils.data import Dataset

from config import (
    CSV_PATH,
    IMAGE_BASE_DIR,
    LABEL_NAMES,
    NUMERIC_SENSOR_COLS,
    PLANT_TYPE_CATEGORIES,
    SEED,
    TEST_SIZE,
)


# ── Dataset ───────────────────────────────────────────────────────────────────

class MultimodalCropDataset(Dataset):
    """
    Each sample returns:
        pixel_values    : FloatTensor (3, 224, 224)
        sensor_features : FloatTensor (12,)   — scaled, includes one-hot plant type
        labels          : LongTensor  scalar

    Args:
        df        : DataFrame slice for this split (reset_index is applied internally)
        processor : AutoImageProcessor instance (shared across splits)
        scaler    : StandardScaler already fitted on training data
    """

    def __init__(self, df: pd.DataFrame, processor, scaler: StandardScaler) -> None:
        self.df        = df.reset_index(drop=True)
        self.processor = processor

        # ── Build sensor feature matrix once (avoid per-sample Python overhead) ──
        numeric = self.df[NUMERIC_SENSOR_COLS].values.astype(np.float32)  # (N, 8)

        # One-hot encode plant_type; reindex guarantees all 4 columns exist
        # even if a split happens to be missing a category.
        one_hot = (
            pd.get_dummies(self.df["plant_type"], prefix="plant_type")
            .reindex(
                columns=[f"plant_type_{c}" for c in PLANT_TYPE_CATEGORIES],
                fill_value=0,
            )
            .values.astype(np.float32)                                    # (N, 4)
        )

        raw_features = np.concatenate([numeric, one_hot], axis=1)        # (N, 12)
        self.sensor_matrix = scaler.transform(raw_features).astype(np.float32)

        # ── Integer labels ────────────────────────────────────────────────────
        label_to_idx   = {name: i for i, name in enumerate(LABEL_NAMES)}
        mapped         = self.df["final_condition_label"].map(label_to_idx)
        assert mapped.isna().sum() == 0, (
            f"Unknown final_condition_label values: "
            f"{self.df['final_condition_label'][mapped.isna()].unique()}"
        )
        self.labels = mapped.values.astype(np.int64)

    def __len__(self) -> int:
        return len(self.df)

    def __getitem__(self, idx: int) -> dict:
        row = self.df.iloc[idx]

        # ── Image ─────────────────────────────────────────────────────────────
        img_path = os.path.join(IMAGE_BASE_DIR, row["image_path"])
        try:
            image = Image.open(img_path).convert("RGB")
        except (FileNotFoundError, OSError) as exc:
            raise RuntimeError(
                f"Cannot load image at index {idx}: {img_path}"
            ) from exc

        pixel_values = (
            self.processor(images=image, return_tensors="pt")["pixel_values"][0]
            .float()
        )  # (3, 224, 224)  float32

        # ── Sensor features ───────────────────────────────────────────────────
        sensor_features = torch.from_numpy(self.sensor_matrix[idx]).float()  # (12,)

        # ── Label ─────────────────────────────────────────────────────────────
        label = torch.tensor(int(self.labels[idx]), dtype=torch.long)

        return {
            "pixel_values":    pixel_values,
            "sensor_features": sensor_features,
            "labels":          label,
        }


# ── Collator ──────────────────────────────────────────────────────────────────

class MultimodalCollator:
    """
    Stacks a list of per-sample dicts into batched tensors.

    HuggingFace's default_data_collator would also stack tensors, but the Trainer's
    _remove_unused_columns pass could silently drop 'sensor_features' (because it is
    not in the original ViT forward signature). Using an explicit collator combined
    with remove_unused_columns=False in TrainingArguments prevents this.
    """

    def __call__(self, features: list) -> dict:
        return {
            "pixel_values":    torch.stack([f["pixel_values"]    for f in features]),
            "sensor_features": torch.stack([f["sensor_features"] for f in features]),
            "labels":          torch.stack([f["labels"]          for f in features]),
        }


# ── Factory ───────────────────────────────────────────────────────────────────

def build_datasets(processor) -> tuple:
    """
    Read the CSV, reproduce the original train/val/test split, fit a StandardScaler
    on training data only, and return ready-to-use Dataset objects.

    Returns:
        (train_ds, val_ds, test_ds, scaler)
    """
    df = pd.read_csv(CSV_PATH)

    # Sanity checks
    assert df[NUMERIC_SENSOR_COLS].isna().sum().sum() == 0, \
        "NaN values found in numeric sensor columns"
    assert df["plant_type"].isna().sum() == 0, \
        "NaN values found in plant_type column"
    assert df["final_condition_label"].isna().sum() == 0, \
        "NaN values found in final_condition_label column"

    # ── Split: reproduce the original train.py 85% / 7.5% / 7.5% ────────────
    train_df, temp_df = train_test_split(df,      test_size=TEST_SIZE, random_state=SEED)
    val_df,  test_df  = train_test_split(temp_df, test_size=0.50,      random_state=SEED)

    # ── Fit scaler on TRAIN only ──────────────────────────────────────────────
    numeric_train = train_df[NUMERIC_SENSOR_COLS].values.astype(np.float32)
    one_hot_train = (
        pd.get_dummies(train_df["plant_type"], prefix="plant_type")
        .reindex(
            columns=[f"plant_type_{c}" for c in PLANT_TYPE_CATEGORIES],
            fill_value=0,
        )
        .values.astype(np.float32)
    )
    raw_train = np.concatenate([numeric_train, one_hot_train], axis=1)  # (N_train, 12)

    scaler = StandardScaler()
    scaler.fit(raw_train)   # ← ONLY call to .fit(); val/test use .transform() only

    # ── Build Dataset objects ─────────────────────────────────────────────────
    train_ds = MultimodalCropDataset(train_df, processor, scaler)
    val_ds   = MultimodalCropDataset(val_df,   processor, scaler)
    test_ds  = MultimodalCropDataset(test_df,  processor, scaler)

    print(
        f"Dataset splits — train: {len(train_ds)}  "
        f"val: {len(val_ds)}  test: {len(test_ds)}"
    )
    return train_ds, val_ds, test_ds, scaler
