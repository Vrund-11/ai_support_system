"""Integration and unit tests for Pluggable Embedding Provider Interface."""

import math

import pytest

from src.embeddings import (
    EmbeddingProvider,
    MockProvider,
    SbertProvider,
)


def cosine_similarity(v1: list[float], v2: list[float]) -> float:
    dot = sum(a * b for a, b in zip(v1, v2, strict=False))
    norm1 = math.sqrt(sum(a * a for a in v1))
    norm2 = math.sqrt(sum(b * b for b in v2))
    if norm1 == 0 or norm2 == 0:
        return 0.0
    return dot / (norm1 * norm2)


def test_embedding_provider_protocol():
    mock_p = MockProvider(dim=384)
    assert isinstance(mock_p, EmbeddingProvider)
    assert mock_p.dim == 384

    sbert_p = SbertProvider(dim=384)
    assert isinstance(sbert_p, EmbeddingProvider)
    assert sbert_p.dim == 384


def test_mock_provider_unit_normalized():
    mock_p = MockProvider(dim=384)
    texts = ["Hello world", "Customer support query", "Password reset instructions"]
    embeddings = mock_p.embed(texts)

    assert len(embeddings) == 3
    for emb in embeddings:
        assert len(emb) == 384
        norm = math.sqrt(sum(x * x for x in emb))
        assert abs(norm - 1.0) < 1e-4

    # Determinism: same text yields identical vectors
    emb2 = mock_p.embed(["Hello world"])
    assert emb2[0] == embeddings[0]


def test_sbert_embeddings_semantic_similarity():
    """Verify genuine semantic similarity on 5 distinct sentences.

    sim(cat, kitten) must be substantially higher than sim(cat, invoice).
    sim(invoice, billing) must be substantially higher than sim(invoice, kitten).
    """
    provider = SbertProvider()
    sentences = [
        "The feline kitten purred softly while resting on the warm rug.",  # 0: kitten
        "A domestic cat sleeps peacefully indoors on the sofa.",  # 1: cat
        "Your monthly subscription invoice payment is past due.",  # 2: invoice
        "Please update your billing credit card details to avoid suspension.",  # 3: billing
        "The quick brown fox jumps over the lazy dog.",  # 4: neutral
    ]

    embeddings = provider.embed(sentences)
    assert len(embeddings) == 5
    for emb in embeddings:
        assert len(emb) == 384
        norm = math.sqrt(sum(x * x for x in emb))
        assert abs(norm - 1.0) < 1e-4

    sim_cat_kitten = cosine_similarity(embeddings[0], embeddings[1])
    sim_cat_invoice = cosine_similarity(embeddings[1], embeddings[2])
    sim_invoice_billing = cosine_similarity(embeddings[2], embeddings[3])
    sim_invoice_kitten = cosine_similarity(embeddings[0], embeddings[2])

    # Semantic similarity assertions
    assert sim_cat_kitten > 0.50
    assert sim_cat_invoice < 0.30
    assert sim_cat_kitten > sim_cat_invoice, (
        f"Expected sim(cat, kitten) [{sim_cat_kitten}] > sim(cat, invoice) [{sim_cat_invoice}]"
    )

    assert sim_invoice_billing > 0.45
    assert sim_invoice_billing > sim_invoice_kitten, (
        f"Expected sim(invoice, billing) [{sim_invoice_billing}] > "
        f"sim(invoice, kitten) [{sim_invoice_kitten}]"
    )


@pytest.mark.asyncio
async def test_sbert_async_embed():
    provider = SbertProvider()
    texts = ["Asynchronous embedding test", "SupportPilot AI pipeline"]
    embeddings = await provider.aembed(texts)
    assert len(embeddings) == 2
    assert len(embeddings[0]) == 384
