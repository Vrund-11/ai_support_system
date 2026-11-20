"""SupportPilot Agent Assist module (AI-5, AI-6)."""

from src.assist.schemas import (
    AssistMessageItem,
    SuggestReplyRequest,
    SuggestReplyResponse,
    SummarizeRequest,
    SummarizeResponse,
)
from src.assist.service import AgentAssistService, get_agent_assist_service

__all__ = [
    "AgentAssistService",
    "AssistMessageItem",
    "SuggestReplyRequest",
    "SuggestReplyResponse",
    "SummarizeRequest",
    "SummarizeResponse",
    "get_agent_assist_service",
]
