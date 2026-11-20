"""Model wrapper class for SupportPilot Ticket Classifier (AI-4)."""

from typing import Any

from sklearn.pipeline import Pipeline


class SupportPilotTicketModel:
    """Wrapper holding separate priority and category pipelines for multi-target prediction."""

    def __init__(
        self, priority_pipeline: Pipeline, category_pipeline: Pipeline, metadata: dict[str, Any]
    ):
        self.priority_pipeline = priority_pipeline
        self.category_pipeline = category_pipeline
        self.metadata = metadata

    def predict(self, texts: list[str]) -> tuple[list[str], list[str]]:
        prios = self.priority_pipeline.predict(texts)
        cats = self.category_pipeline.predict(texts)
        return list(prios), list(cats)

    def predict_proba(self, texts: list[str]) -> tuple[dict[str, float], dict[str, float]]:
        prio_probs = {}
        cat_probs = {}
        if hasattr(self.priority_pipeline, "predict_proba"):
            p_probs = self.priority_pipeline.predict_proba(texts)[0]
            classes = self.priority_pipeline.classes_
            prio_probs = {c: float(p) for c, p in zip(classes, p_probs, strict=False)}

        if hasattr(self.category_pipeline, "predict_proba"):
            c_probs = self.category_pipeline.predict_proba(texts)[0]
            classes = self.category_pipeline.classes_
            cat_probs = {c: float(p) for c, p in zip(classes, c_probs, strict=False)}

        return prio_probs, cat_probs
