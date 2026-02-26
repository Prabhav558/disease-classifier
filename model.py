"""
model.py — MultimodalViT: fuses ViT-Tiny image features with sensor MLP embeddings.

Architecture:
    pixel_values (B,3,224,224) → ViT-Tiny backbone → CLS token (B,192)  ──┐
                                                                             cat (B,256) → classifier → logits (B,4)
    sensor_features (B,12)     → Sensor MLP        → embedding (B,64)   ──┘

    Sensor MLP   : Linear(12→64) → ReLU → Linear(64→64)
    Classifier   : Linear(256→128) → ReLU → Dropout(0.3) → Linear(128→4)

The ViT backbone is loaded from the pretrained checkpoint; its original
classification head is discarded. The first 50% of transformer layers (0-5)
and the patch/position embeddings are frozen.
"""

import torch
import torch.nn as nn
from transformers import AutoModelForImageClassification
from transformers.modeling_outputs import ImageClassifierOutput

from config import (
    FREEZE_FIRST_N_LAYERS,
    FUSION_DROPOUT,
    MODEL_NAME,
    NUM_CLASSES,
    SENSOR_HIDDEN_DIM,
    SENSOR_INPUT_DIM,
    SENSOR_OUTPUT_DIM,
    VIT_HIDDEN_SIZE,
    VIT_NUM_LAYERS,
)


class MultimodalViT(nn.Module):
    """
    Multimodal classifier combining ViT-Tiny image features and sensor MLP features.

    Args:
        num_classes : number of output classes (default from config: 4)
    """

    def __init__(self, num_classes: int = NUM_CLASSES) -> None:
        super().__init__()
        self._build_vit_backbone()
        self._freeze_vit_layers()
        self._build_sensor_encoder()
        self._build_classifier_head(num_classes)

    # ── Sub-builders ──────────────────────────────────────────────────────────

    def _build_vit_backbone(self) -> None:
        """Load pretrained ViT, extract the backbone, discard the original head."""
        full_model = AutoModelForImageClassification.from_pretrained(
            MODEL_NAME,
            num_labels=NUM_CLASSES,
            ignore_mismatched_sizes=True,
        )
        # full_model.vit is ViTModel(add_pooling_layer=False)
        # Its forward returns last_hidden_state[:, 0, :] as the CLS token
        self.vit = full_model.vit
        del full_model  # free the old 13-class head from memory

    def _freeze_vit_layers(self) -> None:
        """Freeze patch/position embeddings and the first 50% of transformer layers."""
        assert len(self.vit.encoder.layer) == VIT_NUM_LAYERS, (
            f"Expected {VIT_NUM_LAYERS} ViT layers, "
            f"got {len(self.vit.encoder.layer)}"
        )

        # Freeze patch embedding and positional embeddings
        for param in self.vit.embeddings.parameters():
            param.requires_grad = False

        # Freeze layers 0 .. FREEZE_FIRST_N_LAYERS-1  (= 0-5 for 50% of 12)
        for i, layer in enumerate(self.vit.encoder.layer):
            if i < FREEZE_FIRST_N_LAYERS:
                for param in layer.parameters():
                    param.requires_grad = False
        # Layers 6-11, vit.layernorm, sensor_encoder, classifier remain trainable

        trainable = sum(p.numel() for p in self.parameters() if p.requires_grad)
        total     = sum(p.numel() for p in self.parameters())
        print(
            f"MultimodalViT — trainable params: {trainable:,} / {total:,} "
            f"({100 * trainable / total:.1f}%)"
        )

    def _build_sensor_encoder(self) -> None:
        """Small MLP to encode the 12-dimensional sensor feature vector."""
        self.sensor_encoder = nn.Sequential(
            nn.Linear(SENSOR_INPUT_DIM,  SENSOR_HIDDEN_DIM),   # 12 → 64
            nn.ReLU(),
            nn.Linear(SENSOR_HIDDEN_DIM, SENSOR_OUTPUT_DIM),   # 64 → 64
        )

    def _build_classifier_head(self, num_classes: int) -> None:
        """Two-layer classifier on the concatenated [CLS + sensor] representation."""
        fusion_dim = VIT_HIDDEN_SIZE + SENSOR_OUTPUT_DIM        # 192 + 64 = 256
        self.classifier = nn.Sequential(
            nn.Linear(fusion_dim, fusion_dim // 2),             # 256 → 128
            nn.ReLU(),
            nn.Dropout(p=FUSION_DROPOUT),                       # 0.3
            nn.Linear(fusion_dim // 2, num_classes),            # 128 → 4
        )

    # ── Forward ───────────────────────────────────────────────────────────────

    def forward(
        self,
        pixel_values:    torch.FloatTensor,               # (B, 3, 224, 224)
        sensor_features: torch.FloatTensor,               # (B, 12)
        labels:          torch.LongTensor | None = None,  # (B,)
        **kwargs,  # absorbs Trainer-injected kwargs (e.g. num_items_in_batch)
    ) -> ImageClassifierOutput:
        """
        HuggingFace Trainer compatible forward pass.

        When `labels` is provided the cross-entropy loss is computed and
        returned in the output object. The Trainer reads output.loss for
        backprop and output.logits for evaluation metrics.
        """
        # 1. ViT backbone — extract the CLS token
        vit_out       = self.vit(pixel_values=pixel_values.float())
        cls_embedding = vit_out.last_hidden_state[:, 0, :]       # (B, 192)

        # 2. Sensor MLP
        sensor_embedding = self.sensor_encoder(sensor_features.float())  # (B, 64)

        # 3. Fuse and classify
        fused  = torch.cat([cls_embedding, sensor_embedding], dim=-1)    # (B, 256)
        logits = self.classifier(fused)                                   # (B, 4)

        # 4. Compute loss when labels are available
        loss = None
        if labels is not None:
            loss = nn.CrossEntropyLoss()(logits, labels)

        return ImageClassifierOutput(loss=loss, logits=logits)
