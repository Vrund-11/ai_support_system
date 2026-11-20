"""Text extraction and cleaning for knowledge base ingestion."""

import re
import unicodedata


def clean_text(raw_text: str) -> str:
    """Normalize and clean raw document text for ingestion."""
    if not raw_text:
        return ""

    # Normalize Unicode (NFC)
    text = unicodedata.normalize("NFC", raw_text)

    # Strip null bytes and control characters except newlines/tabs
    text = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]", "", text)

    # Normalize line endings to \n
    text = text.replace("\r\n", "\n").replace("\r", "\n")

    # Collapse excessive vertical whitespace (max 2 consecutive newlines)
    text = re.sub(r"\n{3,}", "\n\n", text)

    return text.strip()
