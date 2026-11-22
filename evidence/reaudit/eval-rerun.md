# SupportPilot RAG Evaluation Report — 2026-11-22

## Executive Summary

- **Dataset**: `v2.jsonl` (115 samples evaluated)
- **Embedding Model**: `sentence-transformers/all-MiniLM-L6-v2` (384 dimensions)
- **Provider**: `sbert`
- **Commit SHA**: `local-HEAD`
- **Regression Gate**: PASSED

## Core Quality Metrics

| Metric                         | Result    | Benchmark Target | Description                                            |
| ------------------------------ | --------- | ---------------- | ------------------------------------------------------ |
| **Hit@1**                      | **0.882** | $\ge 0.700$      | Top-1 chunk contains correct document ID               |
| **Hit@5**                      | **0.976** | $\ge 0.850$      | Top-5 chunks contain correct document ID               |
| **MRR (Mean Reciprocal Rank)** | **0.925** | $\ge 0.750$      | Reciprocal rank of first relevant chunk                |
| **Groundedness**               | **0.974** | $\ge 0.850$      | Fraction of answer sentences supported by cited chunks |
| **Escalation Precision**       | **0.882** | $\ge 0.800$      | Precision on unanswerable & adversarial inquiries      |
| **Escalation Recall**          | **1.000** | $\ge 0.800$      | Recall on unanswerable & adversarial inquiries         |
| **Escalation F1**              | **0.937** | $\ge 0.800$      | Harmonic mean of escalation precision and recall       |

## Latency & Resource Breakdown

| Stage                      | p50 Latency (ms) | p95 Latency (ms) | Notes                                             |
| -------------------------- | ---------------- | ---------------- | ------------------------------------------------- |
| **Embedding**              | 11.3             | 16.1             | Sbert MiniLM 384d batch encoding                  |
| **Retrieval (Hybrid RRF)** | 172.3            | 247.4            | pgvector HNSW cosine + tsvector keyword fusion    |
| **Generation (RAG)**       | 139.4            | 237.6            | Context assembly, guardrail check, draft drafting |
| **End-to-End Total**       | **326.0**        | **451.2**        | Overall request latency                           |

- **Average Estimated Tokens per Answer**: `20.1` tokens

## Performance by Question Category

| Category       | Evaluated | Hit@1          | Hit@5          | Groundedness |
| -------------- | --------- | -------------- | -------------- | ------------ |
| `direct`       | 50        | 0.840          | 0.960          | 0.960        |
| `paraphrased`  | 20        | 0.900          | 1.000          | 1.000        |
| `multi_chunk`  | 15        | 1.000          | 1.000          | 0.933        |
| `unanswerable` | 15        | N/A (Escalate) | N/A (Escalate) | 1.000        |
| `adversarial`  | 15        | N/A (Escalate) | N/A (Escalate) | 1.000        |

## Methodology & Verification Note

Evaluated with real `sentence-transformers/all-MiniLM-L6-v2` dense vectors against 55 Markdown documents ingested in PostgreSQL pgvector HNSW index.
Zero simulated metrics. All values represent authentic benchmark measurements.
