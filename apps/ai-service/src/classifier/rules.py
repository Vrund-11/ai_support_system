"""Keyword and pattern based rules fallback for Ticket Classification (AI-4).

Used when the ML model artifact is unavailable, offline, or confidence is below threshold.
Keywords:
- Outage, crash, data breach, emergency, downtime -> URGENT
- Refund, double charged, cannot log in, locked out -> HIGH
- Billing, invoice, card, subscription -> billing
- Error, bug, 500, exception, broken -> bug
- How to, setup, configure, guide -> how-to
- Password, 2fa, sso, account -> account
- Feature request, please add, suggestion -> feature request
"""

import re
from typing import NamedTuple

VALID_PRIORITIES = {"LOW", "MEDIUM", "HIGH", "URGENT"}
VALID_CATEGORIES = {"billing", "bug", "how-to", "account", "feature request", "other"}


class RulePrediction(NamedTuple):
    priority: str
    category: str
    confidence: float
    matched_rules: list[str]


# Priority Keyword Patterns
URGENT_PATTERNS = [
    r"\boutage\b",
    r"\bdown\b",
    r"\bemergency\b",
    r"\bbreach\b",
    r"\bvulnerability\b",
    r"\bdata loss\b",
    r"\bexploit\b",
    r"\ball (users|services|tenants) (down|offline|blocked)\b",
    r"\bcritical failure\b",
    r"\bproduction (down|crash|freeze)\b",
]

HIGH_PATTERNS = [
    r"\brefund\b",
    r"\bcharged twice\b",
    r"\bdouble charge\b",
    r"\bcannot log in\b",
    r"\blocked out\b",
    r"\b2fa lost\b",
    r"\bpayment failed\b",
    r"\bunauthorized\b",
    r"\bdispute\b",
    r"\bdeadline\b",
    r"\bbroken\b",
    r"\bblank screen\b",
    r"\bwhite screen\b",
    r"\b500 error\b",
    r"\btimeout\b",
]

LOW_PATTERNS = [
    r"\btypo\b",
    r"\bcosmetic\b",
    r"\bswag\b",
    r"\bcongratulations\b",
    r"\bspelling\b",
    r"\bicon alignment\b",
    r"\bwhen convenient\b",
    r"\bno rush\b",
    r"\bminor visual\b",
]

# Category Keyword Patterns
CATEGORY_PATTERNS: dict[str, list[str]] = {
    "billing": [
        r"\bbill(ing)?\b",
        r"\binvoice\b",
        r"\bpayment\b",
        r"\bcredit card\b",
        r"\bdebit\b",
        r"\bcharge(d)?\b",
        r"\brefund\b",
        r"\bsubscription\b",
        r"\bvat\b",
        r"\btax\b",
        r"\bpricing\b",
        r"\breceipt\b",
    ],
    "bug": [
        r"\bbug\b",
        r"\berror\b",
        r"\bcrash(ed|ing)?\b",
        r"\bexception\b",
        r"\bfail(ed|ing|ure)?\b",
        r"\b500\b",
        r"\b503\b",
        r"\bbroken\b",
        r"\bleak\b",
        r"\bglitch\b",
        r"\bblank screen\b",
        r"\bwhite screen\b",
        r"\boutage\b",
        r"\bdown\b",
        r"\bdatabase\b",
        r"\bserver\b",
    ],
    "account": [
        r"\bpassword\b",
        r"\b2fa\b",
        r"\bmfa\b",
        r"\bsso\b",
        r"\bsaml\b",
        r"\bokta\b",
        r"\blogin\b",
        r"\blog in\b",
        r"\blocked out\b",
        r"\baccount\b",
        r"\bprofile\b",
        r"\bcredential(s)?\b",
    ],
    "how-to": [
        r"\bhow to\b",
        r"\bhow do i\b",
        r"\bwhere can i\b",
        r"\bsetup\b",
        r"\bset up\b",
        r"\bconfigure\b",
        r"\bguide\b",
        r"\binstructions\b",
        r"\bwalkthrough\b",
        r"\bdocumentation\b",
        r"\bdocs\b",
    ],
    "feature request": [
        r"\bfeature request\b",
        r"\bwould love\b",
        r"\bplease add\b",
        r"\bsuggestion\b",
        r"\bwishlist\b",
        r"\broadmap\b",
        r"\benhancement\b",
        r"\bintegrat(e|ion)\b",
        r"\bdark mode\b",
    ],
    "other": [
        r"\bpartner(ship)?\b",
        r"\bpress\b",
        r"\blegal\b",
        r"\bsubpoena\b",
        r"\bconference\b",
        r"\bkeynote\b",
        r"\binterview\b",
        r"\bswag\b",
        r"\bhackathon\b",
        r"\bfeedback\b",
    ],
}


def classify_by_rules(text: str) -> RulePrediction:
    """Classifies ticket text using priority and category heuristic rules."""
    text_lower = text.lower()
    matched_rules: list[str] = []

    # 1. Determine Priority
    priority = "MEDIUM"
    prio_confidence = 0.60

    for pat in URGENT_PATTERNS:
        if re.search(pat, text_lower):
            priority = "URGENT"
            prio_confidence = 0.90
            matched_rules.append(f"priority_urgent:{pat}")
            break

    if priority == "MEDIUM":
        for pat in HIGH_PATTERNS:
            if re.search(pat, text_lower):
                priority = "HIGH"
                prio_confidence = 0.80
                matched_rules.append(f"priority_high:{pat}")
                break

    if priority == "MEDIUM":
        for pat in LOW_PATTERNS:
            if re.search(pat, text_lower):
                priority = "LOW"
                prio_confidence = 0.75
                matched_rules.append(f"priority_low:{pat}")
                break

    # 2. Determine Category
    category_scores: dict[str, int] = {c: 0 for c in CATEGORY_PATTERNS}
    for cat, patterns in CATEGORY_PATTERNS.items():
        for pat in patterns:
            if re.search(pat, text_lower):
                category_scores[cat] += 1
                matched_rules.append(f"category_{cat}:{pat}")

    best_cat = max(category_scores.items(), key=lambda x: x[1])
    if best_cat[1] > 0:
        category = best_cat[0]
        cat_confidence = min(0.65 + best_cat[1] * 0.10, 0.95)
    else:
        category = "other"
        cat_confidence = 0.50

    # Composite rule confidence
    overall_confidence = round((prio_confidence + cat_confidence) / 2.0, 2)

    return RulePrediction(
        priority=priority,
        category=category,
        confidence=overall_confidence,
        matched_rules=matched_rules,
    )
