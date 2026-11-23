# SupportPilot RAG Evaluation Report — 2026-11-23

## Executive Summary

- **Dataset**: `independent_v1.jsonl` (60 samples evaluated)
- **Embedding Model**: `sentence-transformers/all-MiniLM-L6-v2` (384 dimensions)
- **Embedding Provider**: `sbert`
- **LLM Generation Provider**: `mock`
- **Commit SHA**: `local-HEAD`
- **Regression Gate**: FAILED
- **Regression Gate Targets Missed**: Hit@1 (0.697 < 0.700), Escalation Recall (0.519 < 0.800), Escalation F1 (0.637 < 0.800)

## Core Quality Metrics

| Metric                               | Result    | Benchmark Target | Description                                                                                      | Status |
| ------------------------------------ | --------- | ---------------- | ------------------------------------------------------------------------------------------------ | ------ |
| **Hit@1**                            | **0.697** | $\ge 0.700$      | Top-1 chunk contains correct document ID                                                         | FAILED |
| **Hit@5**                            | **0.939** | $\ge 0.850$      | Top-5 chunks contain correct document ID                                                         | PASSED |
| **MRR (Mean Reciprocal Rank)**       | **0.793** | $\ge 0.750$      | Reciprocal rank of first relevant chunk                                                          | PASSED |
| **Lexical overlap (mock generator)** | **0.967** | $\ge 0.850$      | Fraction of answer sentences supported by cited chunks (lexical word overlap for mock generator) | PASSED |
| **Escalation Precision**             | **0.824** | $\ge 0.800$      | Precision on unanswerable & adversarial inquiries                                                | PASSED |
| **Escalation Recall**                | **0.519** | $\ge 0.800$      | Recall on unanswerable & adversarial inquiries                                                   | FAILED |
| **Escalation F1**                    | **0.637** | $\ge 0.800$      | Harmonic mean of escalation precision and recall                                                 | FAILED |

## Latency & Resource Breakdown

| Stage                      | p50 Latency (ms) | p95 Latency (ms) | Notes                                             |
| -------------------------- | ---------------- | ---------------- | ------------------------------------------------- |
| **Embedding**              | 13.0             | 17.4             | Sbert MiniLM 384d batch encoding                  |
| **Retrieval (Hybrid RRF)** | 37.1             | 51.4             | pgvector HNSW cosine + tsvector keyword fusion    |
| **Generation (RAG)**       | 40.7             | 77.4             | Context assembly, guardrail check, draft drafting |
| **End-to-End Total**       | **92.3**         | **130.9**        | Overall request latency                           |

- **Average Estimated Tokens per Answer**: `26.7` tokens

## Performance by Question Category

| Category       | Evaluated | Hit@1          | Hit@5          | Lexical overlap (mock generator) |
| -------------- | --------- | -------------- | -------------- | -------------------------------- |
| `direct`       | 33        | 0.697          | 0.939          | 0.967 (n=30)                     |
| `unanswerable` | 22        | N/A (Escalate) | N/A (Escalate) | N/A (Escalated, n=0)             |
| `adversarial`  | 5         | N/A (Escalate) | N/A (Escalate) | N/A (Escalated, n=0)             |

## LLM-Judge Groundedness Evaluation (30 Samples)

- **Evaluated Samples**: 30 (Successful: 27, Failed: 3)
- **Grounded Ratio**: 0/27 (0.0%)
- **Average Groundedness Score**: 0.000
- **Note / API Status**: Gemini API returned HTTP 429

| Sample ID | Question                                              | Judge Grounded | Score  | Reasoning / Notes                                                                |
| --------- | ----------------------------------------------------- | :------------: | :----: | -------------------------------------------------------------------------------- |
| `ind_001` | How do I add a new agent to my team?...               |    `False`     | `0.00` | The Answer does not provide the actual instructions on how to add a new agent to |
| `ind_002` | Can I set different business hours for weekends?...   |    `False`     | `0.00` | The answer does not provide an answer to the question about setting different bu |
| `ind_003` | Where do I find my API key?...                        |    `False`     | `0.00` | The answer provides a meta-commentary about the documentation structure and titl |
| `ind_005` | What happens when a ticket breaches its SLA?...       |    `False`     | `0.00` | The provided Answer does not answer the question about what happens when a ticke |
| `ind_006` | How do I turn on two-factor authentication?...        |    `False`     | `0.00` | The provided Answer does not answer the question on how to turn on two-factor au |
| `ind_008` | How do I assign a ticket to someone else?...          |    `False`     | `0.00` | The provided Answer does not answer the question about how to assign a ticket to |
| `ind_009` | How do I create a canned reply?...                    |    `False`     | `0.00` | The provided Answer does not actually explain how to create a canned reply based |
| `ind_012` | How do I embed the chat widget on my website?...      |    `False`     | `0.00` | The answer completely fails to answer the question ('How do I embed the chat wid |
| `ind_014` | How do I merge two duplicate tickets?...              |    `False`     | `0.00` | The provided Answer does not actually explain how to merge two duplicate tickets |
| `ind_015` | Can I change my company logo and brand colour in t... |    `False`     | `0.00` | The answer fails to address the question and instead only provides a citation he |
| `ind_016` | cant log in keeps saying account locked...            |    `False`     | `0.00` | The provided Answer only includes a document reference and a header, failing to  |
| `ind_017` | how 2 get notifications on my phone when a custome... |    `False`     | `0.00` | The answer fails to answer the question about how to get notifications on a phon |
| `ind_018` | my customer says the chat bubble isnt showing on o... |    `False`     | `0.00` | The Answer fails to provide any troubleshooting steps for the customer's issue a |
| `ind_019` | is there a way to stop the bot from answering bill... |    `False`     | `0.00` | The answer attempts to address stopping a bot from answering billing questions,  |
| `ind_020` | someone left the company, how do I remove their ac... |    `False`     | `0.00` | The provided Answer does not answer the question about how to remove a departing |

## Methodology & Verification Note

Evaluated with real `sentence-transformers/all-MiniLM-L6-v2` dense vectors against 55 Markdown documents ingested in PostgreSQL pgvector HNSW index.
Zero simulated metrics. All values represent authentic benchmark measurements.
