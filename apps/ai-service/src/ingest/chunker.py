"""Heading-aware document chunker with token estimator and overlap.

Splits markdown text by headings to maintain section hierarchy (section_path),
then splits long sections into chunks of ~500 tokens with 80 tokens overlap.
"""

import re
from dataclasses import dataclass, field
from typing import Any


@dataclass
class DocumentChunk:
    chunk_index: int
    content: str
    token_count: int
    char_count: int
    section_path: str = ""
    metadata: dict[str, Any] = field(default_factory=dict)


def estimate_tokens(text: str) -> int:
    """Fast approximation of token count (~4 characters per token in English)."""
    if not text:
        return 0
    words = len(text.split())
    chars = len(text)
    # Average between word-based (1.3 tokens/word) and char-based (chars / 4)
    return max(1, int((words * 1.33 + chars / 4.0) / 2))


class DocumentChunker:
    """Markdown heading-aware chunker with sliding window overlap."""

    def __init__(self, target_tokens: int = 500, overlap_tokens: int = 80) -> None:
        self.target_tokens = target_tokens
        self.overlap_tokens = overlap_tokens
        # Target character counts based on ~4 chars per token
        self.target_chars = target_tokens * 4
        self.overlap_chars = overlap_tokens * 4

    def chunk_document(self, text: str) -> list[DocumentChunk]:
        """Split document text into heading-aware chunks with overlap."""
        if not text or not text.strip():
            return []

        # Split text into sections by Markdown headings (# Heading 1, ## Heading 2, etc.)
        sections = self._split_by_headings(text)

        chunks: list[DocumentChunk] = []
        chunk_idx = 0

        for section_path, section_content in sections:
            section_content = section_content.strip()
            if not section_content:
                continue

            section_tokens = estimate_tokens(section_content)

            # If section fits within target size, keep it as single chunk
            if section_tokens <= self.target_tokens:
                chunks.append(
                    DocumentChunk(
                        chunk_index=chunk_idx,
                        content=section_content,
                        token_count=section_tokens,
                        char_count=len(section_content),
                        section_path=section_path,
                    )
                )
                chunk_idx += 1
            else:
                # Subdivide long section with overlap
                sub_chunks = self._sliding_window_split(section_content)
                for sub_content in sub_chunks:
                    tokens = estimate_tokens(sub_content)
                    chunks.append(
                        DocumentChunk(
                            chunk_index=chunk_idx,
                            content=sub_content,
                            token_count=tokens,
                            char_count=len(sub_content),
                            section_path=section_path,
                        )
                    )
                    chunk_idx += 1

        return chunks

    def _split_by_headings(self, text: str) -> list[tuple[str, str]]:
        """Parse markdown text into (section_path, content) tuples."""
        lines = text.split("\n")
        heading_stack: list[tuple[int, str]] = []  # (level, title)
        sections: list[tuple[str, str]] = []

        current_lines: list[str] = []
        heading_pattern = re.compile(r"^(#{1,6})\s+(.+)$")

        for line in lines:
            match = heading_pattern.match(line)
            if match:
                # Flush previous section
                if current_lines:
                    path = " > ".join(title for _, title in heading_stack)
                    content = "\n".join(current_lines).strip()
                    if content:
                        sections.append((path, content))
                    current_lines = []

                level = len(match.group(1))
                title = match.group(2).strip()

                # Pop headings of equal or deeper level
                while heading_stack and heading_stack[-1][0] >= level:
                    heading_stack.pop()
                heading_stack.append((level, title))

                # Include heading in section content
                current_lines.append(line)
            else:
                current_lines.append(line)

        # Flush final section
        if current_lines:
            path = " > ".join(title for _, title in heading_stack)
            content = "\n".join(current_lines).strip()
            if content:
                sections.append((path, content))

        return sections

    def _sliding_window_split(self, text: str) -> list[str]:
        """Split text by paragraphs/sentences with overlap window."""
        paragraphs = [p.strip() for p in text.split("\n\n") if p.strip()]
        if not paragraphs:
            paragraphs = [text]

        sub_chunks: list[str] = []
        current_chunk: list[str] = []
        current_tokens = 0

        for para in paragraphs:
            para_tokens = estimate_tokens(para)

            # If adding paragraph exceeds target and we already have content
            if current_tokens + para_tokens > self.target_tokens and current_chunk:
                chunk_text = "\n\n".join(current_chunk)
                sub_chunks.append(chunk_text)

                # Keep overlap from the end of current chunk (at least 1 paragraph)
                overlap_chunk: list[str] = []
                overlap_tokens = 0
                for prev_para in reversed(current_chunk):
                    prev_tokens = estimate_tokens(prev_para)
                    if not overlap_chunk or (overlap_tokens + prev_tokens <= self.overlap_tokens):
                        overlap_chunk.insert(0, prev_para)
                        overlap_tokens += prev_tokens
                    else:
                        break

                current_chunk = overlap_chunk
                current_tokens = overlap_tokens

            current_chunk.append(para)
            current_tokens += para_tokens

        if current_chunk:
            sub_chunks.append("\n\n".join(current_chunk))

        return sub_chunks
