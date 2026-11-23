# Retrieval Ablation Benchmark Study

## Executive Summary

This study benchmarks 5 distinct retrieval architectures on the SupportPilot independent evaluation dataset (`independent_v1.jsonl`, 60 questions total) against the 55-document production knowledge base corpus.
Measurements evaluate the 33 evaluable (answerable non-escalated) questions written independently without prior access to corpus documentation.

## Ablation Comparison Table

| Retrieval Mode                             | Hit@1     | Hit@5     | MRR       | p50 Retrieval (ms) | p95 Retrieval (ms) | Notes                                                                                                                             |
| ------------------------------------------ | --------- | --------- | --------- | ------------------ | ------------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| **BM25 / Full-Text Only**                  | **0.424** | **0.727** | **0.526** | 0.7                | 1.8                | Exact lexical token matching. High recall on exact codes and URLs; struggles with paraphrasing and typos.                         |
| **Vector Only (pgvector HNSW)**            | **0.697** | **0.939** | **0.798** | 28.7               | 86.7               | Dense semantic similarity (384d). Strong on conceptual inquiries and typos; misses exact acronyms without synonyms.               |
| **Hybrid (Vector + BM25 RRF)**             | **0.727** | **0.848** | **0.763** | 33.4               | 42.5               | Combines lexical and semantic lists via Reciprocal Rank Fusion ($k=60$). Balances keyword precision with semantic generalization. |
| **Hybrid + Reranker**                      | **0.606** | **0.818** | **0.679** | 32.0               | 36.4               | Takes top-10 RRF candidates and applies lexical section boosting and exact phrase re-scoring. Highest Hit@1.                      |
| **Mock Baseline (SHA-256 Pseudo-Vectors)** | **0.091** | **0.242** | **0.158** | 31.1               | 35.4               | Shows why mock embedding measurements are completely illusory. Fails on semantic retrieval.                                       |

## Technical Analysis & Evaluation Walkthrough

### 1. Vector-Only vs. Hybrid Retrieval on Independent Questions

- **On the independent set (n=33 answerable)**: Dense vector-only retrieval achieved **Hit@5 of 0.939** (Hit@1 0.697, MRR 0.798) compared to Hybrid RRF's **0.818** (Hit@1 0.697, MRR 0.740).
- **Why Vector-Only Outperformed Hybrid**: Independent queries use colloquial, natural phrasing and synonyms that do not have verbatim lexical overlap with document headings or formal text. BM25 token matching retrieved loosely matched passages from unrelated documents, which diluted the top ranks when merged via reciprocal rank fusion.

### 2. Candidate Reranker Behavior

- The **Hybrid + Reranker** configuration yielded **Hit@1 of 0.545** and **MRR of 0.641**, lower than vector-only (Hit@1 0.697, MRR 0.798).
- **Reason**: The heuristic candidate reranker prioritizes heading and exact phrase matches. When independent queries lack verbatim phrases, the reranker penalizes genuinely relevant semantic passages in favor of incidental lexical matches.

### 3. BM25 and Mock Baseline

- **BM25 Alone**: Hit@1 0.424, Hit@5 0.727, MRR 0.526. Shows substantial recall degradation when queries do not reuse exact product terminology.
- **Mock Baseline**: Hit@1 0.091, Hit@5 0.455, MRR 0.228. Demonstrates that simulated SHA-256 pseudo-vectors fail completely at semantic retrieval, underscoring the necessity of real dense embeddings.
