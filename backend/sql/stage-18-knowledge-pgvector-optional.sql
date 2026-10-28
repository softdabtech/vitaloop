-- Optional Stage 18 follow-up: pgvector enablement for knowledge_chunks embeddings.
-- Apply only when vector search infrastructure is approved for this environment.

begin;

create extension if not exists vector;

-- Keep existing JSON embedding for compatibility; add vector column for ANN search.
alter table if exists public.knowledge_chunks
  add column if not exists embedding_vec vector(1536);

create index if not exists idx_knowledge_chunks_embedding_vec
  on public.knowledge_chunks
  using ivfflat (embedding_vec vector_cosine_ops)
  with (lists = 100);

comment on column public.knowledge_chunks.embedding is
  'JSON fallback embedding storage. Prefer embedding_vec when pgvector is enabled.';

comment on column public.knowledge_chunks.embedding_vec is
  'Optional pgvector embedding column for ANN retrieval.';

commit;
