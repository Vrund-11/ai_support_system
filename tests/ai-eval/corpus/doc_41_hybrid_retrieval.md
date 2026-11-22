# Hybrid RAG Retrieval Architecture

SupportPilot combines dense vector similarity search with sparse lexical search to achieve optimal retrieval accuracy.

## Retrieval Stages

1. **Vector Search (pgvector HNSW)**: Evaluates semantic similarity using 384-dimensional `all-MiniLM-L6-v2` embeddings with cosine distance. Configured with index parameters `m = 16`, `ef_construction = 64`, and runtime query parameter `SET hnsw.ef_search = 40;`.
2. **Lexical Search (PostgreSQL Full-Text Search)**: Evaluates exact keyword matches using English `to_tsvector` and `tsquery`.
3. **Reciprocal Rank Fusion (RRF)**: Combines ranked outputs using formula:
   $$RRF(d) = \sum_{m \in \{vector, text\}} rac{1}{60 + rank_m(d)}$$
