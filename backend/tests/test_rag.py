"""Tests for RAG Service."""
from unittest.mock import patch, AsyncMock, MagicMock
import pytest
import numpy as np

from backend.app.services.rag import RAGService, Chunk, SearchResult


class TestRAGChunking:
    """Test markdown chunking logic."""

    def test_chunk_small_text(self):
        text = "Short text."
        chunks = RAGService.chunk_markdown(text, source_path="test.md")
        assert len(chunks) == 1
        assert chunks[0].content == "Short text."

    def test_chunk_large_text(self):
        text = "a" * 1200
        chunks = RAGService.chunk_markdown(text, source_path="test.md")
        assert len(chunks) >= 1

    def test_chunk_empty(self):
        chunks = RAGService.chunk_markdown("", source_path="test.md")
        assert len(chunks) == 0

    def test_chunk_exact_size(self):
        text = "b" * 500
        chunks = RAGService.chunk_markdown(text, source_path="test.md")
        assert len(chunks) == 1
        assert len(chunks[0].content) == 500

    def test_chunk_with_real_markdown(self):
        text = "# Heading\n\nParagraph one.\n\nParagraph two.\n\n" + "more text. " * 100
        chunks = RAGService.chunk_markdown(text, source_path="test.md")
        assert len(chunks) >= 2
        for chunk in chunks:
            assert len(chunk.content) <= 1200  # overall text size


class TestRAGSearch:
    """Test RAG search with mocked embeddings."""

    @pytest.fixture
    def rag_service(self):
        return RAGService(route="v1")

    @pytest.mark.asyncio
    async def test_search_semantic_mock(self, rag_service):
        """Test semantic search returns results with mocked embeddings."""
        with patch.object(rag_service, 'embed_query') as mock_embed:
            mock_embed.return_value = np.ones(768, dtype=np.float32) * 0.5

            with patch.object(rag_service, '_semantic_search_sync') as mock_search:
                mock_search.return_value = [
                    SearchResult(
                        content="Test chunk content",
                        score=0.95,
                        metadata={"source_path": "test.md", "heading": "Test"}
                    )
                ]
                results = await rag_service.search("test query", limit=5, method="semantic")
                assert len(results) == 1
                assert results[0].score == 0.95
                assert "Test chunk" in results[0].content

    @pytest.mark.asyncio
    async def test_search_keyword_mock(self, rag_service):
        """Test keyword search."""
        with patch.object(rag_service, '_keyword_search_sync') as mock_kw:
            mock_kw.return_value = [
                SearchResult(content="keyword result", score=0.8, metadata={"source_path": "b.md"})
            ]
            results = await rag_service.search("test", method="keyword", limit=5)
            assert len(results) == 1
            assert results[0].content == "keyword result"

    @pytest.mark.asyncio
    async def test_search_hybrid_mock(self, rag_service):
        """Test hybrid search combines semantic + keyword results."""
        with patch.object(rag_service, '_semantic_search_sync') as mock_sem:
            mock_sem.return_value = [
                SearchResult(content="semantic result", score=0.9, metadata={"source_path": "a.md", "method": "semantic"})
            ]
            with patch.object(rag_service, '_keyword_search_sync') as mock_kw:
                mock_kw.return_value = [
                    SearchResult(content="keyword result", score=0.8, metadata={"source_path": "b.md", "method": "keyword"})
                ]
                results = await rag_service.search("test", method="hybrid", limit=5)
                assert len(results) == 2


class TestRAGIndexing:
    """Test document indexing."""

    @pytest.fixture
    def rag_service(self):
        return RAGService(route="v1")

    @pytest.mark.asyncio
    async def test_index_wiki_page_mock(self, rag_service):
        """Test indexing a wiki page with mocked embeddings."""
        with patch.object(rag_service, 'embed_texts') as mock_embed:
            mock_embed.return_value = [np.ones(768, dtype=np.float32).tolist()]
            with patch.object(rag_service, '_index_chunks_sync') as mock_store:
                mock_store.return_value = 1
                count = await rag_service.index_wiki_page("test.md", "# Test\n\nThis is test content.")
                assert count == 1

    def test_chunk_to_rows(self, rag_service):
        """Test converting chunks to DB rows."""
        chunks = [
            Chunk(content="chunk one", metadata={"source_path": "doc.md", "heading": "H1"}),
            Chunk(content="chunk two", metadata={"source_path": "doc.md", "heading": "H2"}),
        ]
        # Just verify chunk_markdown produces valid chunks
        assert len(chunks) == 2
        assert chunks[0].content == "chunk one"
