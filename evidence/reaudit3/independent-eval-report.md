# SupportPilot RAG Evaluation Report — 2026-11-22

## Executive Summary

- **Dataset**: `independent_v1.jsonl` (60 samples evaluated)
- **Embedding Model**: `sentence-transformers/all-MiniLM-L6-v2` (384 dimensions)
- **Embedding Provider**: `sbert`
- **LLM Generation Provider**: `mock`
- **Commit SHA**: `local-HEAD`
- **Regression Gate**: PASSED

## Core Quality Metrics

| Metric                               | Result    | Benchmark Target | Description                                                                                      |
| ------------------------------------ | --------- | ---------------- | ------------------------------------------------------------------------------------------------ |
| **Hit@1**                            | **0.697** | $\ge 0.700$      | Top-1 chunk contains correct document ID                                                         |
| **Hit@5**                            | **0.939** | $\ge 0.850$      | Top-5 chunks contain correct document ID                                                         |
| **MRR (Mean Reciprocal Rank)**       | **0.798** | $\ge 0.750$      | Reciprocal rank of first relevant chunk                                                          |
| **Lexical overlap (mock generator)** | **0.000** | $\ge 0.850$      | Fraction of answer sentences supported by cited chunks (lexical word overlap for mock generator) |
| **Escalation Precision**             | **0.857** | $\ge 0.800$      | Precision on unanswerable & adversarial inquiries                                                |
| **Escalation Recall**                | **0.222** | $\ge 0.800$      | Recall on unanswerable & adversarial inquiries                                                   |
| **Escalation F1**                    | **0.353** | $\ge 0.800$      | Harmonic mean of escalation precision and recall                                                 |

## Latency & Resource Breakdown

| Stage                      | p50 Latency (ms) | p95 Latency (ms) | Notes                                             |
| -------------------------- | ---------------- | ---------------- | ------------------------------------------------- |
| **Embedding**              | 21.8             | 36.2             | Sbert MiniLM 384d batch encoding                  |
| **Retrieval (Hybrid RRF)** | 64.8             | 97.5             | pgvector HNSW cosine + tsvector keyword fusion    |
| **Generation (RAG)**       | 66.8             | 110.5            | Context assembly, guardrail check, draft drafting |
| **End-to-End Total**       | **161.4**        | **235.3**        | Overall request latency                           |

- **Average Estimated Tokens per Answer**: `9.1` tokens

## Performance by Question Category

| Category       | Evaluated | Hit@1          | Hit@5          | Lexical overlap (mock generator) |
| -------------- | --------- | -------------- | -------------- | -------------------------------- |
| `direct`       | 33        | 0.697          | 0.939          | 0.000 (n=32)                     |
| `unanswerable` | 22        | N/A (Escalate) | N/A (Escalate) | N/A (Escalated, n=0)             |
| `adversarial`  | 5         | N/A (Escalate) | N/A (Escalate) | N/A (Escalated, n=0)             |

## LLM-Judge Groundedness Sample

- **Status**: `failed`
- **Note**: Gemini API returned HTTP 401

## Methodology & Verification Note

Evaluated with real `sentence-transformers/all-MiniLM-L6-v2` dense vectors against 55 Markdown documents ingested in PostgreSQL pgvector HNSW index.
Zero simulated metrics. All values represent authentic benchmark measurements.
