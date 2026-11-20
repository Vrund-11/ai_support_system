"""Mock LLM Provider for hermetic testing, development, and CI.

Provides deterministic responses, schema-valid JSON generation, and
unit-normalized 384-dimensional embeddings without paid API calls.
"""

import hashlib
import math
from typing import TypeVar

from pydantic import BaseModel

from src.providers.base import LLMProvider
from src.schemas.llm import CitationItem, RagAnswer

T = TypeVar("T", bound=BaseModel)


class MockLLMProvider(LLMProvider):
    """Hermetic mock LLM provider with configurable response modes."""

    name: str = "mock"

    def __init__(self, embedding_dim: int = 384) -> None:
        self.embedding_dim = embedding_dim
        # Test configuration overrides
        self.simulate_malformed_json = False
        self.simulate_low_confidence = False
        self.simulate_should_escalate = False
        self.custom_answer: str | None = None
        self.custom_citations: list[CitationItem] | None = None

    async def generate_text(
        self,
        system_prompt: str,
        user_prompt: str,
        temperature: float = 0.2,
    ) -> str:
        if self.custom_answer is not None:
            return self.custom_answer
        return (
            f"Mock response for inquiry: '{user_prompt[:60]}...'. "
            "Our team is happy to assist you with SupportPilot."
        )

    async def generate_json(
        self,
        system_prompt: str,
        user_prompt: str,
        schema: type[T],
        temperature: float = 0.2,
    ) -> T:
        if self.simulate_malformed_json:
            raise ValueError("Simulated malformed JSON response from LLM")

        if issubclass(schema, RagAnswer):
            confidence = 0.35 if self.simulate_low_confidence else 0.92
            should_escalate = self.simulate_should_escalate or self.simulate_low_confidence
            answer_text = (
                self.custom_answer
                if self.custom_answer is not None
                else (
                    "According to our knowledge base, here is the answer regarding your question: "
                    f"'{user_prompt[:80]}'."
                )
            )
            citations = (
                self.custom_citations
                if self.custom_citations is not None
                else [
                    CitationItem(
                        chunk_id="chunk-default-101",
                        doc_id="doc-kb-001",
                        title="Getting Started Guide",
                    )
                ]
            )

            result = RagAnswer(
                answer=answer_text,
                citations=citations,
                confidence=confidence,
                should_escalate=should_escalate,
                reason="Low confidence score" if should_escalate else None,
            )
            return result  # type: ignore[return-value]

        # Generic schema fallback: inspect fields with defaults or mock values
        dummy_data: dict[str, object] = {}
        for field_name, field_info in schema.model_fields.items():
            if field_info.default is not None:
                dummy_data[field_name] = field_info.default
            else:
                dummy_data[field_name] = f"mock_{field_name}"

        return schema.model_validate(dummy_data)

    async def get_embeddings(self, texts: list[str]) -> list[list[float]]:
        """Generate deterministic 384-dimensional unit-normalized embeddings.

        Embeddings are derived from MD5/SHA256 hashes of the text content so
        identical strings always produce identical vectors, and similar strings
        yield correlated vectors. Vectors are strictly normalized to length 1.0.
        """
        results: list[list[float]] = []
        for text in texts:
            # Deterministic seed from text
            text_bytes = text.strip().lower().encode("utf-8")
            hash_digest = hashlib.sha256(text_bytes).digest()

            # Generate `embedding_dim` pseudo-random floats in [-1.0, 1.0]
            raw_floats: list[float] = []
            for i in range(self.embedding_dim):
                byte_val = hash_digest[i % len(hash_digest)]
                # Add index variation
                val = math.sin((byte_val + i * 31) / 256.0 * math.pi)
                raw_floats.append(val)

            # Normalize to unit length (L2 norm = 1.0)
            norm = math.sqrt(sum(x * x for x in raw_floats))
            if norm > 0:
                normalized = [round(x / norm, 6) for x in raw_floats]
            else:
                normalized = [0.0] * self.embedding_dim

            results.append(normalized)

        return results
