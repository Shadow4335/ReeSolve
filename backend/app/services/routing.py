"""Rule-based routing and priority scoring for citizen complaints.

This module provides pure functions to:
1. Route complaints to the appropriate city department based on keyword matching.
2. Calculate priority scores and bands using urgency indicators, repeated complaint markers,
   and open duration.

No database, network calls, or mutable global state are used.
"""

from typing import Any
import re

# Comprehensive keyword dictionary per department with at least 12 keywords each,
# including common Indian-English complaint terms and phrases.
DEPARTMENT_KEYWORDS: dict[str, list[str]] = {
    "Water Supply": [
        "no water supply",
        "water supply",
        "water leakage",
        "pipe burst",
        "water contamination",
        "dirty water",
        "low water pressure",
        "water tanker",
        "broken pipe",
        "water shortage",
        "drinking water",
        "water pipeline",
        "borewell",
        "tap water",
        "water cut",
    ],
    "Roads & Public Works": [
        "pothole",
        "broken road",
        "damaged road",
        "pavement",
        "footpath",
        "road repair",
        "crater",
        "speed breaker",
        "traffic signal",
        "flyover",
        "divider",
        "manhole cover",
        "road cave in",
        "asphalt",
        "zebra crossing",
    ],
    "Electricity": [
        "streetlight",
        "street light",
        "power cut",
        "load shedding",
        "electricity outage",
        "live wire",
        "hanging wire",
        "transformer",
        "sparking",
        "fluctuating voltage",
        "meter fault",
        "electric pole",
        "power outage",
        "short circuit",
        "blown fuse",
    ],
    "Sanitation & Waste": [
        "garbage not collected",
        "garbage dump",
        "open drain",
        "drainage",
        "clogged drain",
        "sewage overflow",
        "waste disposal",
        "trash pile",
        "littering",
        "dustbin overflowing",
        "cleaning required",
        "blocked sewer",
        "debris",
        "stench",
        "filth",
    ],
    "Public Safety": [
        "stray dogs",
        "stray dog",
        "dog bite",
        "illegal parking",
        "encroachment",
        "open manhole",
        "fallen tree",
        "hazardous",
        "vandalism",
        "noise pollution",
        "loudspeaker",
        "rash driving",
        "unauthorized construction",
        "unsafe building",
        "public nuisance",
    ],
    "Health": [
        "mosquito",
        "mosquitoes",
        "dengue",
        "malaria",
        "fogging",
        "vector borne",
        "food poisoning",
        "unhygienic food",
        "epidemic",
        "pest infestation",
        "stagnant water",
        "dispensary",
        "waterborne disease",
        "dead animal",
        "carcass",
    ],
    "General": [
        "general inquiry",
        "general issue",
        "other issue",
        "miscellaneous",
        "unspecified",
        "not listed",
        "portal feedback",
        "general grievance",
        "general assistance",
        "website query",
        "general support",
        "general complaint",
    ],
}

# Urgent word patterns and labels (adds 30 points per unique matched urgent condition)
URGENT_PATTERNS: tuple[tuple[str, str], ...] = (
    ("accident", r"\baccidents?\b"),
    ("live wire", r"\blive wires?\b"),
    ("sewage overflow", r"\bsewage overflow\b"),
    ("fire", r"\bfires?\b"),
    ("flooding", r"\bflood(ing)?\b"),
    ("injury", r"\binjur(y|ies)\b"),
    ("child", r"\bchild(ren)?\b"),
    ("emergency", r"\bemergenc(y|ies)\b"),
    ("electrocution", r"\belectrocution\b"),
    ("gas leak", r"\bgas leaks?\b"),
    ("explosion", r"\bexplosions?\b"),
    ("collapse", r"\bcollapse(d)?\b"),
    ("casualty", r"\bcasualt(y|ies)\b"),
    ("hazard", r"\bhazards?\b"),
)

# Repeated complaint patterns and labels (adds 15 points per unique matched repeated indicator)
REPEATED_PATTERNS: tuple[tuple[str, str], ...] = (
    ("third time", r"\bthird time\b"),
    ("second time", r"\bsecond time\b"),
    ("multiple times", r"\bmultiple times\b"),
    ("again", r"\bagain\b"),
    ("still", r"\bstill\b"),
    ("repeatedly", r"\brepeatedly\b"),
    ("not resolved", r"\bnot resolved\b"),
    ("unresolved", r"\bunresolved\b"),
    ("no action taken", r"\bno action taken\b"),
    ("reminder", r"\breminders?\b"),
)


def route_department(text: str) -> dict[str, Any]:
    """Route a citizen complaint description to the appropriate department.

    Matches text against department keywords in a case-insensitive manner.
    Confidence is calculated as the number of matched keywords of the winning
    department divided by total keyword matches across all departments (capped at 1.0).
    If no keywords match, returns 'General' with a confidence of 0.0.

    Args:
        text: The complaint description string.

    Returns:
        dict with:
            - department (str): Winning department name or 'General'.
            - confidence (float): Score between 0.0 and 1.0.
            - matched_keywords (list[str]): List of keywords matched for the winning department.
    """
    if not text or not text.strip():
        return {
            "department": "General",
            "confidence": 0.0,
            "matched_keywords": [],
        }

    text_lower = text.lower()
    matches_by_dept: dict[str, list[str]] = {}

    for dept, keywords in DEPARTMENT_KEYWORDS.items():
        matched: list[str] = [kw for kw in keywords if kw.lower() in text_lower]
        matches_by_dept[dept] = matched

    total_matches = sum(len(kws) for kws in matches_by_dept.values())
    if total_matches == 0:
        return {
            "department": "General",
            "confidence": 0.0,
            "matched_keywords": [],
        }

    # Evaluate non-General departments first
    non_general_depts = [d for d in DEPARTMENT_KEYWORDS if d != "General"]
    best_dept = max(non_general_depts, key=lambda d: len(matches_by_dept[d]))

    # Fall back to General if only General keywords matched
    if len(matches_by_dept[best_dept]) == 0 and len(matches_by_dept["General"]) > 0:
        best_dept = "General"

    winning_matches = matches_by_dept[best_dept]
    if not winning_matches:
        return {
            "department": "General",
            "confidence": 0.0,
            "matched_keywords": [],
        }

    confidence = min(1.0, len(winning_matches) / total_matches)

    return {
        "department": best_dept,
        "confidence": float(confidence),
        "matched_keywords": winning_matches,
    }


def score_priority(text: str, days_open: int = 0) -> dict[str, Any]:
    """Score complaint urgency and map to a priority band with explanatory reasons.

    Scoring rules:
    - Urgent words (e.g. accident, live wire, sewage overflow, fire, flooding, injury, child)
      add 30 points each.
    - Repeated words (e.g. again, still, third time) add 15 points each.
    - Each day open adds 3 points, up to a cap of 30 points.
    - Score is clamped between 0 and 100.
    - Priority bands: >=70 CRITICAL, >=45 HIGH, >=20 MEDIUM, else LOW.
    - 'reasons' is always populated with human-readable explanatory strings.

    Args:
        text: The citizen complaint text.
        days_open: Number of days the complaint has remained unresolved (default: 0).

    Returns:
        dict with:
            - priority (str): 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'.
            - score (int): Priority score between 0 and 100.
            - reasons (list[str]): Human-readable explanations for the score.
    """
    score = 0
    reasons: list[str] = []
    text_lower = text.lower() if text else ""

    # Check urgent keyword patterns
    for label, pattern in URGENT_PATTERNS:
        if re.search(pattern, text_lower):
            score += 30
            reasons.append(f"Urgent condition detected: '{label}' (+30 pts)")

    # Check repeated complaint patterns
    for label, pattern in REPEATED_PATTERNS:
        if re.search(pattern, text_lower):
            score += 15
            reasons.append(f"Repeated complaint indicator: '{label}' (+15 pts)")

    # Add points for duration open (3 points per day, capped at 30)
    effective_days = max(0, days_open)
    if effective_days > 0:
        days_points = min(30, effective_days * 3)
        score += days_points
        reasons.append(f"Complaint open for {effective_days} day(s) (+{days_points} pts)")

    # Clamp score to 0-100 range
    final_score = max(0, min(100, score))

    # Determine priority band
    if final_score >= 70:
        priority = "CRITICAL"
    elif final_score >= 45:
        priority = "HIGH"
    elif final_score >= 20:
        priority = "MEDIUM"
    else:
        priority = "LOW"

    # Ensure reasons is always populated
    if not reasons:
        reasons.append("Standard priority complaint with no urgent or repeated factors detected")

    return {
        "priority": priority,
        "score": final_score,
        "reasons": reasons,
    }
