"""
visualize.py — IEEE-quality figures for the MultimodalViT model.

Produces three publication-ready plots saved to results/plots/:
  training_accuracy.png  — Training loss + Val accuracy vs step
  performance_matrix.png — Per-class Precision / Recall / F1 grouped bar chart
  confusion_matrix.png   — Normalised confusion-matrix heatmap

IEEE two-column format:
  • Single-column figure  : 3.5 in wide
  • Double-column figure  : 7.16 in wide  (used for confusion matrix)
  • Export DPI            : 300
  • Font                  : Times New Roman (falls back to DejaVu Serif)
  • All text in pt sizes that match a 10 pt body

Usage:
    agri_ai\\Scripts\\python.exe visualize.py
"""

import inspect
import json
import os
import sys
import warnings
warnings.filterwarnings("ignore")

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import matplotlib.ticker as ticker
import numpy as np
import seaborn as sns
from sklearn.metrics import classification_report, confusion_matrix

# ── Project root on sys.path ───────────────────────────────────────────────────
_THIS_DIR = os.path.dirname(os.path.abspath(__file__))
if _THIS_DIR not in sys.path:
    sys.path.insert(0, _THIS_DIR)

from config import LABEL_NAMES, MODEL_NAME, OUTPUT_DIR

PLOTS_DIR = os.path.join(OUTPUT_DIR, "plots")
os.makedirs(PLOTS_DIR, exist_ok=True)

# ── IEEE-style matplotlib defaults ────────────────────────────────────────────
_FONT_FAMILY = "Times New Roman"

plt.rcParams.update({
    # Font
    "font.family"        : "serif",
    "font.serif"         : [_FONT_FAMILY, "DejaVu Serif", "Georgia"],
    "font.size"          : 9,
    "axes.titlesize"     : 10,
    "axes.labelsize"     : 9,
    "xtick.labelsize"    : 8,
    "ytick.labelsize"    : 8,
    "legend.fontsize"    : 8,
    # Lines & markers
    "lines.linewidth"    : 1.5,
    "lines.markersize"   : 4,
    # Axes
    "axes.linewidth"     : 0.8,
    "axes.grid"          : True,
    "grid.linestyle"     : "--",
    "grid.linewidth"     : 0.4,
    "grid.alpha"         : 0.5,
    "axes.spines.top"    : False,
    "axes.spines.right"  : False,
    # Ticks
    "xtick.direction"    : "in",
    "ytick.direction"    : "in",
    "xtick.major.size"   : 3,
    "ytick.major.size"   : 3,
    # Figure
    "figure.dpi"         : 150,      # screen preview
    "savefig.dpi"        : 300,      # print-quality export
    "figure.facecolor"   : "white",
    "axes.facecolor"     : "white",
    # Legend
    "legend.framealpha"  : 0.9,
    "legend.edgecolor"   : "#cccccc",
})

# IEEE column widths (inches)
_SINGLE_COL = 3.5
_DOUBLE_COL = 7.16

# Colour palette (IEEE-friendly: distinguishable in greyscale too)
_BLUE   = "#1f77b4"
_ORANGE = "#d62728"
_GREEN  = "#2ca02c"
_GREY   = "#555555"

# ── Helper: load trainer_state.json from the highest-step checkpoint ──────────

def _load_log_history(output_dir: str) -> list:
    ckpts = [
        os.path.join(output_dir, d)
        for d in os.listdir(output_dir)
        if d.startswith("checkpoint-") and os.path.isdir(os.path.join(output_dir, d))
    ]
    if not ckpts:
        raise FileNotFoundError(f"No checkpoints found in '{output_dir}'.")
    best = max(ckpts, key=lambda p: int(os.path.basename(p).split("-")[1]))
    with open(os.path.join(best, "trainer_state.json")) as f:
        return json.load(f)["log_history"]


# ═══════════════════════════════════════════════════════════════════════════════
# 1.  Training Curves
# ═══════════════════════════════════════════════════════════════════════════════

def plot_training_curves(log_history: list, save_path: str) -> None:
    """Double-column figure: (left) training loss, (right) validation accuracy."""

    train_steps, train_loss = [], []
    eval_steps,  eval_acc   = [], []

    for e in log_history:
        if "loss" in e:
            train_steps.append(e["step"])
            train_loss.append(e["loss"])
        if "eval_accuracy" in e:
            eval_steps.append(e["step"])
            eval_acc.append(e["eval_accuracy"] * 100)

    fig, (ax_loss, ax_acc) = plt.subplots(
        1, 2,
        figsize=(_DOUBLE_COL, 2.6),
        constrained_layout=True,
    )

    # ── Left: Training Loss ──────────────────────────────────────────────────
    ax_loss.plot(train_steps, train_loss, color=_BLUE, label="Training Loss", zorder=3)
    ax_loss.set_xlabel("Training Step")
    ax_loss.set_ylabel("Cross-Entropy Loss")
    ax_loss.set_title("(a) Training Loss")
    ax_loss.legend()

    # ── Right: Validation Accuracy ───────────────────────────────────────────
    if eval_acc:
        ax_acc.plot(
            eval_steps, eval_acc,
            color=_ORANGE, marker="o", markersize=4,
            label="Validation Accuracy", zorder=3
        )
        best_i = int(np.argmax(eval_acc))
        ax_acc.annotate(
            f"Best: {eval_acc[best_i]:.2f}%",
            xy=(eval_steps[best_i], eval_acc[best_i]),
            xytext=(8, -14), textcoords="offset points",
            fontsize=7.5, color=_ORANGE,
            arrowprops=dict(arrowstyle="->", color=_ORANGE, lw=0.9),
        )
    ax_acc.set_xlabel("Training Step")
    ax_acc.set_ylabel("Accuracy (%)")
    ax_acc.set_title("(b) Validation Accuracy")
    ax_acc.yaxis.set_major_formatter(ticker.FormatStrFormatter("%.0f%%"))
    ax_acc.legend()

    fig.savefig(save_path, bbox_inches="tight")
    plt.close(fig)
    print(f"  ✓ {save_path}")


# ═══════════════════════════════════════════════════════════════════════════════
# 2.  Per-Class Performance Matrix
# ═══════════════════════════════════════════════════════════════════════════════

def plot_performance_matrix(
    y_true: list, y_pred: list, class_names: list, save_path: str
) -> None:
    """Single-column grouped bar chart: Precision / Recall / F1 per class."""
    report = classification_report(
        y_true, y_pred, target_names=class_names, output_dict=True
    )

    metrics = ["precision", "recall", "f1-score"]
    colors  = [_BLUE, _ORANGE, _GREEN]
    x       = np.arange(len(class_names))
    w       = 0.22

    fig, ax = plt.subplots(figsize=(_DOUBLE_COL, 3.0), constrained_layout=True)

    for i, (m, c) in enumerate(zip(metrics, colors)):
        vals = [report[cls][m] * 100 for cls in class_names]
        bars = ax.bar(x + i * w, vals, w, label=m.capitalize(), color=c, zorder=3)
        for bar, v in zip(bars, vals):
            ax.text(
                bar.get_x() + bar.get_width() / 2,
                bar.get_height() + 0.6,
                f"{v:.1f}",
                ha="center", va="bottom", fontsize=7,
            )

    ax.set_xticks(x + w)
    ax.set_xticklabels(
        [n.replace("_", "\n") for n in class_names], fontsize=8
    )
    ax.set_yticks(range(0, 105, 10))
    ax.yaxis.set_major_formatter(ticker.FormatStrFormatter("%d%%"))
    ax.set_ylim(0, 112)
    ax.set_xlabel("Class")
    ax.set_ylabel("Score (%)")
    ax.set_title("Per-Class Precision, Recall, and F1-Score")
    ax.legend(loc="lower right")

    # Macro averages footnote
    mac = report["macro avg"]
    footnote = (
        f"Macro Avg — Precision: {mac['precision']*100:.1f}%  "
        f"Recall: {mac['recall']*100:.1f}%  "
        f"F1: {mac['f1-score']*100:.1f}%"
    )
    fig.text(
        0.5, -0.04, footnote,
        ha="center", fontsize=7.5, color=_GREY,
        style="italic"
    )

    fig.savefig(save_path, bbox_inches="tight")
    plt.close(fig)
    print(f"  ✓ {save_path}")


# ═══════════════════════════════════════════════════════════════════════════════
# 3.  Confusion Matrix
# ═══════════════════════════════════════════════════════════════════════════════

def plot_confusion_matrix(
    y_true: list, y_pred: list, class_names: list, save_path: str
) -> None:
    """Single-column normalised confusion matrix — clean, IEEE-ready."""
    cm = confusion_matrix(y_true, y_pred, normalize="true") * 100

    short_labels = [n.replace("_", "\n") for n in class_names]

    fig, ax = plt.subplots(figsize=(_SINGLE_COL + 0.6, 3.2), constrained_layout=True)

    im = ax.imshow(cm, cmap="Blues", vmin=0, vmax=100)

    # White gridlines between cells
    ax.set_xticks(np.arange(len(class_names) + 1) - 0.5, minor=True)
    ax.set_yticks(np.arange(len(class_names) + 1) - 0.5, minor=True)
    ax.grid(which="minor", color="white", linewidth=1.5)
    ax.tick_params(which="minor", bottom=False, left=False)
    ax.grid(which="major", visible=False)

    # Axis labels
    ax.set_xticks(range(len(class_names)))
    ax.set_yticks(range(len(class_names)))
    ax.set_xticklabels(short_labels, fontsize=7.5)
    ax.set_yticklabels(short_labels, fontsize=7.5)
    ax.set_xlabel("Predicted Label")
    ax.set_ylabel("True Label")
    ax.set_title("Confusion Matrix (Normalised, %)")

    # Annotate cells
    thresh = cm.max() / 2.0
    for i in range(len(class_names)):
        for j in range(len(class_names)):
            ax.text(
                j, i, f"{cm[i, j]:.1f}%",
                ha="center", va="center", fontsize=8,
                color="white" if cm[i, j] > thresh else "black",
                fontweight="bold" if i == j else "normal",
            )

    # Colorbar
    cbar = fig.colorbar(im, ax=ax, fraction=0.046, pad=0.04)
    cbar.set_label("% of True Class", fontsize=8)
    cbar.ax.tick_params(labelsize=7)

    fig.savefig(save_path, bbox_inches="tight")
    plt.close(fig)
    print(f"  ✓ {save_path}")


# ═══════════════════════════════════════════════════════════════════════════════
# Inference on test set
# ═══════════════════════════════════════════════════════════════════════════════

def get_test_predictions():
    import torch
    from transformers import AutoImageProcessor, Trainer, TrainingArguments
    from dataset import build_datasets, MultimodalCollator
    from model import MultimodalViT
    from safetensors.torch import load_file as load_safetensors

    print("  Loading image processor …")
    processor = AutoImageProcessor.from_pretrained(MODEL_NAME)

    print("  Building test dataset …")
    _, _, test_ds, _ = build_datasets(processor)

    # Find last checkpoint
    ckpts = [
        os.path.join(OUTPUT_DIR, d)
        for d in os.listdir(OUTPUT_DIR)
        if d.startswith("checkpoint-") and os.path.isdir(os.path.join(OUTPUT_DIR, d))
    ]
    best_ckpt = max(ckpts, key=lambda p: int(os.path.basename(p).split("-")[1]))
    print(f"  Using checkpoint: {os.path.basename(best_ckpt)}")

    model = MultimodalViT()
    w_path = os.path.join(best_ckpt, "model.safetensors")
    if os.path.exists(w_path):
        sd = load_safetensors(w_path)
    else:
        sd = torch.load(
            os.path.join(best_ckpt, "pytorch_model.bin"), map_location="cpu"
        )
    model.load_state_dict(sd, strict=False)
    model.eval()

    # Build TrainingArguments, handling deprecated no_cuda vs use_cpu
    targs = dict(
        output_dir="./results/visualize_tmp",
        per_device_eval_batch_size=8,
        remove_unused_columns=False,
        fp16=False,
        bf16=False,
        dataloader_num_workers=0,
        seed=42,
    )
    if "use_cpu" in inspect.signature(TrainingArguments.__init__).parameters:
        targs["use_cpu"] = not torch.cuda.is_available()
    else:
        targs["no_cuda"] = not torch.cuda.is_available()

    trainer = Trainer(
        model=model,
        args=TrainingArguments(**targs),
        data_collator=MultimodalCollator(),
    )

    print("  Running inference …")
    out = trainer.predict(test_ds)
    y_true = out.label_ids
    y_pred = np.argmax(out.predictions, axis=-1)
    acc = (y_true == y_pred).mean() * 100
    print(f"  Test accuracy: {acc:.2f}%")
    return y_true.tolist(), y_pred.tolist()


# ═══════════════════════════════════════════════════════════════════════════════
# Main
# ═══════════════════════════════════════════════════════════════════════════════

if __name__ == "__main__":
    print("=" * 60)
    print("  MultimodalViT — IEEE Publication Figures")
    print("=" * 60)

    # 1. Training curves (from trainer_state.json — no GPU needed)
    print("\n[1/3] Training curves …")
    log_history = _load_log_history(OUTPUT_DIR)
    plot_training_curves(
        log_history,
        save_path=os.path.join(PLOTS_DIR, "training_accuracy.png"),
    )

    # 2 & 3. Need test-set predictions
    print("\n[2/3] Generating test-set predictions …")
    y_true, y_pred = get_test_predictions()

    print("\n[3/3] Performance matrix …")
    plot_performance_matrix(
        y_true, y_pred, LABEL_NAMES,
        save_path=os.path.join(PLOTS_DIR, "performance_matrix.png"),
    )

    print("\n[4/4] Confusion matrix …")
    plot_confusion_matrix(
        y_true, y_pred, LABEL_NAMES,
        save_path=os.path.join(PLOTS_DIR, "confusion_matrix.png"),
    )

    print(f"\n✅  All plots saved to: {PLOTS_DIR}")
    print("    training_accuracy.png")
    print("    performance_matrix.png")
    print("    confusion_matrix.png")
    print("\nTip: set savefig.dpi = 600 in rcParams for camera-ready submission.")
