# 04 Real Embeddings and an Honest RAG Evaluation

## Findings being fixed

- Embeddings are a deterministic SHA-256 mock (`mock_llm.py`), not sentence-transformers.
- Eval (hit@5 1.00, groundedness 0.99, p95 1.8 ms) ran on mock embeddings and a generated golden set, so it measures nothing.
- Index is `ivfflat (lists=100)` which performs poorly on small tables.
- Docs claim sentence-transformers; code does not use it.

## Step 1: Embedding provider interface

`apps/ai-service/src/embeddings.py`:

```python
class EmbeddingProvider(Protocol):
    dim: int
    def embed(self, texts: list[str]) -> list[list[float]]: ...

class SbertProvider:   # default
    dim = 384
    def __init__(self, model="sentence-transformers/all-MiniLM-L6-v2"):
        self._model = None; self._name = model
    def _load(self):
        if self._model is None:
            from sentence_transformers import SentenceTransformer
            self._model = SentenceTransformer(self._name)
        return self._model
    def embed(self, texts):
        return self._load().encode(texts, batch_size=32, normalize_embeddings=True).tolist()

class MockProvider: ...   # tests only
```

- Env: `EMBEDDING_PROVIDER=sbert|mock` (default `sbert`).
- Startup guard: if `ENV=production` and provider is `mock`, raise and exit.
- Install CPU torch: `pip install sentence-transformers --extra-index-url https://download.pytorch.org/whl/cpu`; pin in requirements. Pre-download the model in the Dockerfile build stage or lazy-load on first request (keep lazy loading; document cold-start time).
- Unit tests keep using `MockProvider` (fast). Add one integration test using the real model on 5 sentences that checks semantic similarity ordering (cat/kitten closer than cat/invoice).

## Step 2: Migrate vectors and index

```sql
DROP INDEX IF EXISTS idx_kb_chunks_embedding;
CREATE INDEX idx_kb_chunks_embedding ON kb_chunks USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64);
-- query time:
SET hnsw.ef_search = 40;
```

Add a `scripts/reembed.py` that re-embeds all chunks in batches and records the model name in `kb_chunks.metadata.embedding_model`. Add a column or metadata check so mixed-model data cannot be queried together.
Why: IVFFlat needs data at index build time and tuned `lists` and `probes`; HNSW gives better recall for small and medium data. Record this in an ADR.

## Step 3: Build a corpus that makes retrieval non-trivial

- Use at least 50 real documents (for example the public help docs of an open-source product, or ~50 long articles you write or collect with permission). Store under `tests/ai-eval/corpus/`.
- Ingest through the real pipeline. Record chunk count.

## Step 4: Build a human-written golden set

File `tests/ai-eval/golden/v2.jsonl`, 100 rows, each: `id, question, expected_doc_ids[], expected_chunk_ids[], should_escalate, type`.
Composition: 50 direct questions, 20 paraphrased or misspelled, 15 multi-chunk questions, 15 unanswerable or off-topic (must escalate). Write the questions yourself; do not generate them from the same chunks with an LLM. Keep a `README` stating who wrote them and how.
Also 15 adversarial rows (prompt injection inside questions and inside a KB document).

## Step 5: Metrics and judge

Implement in `apps/ai-service/src/eval.py` (or `tests/ai-eval/run.py`):

- retrieval: hit@1, hit@5, MRR, per question type.
- generation (needs a real LLM key; Gemini free tier is fine, throttle and cache responses to disk): groundedness = fraction of answer sentences supported by cited chunks, judged by (a) rule overlap check and (b) an LLM judge on a 30% sample; answer relevance.
- escalation: precision, recall, F1 on unanswerable and adversarial rows.
- latency: p50 and p95 separately for embedding, retrieval, generation (no mocks).
- cost: tokens per answer.
  Store each run in `ai_eval_runs` with `commit_sha`, `embedding_model`, `llm_model`, `dataset_version`.

## Step 6: Ablation table (great interview material)

Run the same golden set with: BM25/full-text only, vector only, hybrid (RRF), hybrid + rerank, and mock embeddings (to show why mock numbers were meaningless). Save to `evidence/ai/ablation.md`:
| Retrieval | hit@5 | MRR | p95 retrieval ms |
Report honestly even if hybrid is not best on your data.

## Step 7: CI behaviour

- PR CI: unit tests with mock provider; a small 20-row smoke eval with the real small model if the runtime is acceptable (cache the model via `actions/cache`).
- Nightly workflow: full eval with real embeddings; LLM judge optional (secret required); fails if hit@5 or groundedness drops more than 3 points from the stored baseline.

## Step 8: Streaming (also used in file 05)

Add `POST /draft-response/stream` returning `text/event-stream` with events `token`, `final` (JSON with citations, confidence, shouldEscalate) and `error`. Provider interface gains `stream_generate`. Gateway proxies without buffering. Details in file 05.

## Step 9: Fix the docs and claims

Update `docs/02-architecture-spec.md` to describe the provider interface and default model. Remove "99% groundedness" claims everywhere.

## Acceptance checklist

- [ ] Real embeddings used by default; production refuses mock.
- [ ] All chunks re-embedded; HNSW index in place.
- [ ] 50+ doc corpus and 100-row human-written golden set committed.
- [ ] Eval run with real model; results saved to `evidence/ai/eval-<date>.md`.
- [ ] Ablation table saved.
- [ ] Nightly eval workflow in place.

## Resume gating

Allowed: "Hybrid RAG (pgvector HNSW + full-text, reciprocal rank fusion) with citation checks and confidence-based escalation; evaluated on a [N]-question human-written set (hit@5 [X], MRR [Y]; ablation vs vector-only and BM25-only)". Use only real values. Never quote the earlier mock results.
