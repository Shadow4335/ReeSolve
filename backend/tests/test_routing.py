"""Tests for rule-based department routing and priority scoring services.

Covers:
- Department routing for each supported department
- Indian-English complaint phrases
- Case-insensitivity in keyword matching
- Confidence calculation and multi-department matches
- Fallback to 'General' on no match or empty input
- Minimum keyword dictionary size per department (at least 12 keywords)
- Priority scoring across all priority bands (LOW, MEDIUM, HIGH, CRITICAL)
- Days open point calculation and the 30-point cap
- Repeated complaint indicators ('again', 'still', 'third time')
- Human-readable explanatory reasons population
"""

import pytest

from app.services.routing import (
    DEPARTMENT_KEYWORDS,
    route_department,
    score_priority,
)


# ============================================================================
# Department Routing Tests
# ============================================================================


def test_route_water_supply() -> None:
    """Verify that complaints regarding water issues route to Water Supply."""
    complaint = "There is no water supply in our colony since yesterday morning"
    result = route_department(complaint)

    assert result["department"] == "Water Supply"
    assert result["confidence"] == 1.0
    assert "no water supply" in result["matched_keywords"]


def test_route_roads_and_public_works() -> None:
    """Verify that pothole and road damage complaints route to Roads & Public Works."""
    complaint = "Huge pothole on the main road causing severe traffic jam"
    result = route_department(complaint)

    assert result["department"] == "Roads & Public Works"
    assert result["confidence"] == 1.0
    assert "pothole" in result["matched_keywords"]


def test_route_electricity() -> None:
    """Verify that streetlight and power cut complaints route to Electricity."""
    complaint = "Streetlight is not working and frequent power cut in our street"
    result = route_department(complaint)

    assert result["department"] == "Electricity"
    assert result["confidence"] == 1.0
    assert "streetlight" in result["matched_keywords"]
    assert "power cut" in result["matched_keywords"]


def test_route_sanitation_and_waste() -> None:
    """Verify that uncollected waste and open drain complaints route to Sanitation & Waste."""
    complaint = "Garbage not collected for five days and open drain is overflowing"
    result = route_department(complaint)

    assert result["department"] == "Sanitation & Waste"
    assert result["confidence"] == 1.0
    assert "garbage not collected" in result["matched_keywords"]
    assert "open drain" in result["matched_keywords"]


def test_route_public_safety() -> None:
    """Verify that stray dog menace and public safety issues route to Public Safety."""
    complaint = "Pack of stray dogs attacking pedestrians and aggressive dog bite risk"
    result = route_department(complaint)

    assert result["department"] == "Public Safety"
    assert result["confidence"] == 1.0
    assert "stray dogs" in result["matched_keywords"]


def test_route_health() -> None:
    """Verify that mosquito breeding and disease vector complaints route to Health."""
    complaint = "Heavy mosquito breeding in stagnant water leading to dengue outbreak"
    result = route_department(complaint)

    assert result["department"] == "Health"
    assert result["confidence"] == 1.0
    assert "mosquito" in result["matched_keywords"]
    assert "dengue" in result["matched_keywords"]


def test_route_general_fallback_unmatched_text() -> None:
    """Verify that text with no matching keywords falls back to General with 0.0 confidence."""
    complaint = "Lorem ipsum dolor sit amet consectetur adipiscing elit"
    result = route_department(complaint)

    assert result["department"] == "General"
    assert result["confidence"] == 0.0
    assert result["matched_keywords"] == []


def test_route_general_fallback_empty_or_whitespace() -> None:
    """Verify that empty string or whitespace falls back to General with 0.0 confidence."""
    assert route_department("") == {
        "department": "General",
        "confidence": 0.0,
        "matched_keywords": [],
    }
    assert route_department("   \n\t  ") == {
        "department": "General",
        "confidence": 0.0,
        "matched_keywords": [],
    }


def test_route_case_insensitivity() -> None:
    """Verify that keyword matching is completely case-insensitive."""
    upper_result = route_department("DANGEROUS POTHOLE NEAR SCHOOL")
    mixed_result = route_department("Frequent PoWeR CuT in our sector")

    assert upper_result["department"] == "Roads & Public Works"
    assert "pothole" in upper_result["matched_keywords"]

    assert mixed_result["department"] == "Electricity"
    assert "power cut" in mixed_result["matched_keywords"]


def test_route_confidence_with_competing_departments() -> None:
    """Verify confidence calculation when keywords from multiple departments match."""
    # Matches 'pothole' (Roads & Public Works) and 'water leakage' (Water Supply)
    complaint = "Pothole filled with water leakage near junction"
    result = route_department(complaint)

    assert result["department"] in ("Roads & Public Works", "Water Supply")
    assert 0.0 < result["confidence"] <= 1.0
    # Both departments matched 1 keyword each -> total matches = 2 -> confidence = 0.5
    assert result["confidence"] == 0.5
    assert len(result["matched_keywords"]) == 1


def test_department_keywords_minimum_count() -> None:
    """Verify that every department has at least 12 keywords defined in the dictionary."""
    expected_departments = [
        "Water Supply",
        "Roads & Public Works",
        "Electricity",
        "Sanitation & Waste",
        "Public Safety",
        "Health",
        "General",
    ]
    for dept in expected_departments:
        assert dept in DEPARTMENT_KEYWORDS, f"Missing department: {dept}"
        assert len(DEPARTMENT_KEYWORDS[dept]) >= 12, (
            f"Department '{dept}' has {len(DEPARTMENT_KEYWORDS[dept])} keywords, expected at least 12"
        )


# ============================================================================
# Priority Scoring Tests
# ============================================================================


def test_score_priority_low_band() -> None:
    """Verify that standard complaint with no urgency or delays scores in the LOW band (< 20)."""
    complaint = "Street name board is faded"
    result = score_priority(complaint, days_open=0)

    assert result["priority"] == "LOW"
    assert result["score"] == 0
    assert len(result["reasons"]) > 0
    assert isinstance(result["reasons"][0], str)


def test_score_priority_medium_band() -> None:
    """Verify that single urgent factor or moderate duration maps to MEDIUM band (>= 20, < 45)."""
    # 1 urgent keyword ('accident') -> 30 pts -> MEDIUM band
    result = score_priority("Risk of vehicle accident near turn", days_open=0)
    assert result["priority"] == "MEDIUM"
    assert result["score"] == 30
    assert any("accident" in r.lower() for r in result["reasons"])

    # 0 keywords, 7 days open -> 21 pts -> MEDIUM band
    result_days = score_priority("Minor signage issue", days_open=7)
    assert result_days["priority"] == "MEDIUM"
    assert result_days["score"] == 21


def test_score_priority_high_band() -> None:
    """Verify that urgent keyword + days open maps to HIGH band (>= 45, < 70)."""
    # 1 urgent keyword ('sewage overflow', 30 pts) + 5 days open (15 pts) = 45 pts -> HIGH
    result = score_priority("Severe sewage overflow outside hospital", days_open=5)

    assert result["priority"] == "HIGH"
    assert result["score"] == 45
    assert any("sewage overflow" in r.lower() for r in result["reasons"])
    assert any("5 day(s)" in r for r in result["reasons"])


def test_score_priority_critical_band() -> None:
    """Verify that multiple severe hazards map to CRITICAL band (>= 70)."""
    # 'live wire' (30 pts) + 'fire' (30 pts) + 'child' (30 pts) = 90 pts -> CRITICAL
    complaint = "Live wire sparking causing fire where a child was playing"
    result = score_priority(complaint, days_open=0)

    assert result["priority"] == "CRITICAL"
    assert result["score"] == 90
    assert any("live wire" in r.lower() for r in result["reasons"])
    assert any("fire" in r.lower() for r in result["reasons"])
    assert any("child" in r.lower() for r in result["reasons"])


def test_score_priority_days_open_cap() -> None:
    """Verify that days open adds 3 points per day up to a strict cap of 30 points."""
    # 0 days -> 0 pts
    assert score_priority("Road issue", days_open=0)["score"] == 0

    # 4 days -> 12 pts
    assert score_priority("Road issue", days_open=4)["score"] == 12

    # 10 days -> 30 pts (reaches cap)
    assert score_priority("Road issue", days_open=10)["score"] == 30

    # 15 days -> 30 pts (capped)
    assert score_priority("Road issue", days_open=15)["score"] == 30

    # 40 days -> 30 pts (capped)
    assert score_priority("Road issue", days_open=40)["score"] == 30

    # Negative days -> 0 pts
    assert score_priority("Road issue", days_open=-5)["score"] == 0


def test_score_priority_repeated_words() -> None:
    """Verify that repeated words like 'again', 'still', 'third time' add points and reasons."""
    # 'again' (+15 pts) + 'third time' (+15 pts) = 30 pts -> MEDIUM
    complaint = "Complaining for the third time, problem occurred again"
    result = score_priority(complaint, days_open=0)

    assert result["priority"] == "MEDIUM"
    assert result["score"] == 30
    assert any("third time" in r.lower() for r in result["reasons"])
    assert any("again" in r.lower() for r in result["reasons"])


def test_score_priority_reasons_always_populated() -> None:
    """Verify that reasons list is never empty, even for score 0."""
    result = score_priority("Plain normal text with no indicators", days_open=0)

    assert isinstance(result["reasons"], list)
    assert len(result["reasons"]) >= 1
    assert all(isinstance(r, str) and len(r.strip()) > 0 for r in result["reasons"])


def test_score_priority_score_clamped_at_100() -> None:
    """Verify that the maximum priority score cannot exceed 100."""
    # Many urgent words + repeated words + max days open
    complaint = (
        "Accident with serious injury and fire, live wire down, "
        "flooding and sewage overflow, reported again for the third time"
    )
    result = score_priority(complaint, days_open=25)

    assert result["score"] == 100
    assert result["priority"] == "CRITICAL"
