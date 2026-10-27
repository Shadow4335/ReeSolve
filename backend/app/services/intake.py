"""Report structuring. Keyword rules only (LLM hook is P2)."""
import re
from typing import Any

from app import config


def _has(text: str, kw: str) -> bool:
    return re.search(r"\b" + re.escape(kw), text) is not None


def structure_report(text: str) -> dict[str, Any]:
    """Map free text to {category, severity 1-5, summary} using config keyword lists."""
    low = text.lower()
    best, best_score = "other", 0
    for category, words in config.CATEGORY_KEYWORDS.items():
        score = sum(1 for w in words if _has(low, w))
        if score > best_score:
            best, best_score = category, score
    bumps = sum(1 for w in config.SEVERITY_KEYWORDS if _has(low, w))
    severity = min(config.DEFAULT_SEVERITY + bumps, config.MAX_SEVERITY)
    summary = " ".join(text.split())[: config.SUMMARY_MAX_CHARS]
    return {"category": best, "severity": severity, "summary": summary}
