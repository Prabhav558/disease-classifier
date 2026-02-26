"""
train.py — Training entry-point for the multimodal crop disease classifier.

Wires together:
  - AutoImageProcessor  (image pre-processing from the pretrained ViT)
  - build_datasets()    (CSV → train / val / test splits + fitted scaler)
  - MultimodalViT       (ViT-Tiny backbone + sensor MLP + fusion head)
  - MultimodalCollator  (batches pixel_values, sensor_features, labels)
  - HuggingFace Trainer (unchanged training loop)
"""

import numpy as np
import evaluate
from transformers import AutoImageProcessor, TrainingArguments, Trainer

from config import (
    BATCH_SIZE,
    EVAL_STEPS,
    LR,
    LOGGING_STEPS,
    MODEL_NAME,
    NUM_EPOCHS,
    OUTPUT_DIR,
    WEIGHT_DECAY,
)
from dataset import build_datasets, MultimodalCollator
from model import MultimodalViT


# ── 1. Image processor ────────────────────────────────────────────────────────
processor = AutoImageProcessor.from_pretrained(MODEL_NAME)

# ── 2. Datasets  (scaler is fitted inside build_datasets on train split only) ──
train_ds, val_ds, test_ds, _ = build_datasets(processor)

# ── 3. Model ──────────────────────────────────────────────────────────────────
model = MultimodalViT()

# ── 4. Metrics ────────────────────────────────────────────────────────────────
accuracy_metric = evaluate.load("accuracy")

def compute_metrics(eval_pred):
    logits, labels = eval_pred
    predictions = np.argmax(logits, axis=-1)
    return accuracy_metric.compute(predictions=predictions, references=labels)

# ── 5. Training arguments ─────────────────────────────────────────────────────
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

# ── 6. Trainer ────────────────────────────────────────────────────────────────
trainer = Trainer(
    model=model,
    args=training_args,
    train_dataset=train_ds,
    eval_dataset=val_ds,
    data_collator=MultimodalCollator(),
    compute_metrics=compute_metrics,
)

# ── 7. Train ──────────────────────────────────────────────────────────────────
trainer.train()

# ── 8. Final evaluation on held-out test set ─────────────────────────────────
test_results = trainer.evaluate(eval_dataset=test_ds)
print("\nTest set results:", test_results)
