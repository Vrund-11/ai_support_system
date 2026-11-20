"""Classifier service with model inference, lazy loading, and rules fallback (AI-4)."""

import logging
from pathlib import Path
from typing import Any

import joblib

from src.classifier.rules import classify_by_rules
from src.classifier.schemas import (
    ClassifierFeedbackRequest,
    ClassifierFeedbackResponse,
    ClassifyResponse,
)

logger = logging.getLogger(__name__)

DEFAULT_MODEL_PATH = Path(__file__).resolve().parents[2] / "models" / "classifier-v1.0.0.joblib"


class ClassifierService:
    """Manages ML model lifecycle, fallback evaluation, and feedback tracking."""

    def __init__(self, model_path: Path | str | None = None) -> None:
        self.model_path = Path(model_path) if model_path else DEFAULT_MODEL_PATH
        self._model: Any = None
        self._model_loaded: bool = False
        self._feedback_records: list[dict[str, Any]] = []

    def load_model(self) -> bool:
        """Lazily loads the joblib model artifact if present."""
        if self._model_loaded:
            return self._model is not None

        if not self.model_path.exists():
            logger.warning(
                "Classifier model artifact not found at %s. Using rules fallback.",
                self.model_path,
            )
            self._model_loaded = True
            self._model = None
            return False

        try:
            self._model = joblib.load(self.model_path)
            self._model_loaded = True
            logger.info("Classifier model loaded successfully from %s", self.model_path)
            return True
        except Exception as exc:
            logger.error("Failed to load classifier model from %s: %s", self.model_path, exc)
            self._model = None
            self._model_loaded = True
            return False

    def classify(
        self,
        subject: str,
        description: str | None = None,
        first_message: str | None = None,
        tenant_id: str | None = None,
    ) -> ClassifyResponse:
        """Classifies ticket into priority and category.

        Uses trained ML pipeline if available; falls back to deterministic rules if
        the model artifact is missing or an error occurs.
        """
        text = f"{subject} {description or ''} {first_message or ''}".strip()
        if not text:
            text = "General inquiry"

        # Try ML Model
        if self.load_model() and self._model is not None:
            try:
                prios, cats = self._model.predict([text])
                prio_probs, cat_probs = self._model.predict_proba([text])

                predicted_prio = prios[0]
                predicted_cat = cats[0]

                # Composite confidence: geometric/harmonic mean of top class probabilities
                prio_conf = prio_probs.get(predicted_prio, 0.75)
                cat_conf = cat_probs.get(predicted_cat, 0.75)
                confidence = round(float((prio_conf + cat_conf) / 2.0), 2)

                combined_probs = {
                    **{f"priority_{k}": round(v, 4) for k, v in prio_probs.items()},
                    **{f"category_{k}": round(v, 4) for k, v in cat_probs.items()},
                }

                return ClassifyResponse(
                    priority=predicted_prio,
                    category=predicted_cat,
                    confidence=confidence,
                    provider="model",
                    probabilities=combined_probs,
                )
            except Exception as exc:
                logger.error("ML inference error (%s); failing over to rules fallback", exc)

        # Rules fallback
        rule_res = classify_by_rules(text)
        return ClassifyResponse(
            priority=rule_res.priority,
            category=rule_res.category,
            confidence=rule_res.confidence,
            provider="rules",
            probabilities=None,
        )

    def record_feedback(self, feedback: ClassifierFeedbackRequest) -> ClassifierFeedbackResponse:
        """Records agent corrections to measure drift and feed retraining datasets."""
        prio_match = feedback.predicted_priority == feedback.actual_priority
        cat_match = feedback.predicted_category == feedback.actual_category

        record = {
            "ticket_id": feedback.ticket_id,
            "predicted_priority": feedback.predicted_priority,
            "actual_priority": feedback.actual_priority,
            "predicted_category": feedback.predicted_category,
            "actual_category": feedback.actual_category,
            "priority_match": prio_match,
            "category_match": cat_match,
            "tenant_id": feedback.tenant_id,
            "agent_id": feedback.agent_id,
            "notes": feedback.notes,
        }
        self._feedback_records.append(record)
        logger.info(
            "Classifier feedback recorded for ticket %s: prio_match=%s, cat_match=%s",
            feedback.ticket_id,
            prio_match,
            cat_match,
        )

        return ClassifierFeedbackResponse(
            ticket_id=feedback.ticket_id,
            priority_match=prio_match,
            category_match=cat_match,
        )

    def get_feedback_records(self) -> list[dict[str, Any]]:
        return list(self._feedback_records)


_global_classifier_service: ClassifierService | None = None


def get_classifier_service() -> ClassifierService:
    global _global_classifier_service
    if _global_classifier_service is None:
        _global_classifier_service = ClassifierService()
    return _global_classifier_service
