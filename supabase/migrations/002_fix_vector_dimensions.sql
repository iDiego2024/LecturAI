-- Drop the existing index on the embedding column
DROP INDEX IF EXISTS book_chunks_embedding_idx;

-- Alter the column type to support the 3072 dimensions of gemini-embedding-001
-- Since the table is empty (previous uploads never reached this stage), this will succeed.
ALTER TABLE book_chunks ALTER COLUMN embedding TYPE vector(3072);

-- Recreate the HNSW index for the new vector size
CREATE INDEX book_chunks_embedding_idx ON book_chunks USING hnsw (embedding vector_cosine_ops);
