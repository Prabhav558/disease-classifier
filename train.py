"""
train.py — Training entry-point for the multimodal crop disease classifier.

Wires together:
  - AutoImageProcessor  (image pre-processing from the pretrained ViT)
  - build_datasets()    (CSV → train / val / test splits + fitted scaler)
  - MultimodalViT       (ViT-Tiny backbone + sensor MLP + fusion head)
  - MultimodalCollator  (batches pixel_values, sensor_features, labels)
  - HuggingFace Trainer (unchanged training loop)

Improvements over original:
  - Computes inverse-frequency class weights to handle dataset imbalance
  - Saves the fitted StandardScaler to disk (results/scaler.pkl) so inference
    never needs to rebuild it from the CSV
"""

import pickle

import numpy as np
import torch
import evaluate
from transformers import AutoImageProcessor, TrainingArguments, Trainer

from config import (
    BATCH_SIZE,
    EVAL_STEPS,
    LABEL_NAMES,
    LR,
    LOGGING_STEPS,
    MODEL_NAME,
    NUM_EPOCHS,
    OUTPUT_DIR,
    WEIGHT_DECAY,
)
from dataset import build_datasets, MultimodalCollator
from model import MultimodalViT

import os

# ── 1. Image processor ────────────────────────────────────────────────────────
processor = AutoImageProcessor.from_pretrained(MODEL_NAME)

# ── 2. Datasets  (scaler is fitted inside build_datasets on train split only) ──
train_ds, val_ds, test_ds, scaler = build_datasets(processor)

# ── 3. Save scaler to disk (used by inference at runtime) ────────────────────
scaler_path = os.path.join(OUTPUT_DIR, "scaler.pkl")
os.makedirs(OUTPUT_DIR, exist_ok=True)
with open(scaler_path, "wb") as f:
    pickle.dump(scaler, f)
print(f"Scaler saved → {scaler_path}")

# ── 4. Compute inverse-frequency class weights ────────────────────────────────
label_to_idx = {name: i for i, name in enumerate(LABEL_NAMES)}
labels_array = np.array([label_to_idx[row["final_condition_label"]]
                         for _, row in train_ds.df.iterrows()])
class_counts = np.bincount(labels_array, minlength=len(LABEL_NAMES)).astype(float)
class_weights = torch.tensor(1.0 / (class_counts / class_counts.sum()), dtype=torch.float32)
class_weights = class_weights / class_weights.sum() * len(LABEL_NAMES)  # normalise
print(f"Class weights: { {LABEL_NAMES[i]: round(class_weights[i].item(), 3) for i in range(len(LABEL_NAMES))} }")

# ── 5. Model ──────────────────────────────────────────────────────────────────
model = MultimodalViT(class_weights=class_weights)

# ── 6. Metrics ────────────────────────────────────────────────────────────────
accuracy_metric = evaluate.load("accuracy")

def compute_metrics(eval_pred):
    logits, labels = eval_pred
    predictions = np.argmax(logits, axis=-1)
    return accuracy_metric.compute(predictions=predictions, references=labels)

# ── 7. Training arguments ─────────────────────────────────────────────────────
training_args = TrainingArguments(
    output_dir=OUTPUT_DIR,
    per_device_train_batch_size=BATCH_SIZE,
    per_device_eval_batch_size=BATCH_SIZE,
    num_train_epochs=NUM_EPOCHS,
    learning_rate=LR,
    weight_decay=WEIGHT_DECAY,
    logging_steps=LOGGING_STEPS,
    eval_steps=EVAL_STEPS,
    save_steps=EVAL_STEPS,
    eval_strategy="steps",
    save_strategy="steps",
    load_best_model_at_end=True,
    metric_for_best_model="accuracy",
    # CRITICAL: prevents Trainer from dropping sensor_features before collation
    remove_unused_columns=False,
    # Enforce float32 throughout (required by constraints)
    fp16=False,
    bf16=False,
    # Windows: fork-based DataLoader workers cause deadlocks; use main process
    dataloader_num_workers=0,
    seed=42,
)

# ── 8. Trainer ────────────────────────────────────────────────────────────────
trainer = Trainer(
    model=model,
    args=training_args,
    train_dataset=train_ds,
    eval_dataset=val_ds,
    data_collator=MultimodalCollator(),
    compute_metrics=compute_metrics,
)

# ── 9. Train ──────────────────────────────────────────────────────────────────
trainer.train()

# ── 10. Final evaluation on held-out test set ─────────────────────────────────
test_results = trainer.evaluate(eval_dataset=test_ds)
print("\nTest set results:", test_results)

# ── 11. Print best checkpoint path (update .env CHECKPOINT_PATH after training) ─
print(f"\nBest model checkpoint: {trainer.state.best_model_checkpoint}")
print("Update .env CHECKPOINT_PATH to point to the best checkpoint above.")
