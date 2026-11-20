"""SupportPilot Classifier module (AI-4)."""

from src.classifier.schemas import (
    ClassifierFeedbackRequest,
    ClassifierFeedbackResponse,
    ClassifyRequest,
    ClassifyResponse,
)
from src.classifier.service import ClassifierService, get_classifier_service

__all__ = [
    "ClassifierFeedbackRequest",
    "ClassifierFeedbackResponse",
    "ClassifierService",
    "ClassifyRequest",
    "ClassifyResponse",
    "get_classifier_service",
]
