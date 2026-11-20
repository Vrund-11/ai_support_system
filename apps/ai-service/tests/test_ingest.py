"""Tests for KB ingestion pipeline, chunker unit tests, and idempotent re-ingest (KB-2, 3, 5)."""

import pytest
from fastapi.testclient import TestClient

from src.ingest.chunker import DocumentChunker
from src.ingest.extract import clean_text
from src.ingest.pipeline import IngestionPipeline
from src.ingest.repository import MemoryIngestRepository, set_ingest_repository
from src.main import app
from src.providers.mock import MockLLMProvider

client = TestClient(app)


# ── 1. Text Cleaner Unit Tests ──
def test_clean_text_strips_control_characters_and_normalizes():
    dirty = "Hello\x00\x08World!\r\n\r\n\n\nNext paragraph."
    cleaned = clean_text(dirty)
    assert "\x00" not in cleaned
    assert "\x08" not in cleaned
    assert "\r" not in cleaned
    assert "Hello" in cleaned
    assert "World!" in cleaned
    assert "\n\n\n" not in cleaned  # collapsed excess vertical space


# ── 2. Chunker Unit Tests ──
def test_chunker_empty_input():
    chunker = DocumentChunker()
    assert chunker.chunk_document("") == []
    assert chunker.chunk_document("   \n\n   ") == []


def test_chunker_short_document_single_chunk():
    chunker = DocumentChunker(target_tokens=500, overlap_tokens=80)
    text = "# Getting Started\n\nThis is a short knowledge base document about SupportPilot."
    chunks = chunker.chunk_document(text)
    assert len(chunks) == 1
    assert chunks[0].chunk_index == 0
    assert chunks[0].section_path == "Getting Started"
    assert "SupportPilot" in chunks[0].content


def test_chunker_heading_hierarchy_section_path():
    chunker = DocumentChunker(target_tokens=500, overlap_tokens=80)
    markdown = """# SupportPilot Manual

Overview text.

## Configuration

General settings.

### API Keys

Instructions for creating API keys.

### Webhooks

Instructions for webhooks.

## Troubleshooting

Common errors.
"""
    chunks = chunker.chunk_document(markdown)
    assert len(chunks) == 5

    paths = [c.section_path for c in chunks]
    assert paths[0] == "SupportPilot Manual"
    assert paths[1] == "SupportPilot Manual > Configuration"
    assert paths[2] == "SupportPilot Manual > Configuration > API Keys"
    assert paths[3] == "SupportPilot Manual > Configuration > Webhooks"
    assert paths[4] == "SupportPilot Manual > Troubleshooting"


def test_chunker_long_section_splits_with_overlap():
    chunker = DocumentChunker(target_tokens=60, overlap_tokens=20)

    # Generate multi-paragraph section exceeding 60 tokens
    paragraphs = [
        f"Paragraph {i}: SupportPilot offers enterprise AI ticketing, knowledge base indexing, "
        "and seamless human handoff workflows for fast customer support resolution."
        for i in range(1, 10)
    ]
    long_section = "## Deep Dive\n\n" + "\n\n".join(paragraphs)

    chunks = chunker.chunk_document(long_section)
    assert len(chunks) > 1

    # Verify chunk indexing is contiguous
    for i, chunk in enumerate(chunks):
        assert chunk.chunk_index == i
        assert chunk.section_path == "Deep Dive"

    # Verify overlap: consecutive chunks share text
    for i in range(len(chunks) - 1):
        c1_content = chunks[i].content
        c2_content = chunks[i + 1].content

        # Extract last paragraph of c1 and check it is present in c2
        c1_paras = [p for p in c1_content.split("\n\n") if p.strip()]
        last_para = c1_paras[-1]
        assert last_para in c2_content, f"Overlap paragraph missing in chunk {i + 1}"


# ── 3. Pipeline Ingestion & Idempotent Re-Ingest Tests (KB-2, 3, 5) ──
@pytest.mark.asyncio
async def test_ingestion_pipeline_lifecycle_ready():
    repo = MemoryIngestRepository()
    mock_provider = MockLLMProvider()
    pipeline = IngestionPipeline(repository=repo, llm_provider=mock_provider)

    doc_text = """# SLA Policies

SupportPilot tracks SLAs across 4 priority levels: Low, Medium, High, and Urgent.

## Business Hours

Timers run only during designated tenant business hours.
"""
    result = await pipeline.ingest_document(
        tenant_id="tenant_001",
        document_id="doc_101",
        raw_text=doc_text,
        title="SLA Guide",
        source="upload",
    )

    assert result.status == "READY"
    assert result.chunks_count == 2
    assert result.error is None

    # Verify stored document
    doc = await repo.get_document("tenant_001", "doc_101")
    assert doc is not None
    assert doc.status == "READY"
    assert doc.chunk_count == 2
    assert doc.title == "SLA Guide"

    # Verify stored chunks have embeddings
    chunks = await repo.get_chunks_for_document("tenant_001", "doc_101")
    assert len(chunks) == 2
    assert len(chunks[0].embedding) == 384
    assert len(chunks[1].embedding) == 384


@pytest.mark.asyncio
async def test_idempotent_reingest_replaces_old_chunks():
    repo = MemoryIngestRepository()
    pipeline = IngestionPipeline(repository=repo, llm_provider=MockLLMProvider())

    initial_text = """# Version 1

## Section A
Alpha content.

## Section B
Beta content.

## Section C
Gamma content.
"""
    # 1. Ingest initial document (4 chunks: header + 3 sections)
    res1 = await pipeline.ingest_document(
        tenant_id="tenant_001",
        document_id="doc_reingest_test",
        raw_text=initial_text,
        title="Doc V1",
    )
    assert res1.chunks_count == 4
    chunks1 = await repo.get_chunks_for_document("tenant_001", "doc_reingest_test")
    assert len(chunks1) == 4

    # 2. Re-ingest same document with only 1 section
    updated_text = """# Version 2

Consolidated content into a single section.
"""
    res2 = await pipeline.ingest_document(
        tenant_id="tenant_001",
        document_id="doc_reingest_test",
        raw_text=updated_text,
        title="Doc V2",
    )
    assert res2.status == "READY"
    assert res2.chunks_count == 1

    # Verify old chunks were completely replaced, no orphans or duplicates remain
    chunks2 = await repo.get_chunks_for_document("tenant_001", "doc_reingest_test")
    assert len(chunks2) == 1
    assert "Consolidated content" in chunks2[0].content

    # Document version incremented
    doc = await repo.get_document("tenant_001", "doc_reingest_test")
    assert doc is not None
    assert doc.version == 2
    assert doc.chunk_count == 1


@pytest.mark.asyncio
async def test_ingestion_failure_transitions_to_failed():
    repo = MemoryIngestRepository()
    pipeline = IngestionPipeline(repository=repo, llm_provider=MockLLMProvider())

    # Ingest document with empty / whitespace text
    result = await pipeline.ingest_document(
        tenant_id="tenant_001",
        document_id="doc_empty",
        raw_text="   \n\n   ",
    )

    assert result.status == "FAILED"
    assert result.chunks_count == 0
    assert result.error is not None

    doc = await repo.get_document("tenant_001", "doc_empty")
    assert doc is not None
    assert doc.status == "FAILED"
    assert doc.error is not None


# ── 4. API Endpoints Integration Tests ──
def test_api_ingest_and_get_chunks():
    test_repo = MemoryIngestRepository()
    set_ingest_repository(test_repo)

    payload = {
        "tenant_id": "ten_api_test",
        "document_id": "doc_api_001",
        "title": "API Handbook",
        "text": (
            "# API Handbook\n\n"
            "## Authentication\nUse Bearer token in header.\n\n"
            "## Endpoints\nPOST /v1/answer"
        ),
    }

    # 1. Ingest via API (3 chunks: header + 2 subsections)
    res_ingest = client.post("/v1/kb/ingest", json=payload)
    assert res_ingest.status_code == 200
    data = res_ingest.json()
    assert data["status"] == "READY"
    assert data["chunks_count"] == 3
    assert data["document_id"] == "doc_api_001"

    # 2. Get document status
    res_doc = client.get("/v1/kb/documents/doc_api_001?tenant_id=ten_api_test")
    assert res_doc.status_code == 200
    doc_data = res_doc.json()
    assert doc_data["title"] == "API Handbook"
    assert doc_data["status"] == "READY"
    assert doc_data["chunk_count"] == 3

    # 3. Get chunks
    res_chunks = client.get("/v1/kb/documents/doc_api_001/chunks?tenant_id=ten_api_test")
    assert res_chunks.status_code == 200
    chunks_data = res_chunks.json()
    assert chunks_data["count"] == 3
    assert chunks_data["chunks"][0]["section_path"] == "API Handbook"
    assert chunks_data["chunks"][1]["section_path"] == "API Handbook > Authentication"
    assert chunks_data["chunks"][2]["section_path"] == "API Handbook > Endpoints"

    # 4. Cross-tenant isolation: other tenant cannot find document
    res_cross = client.get("/v1/kb/documents/doc_api_001?tenant_id=other_tenant")
    assert res_cross.status_code == 404
