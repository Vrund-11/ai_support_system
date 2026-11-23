# Retrieval Ablation Benchmark Study

## Executive Summary

This study benchmarks 5 distinct retrieval architectures on the SupportPilot independent evaluation dataset (`independent_v1.jsonl`, 60 questions total) against the 55-document production knowledge base corpus.
Measurements evaluate the 33 evaluable (answerable non-escalated) questions written independently without prior access to corpus documentation.

## Ablation Comparison Table

| Retrieval Mode                             | Hit@1     | Hit@5     | MRR       | p50 Retrieval (ms) | p95 Retrieval (ms) | Notes                                                                                                                             |
| ------------------------------------------ | --------- | --------- | --------- | ------------------ | ------------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| **BM25 / Full-Text Only**                  | **0.424** | **0.727** | **0.526** | 0.8                | 1.7                | Exact lexical token matching. High recall on exact codes and URLs; struggles with paraphrasing and typos.                         |
| **Vector Only (pgvector HNSW)**            | **0.697** | **0.939** | **0.798** | 25.1               | 35.4               | Dense semantic similarity (384d). Strong on conceptual inquiries and typos; misses exact acronyms without synonyms.               |
| **Hybrid (Vector + BM25 RRF)**             | **0.727** | **0.848** | **0.763** | 26.5               | 30.8               | Combines lexical and semantic lists via Reciprocal Rank Fusion ($k=60$). Balances keyword precision with semantic generalization. |
| **Hybrid + Reranker**                      | **0.606** | **0.818** | **0.679** | 23.9               | 27.1               | Takes top-10 RRF candidates and applies lexical section boosting and exact phrase re-scoring. Highest Hit@1.                      |
| **Mock Baseline (SHA-256 Pseudo-Vectors)** | **0.091** | **0.242** | **0.158** | 23.4               | 26.4               | Shows why mock embedding measurements are completely illusory. Fails on semantic retrieval.                                       |

## Technical Analysis & Evaluation Walkthrough

### 1. Vector-Only vs. Hybrid Retrieval on Independent Questions

- **On the independent set (n=33 answerable)**: Dense vector-only retrieval achieved the highest Hit@5 recall with **Hit@5 of 0.939** (Hit@1 0.697, MRR 0.798). Hybrid RRF achieved the highest Hit@1 precision with **Hit@1 of 0.727** (Hit@5 0.848, MRR 0.763).
- **Key Takeaway**: Plainly stated: vector-only has the best Hit@5 (0.939); hybrid has the best Hit@1 (0.727); the reranker lowers results; n=33.
- **Why Vector-Only Outperformed Hybrid on Hit@5**: Independent queries use colloquial, natural phrasing and synonyms that do not have verbatim lexical overlap with document headings or formal text. BM25 token matching retrieved loosely matched passages from unrelated documents, which diluted the top ranks when merged via reciprocal rank fusion.

### 2. Candidate Reranker Behavior

- The **Hybrid + Reranker** configuration yielded **Hit@1 of 0.606**, **Hit@5 of 0.818**, and **MRR of 0.679**, performing lower than Hybrid RRF (Hit@1 0.727, Hit@5 0.848, MRR 0.763) and vector-only (Hit@5 0.939). The reranker lowers results.
- **Reason**: The heuristic candidate reranker prioritizes heading and exact phrase matches. When independent queries lack verbatim phrases, the reranker penalizes genuinely relevant semantic passages in favor of incidental lexical matches.

### 3. BM25 and Mock Baseline

- **BM25 Alone**: Hit@1 0.424, Hit@5 0.727, MRR 0.526. Shows substantial recall degradation when queries do not reuse exact product terminology.
- **Mock Baseline**: Hit@1 0.091, Hit@5 0.242, MRR 0.158. Demonstrates that simulated SHA-256 pseudo-vectors fail completely at semantic retrieval, underscoring the necessity of real dense embeddings.
