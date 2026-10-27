"""All thresholds, SLA tables, department maps and related-category rules (CONTEXT.md section 4)."""

# --- 4.1 categories -> departments -------------------------------------------------
CATEGORIES = ["road_damage", "water_leak", "drain_blockage", "garbage", "streetlight", "other"]

DEPARTMENTS = [
    {"code": "ROADS", "name": "Roads & Infrastructure"},
    {"code": "WATER", "name": "Water & Sewerage"},
    {"code": "DRAIN", "name": "Drainage"},
    {"code": "SANI", "name": "Sanitation"},
    {"code": "ELEC", "name": "Electrical"},
]

CATEGORY_TO_DEPT = {
    "road_damage": "ROADS",
    "water_leak": "WATER",
    "drain_blockage": "DRAIN",
    "garbage": "SANI",
    "streetlight": "ELEC",
    "other": "SANI",
}

ESCALATION_LEVELS = ["Field Team", "Department Supervisor", "Department Head", "Municipal Commissioner"]
MAX_ESCALATION_LEVEL = 3

# --- 4.2 priority -------------------------------------------------------------------
REPORT_COUNT_CAP = 10
VULNERABLE_ZONE_BONUS = 3
PRIORITY_THRESHOLDS = [("CRITICAL", 18), ("HIGH", 12), ("MEDIUM", 7)]  # else LOW
PRIORITY_ORDER = ["LOW", "MEDIUM", "HIGH", "CRITICAL"]

# --- 4.3 SLA ------------------------------------------------------------------------
BASE_SLA_HOURS = {
    "road_damage": 144,
    "water_leak": 24,
    "drain_blockage": 48,
    "garbage": 48,
    "streetlight": 72,
    "other": 72,
}
PRIORITY_MULTIPLIER = {"CRITICAL": 0.25, "HIGH": 0.5, "MEDIUM": 1.0, "LOW": 1.5}
SLA_WARNING_FRACTION = 0.8
ESCALATION_INTERVAL_FRACTION = 0.5
REOPEN_SLA_FRACTION = 0.5
REPEATED_REOPEN_THRESHOLD = 2   # reopen_count at which escalation is forced
REPEATED_REOPEN_MIN_LEVEL = 2   # ... to at least this level

# --- 4.4 dedup / cluster ------------------------------------------------------------
DEDUP_WINDOW_DAYS = 14
POST_CLOSURE_WINDOW_DAYS = 14
DUP_RADIUS_M = 100
DUP_HARD_RADIUS_M = 25
DUP_THRESHOLD = 0.55
DUP_GEO_WEIGHT = 0.6
DUP_TEXT_WEIGHT = 0.4
RELATED_RADIUS_M = 150
RELATED_WINDOW_DAYS = 7

# --- 4.5 related-category rules -----------------------------------------------------
# (upstream_category, downstream_category, downstream_blocked_until_upstream_closed)
RELATED_RULES = [
    ("water_leak", "road_damage", True),
    ("drain_blockage", "road_damage", True),
    ("garbage", "drain_blockage", False),
    ("water_leak", "drain_blockage", False),
]

# --- 4.6 verification ---------------------------------------------------------------
VERIFY_WINDOW_HOURS = 48
VERIFY_QUORUM_FRACTION = 0.5
CLOSURE_GEO_TOLERANCE_M = 150
MAX_VERIFICATION_REQUESTS = 5
CLOSURE_NOTE_MIN_CHARS = 5

# --- 4.7 watchdog -------------------------------------------------------------------
WATCHDOG_INTERVAL_SECONDS = 5

# --- 4.8 intake keyword fallback ----------------------------------------------------
CATEGORY_KEYWORDS = {
    "road_damage": ["pothole", "road", "crack", "gadda", "gaddha", "asphalt", "sadak", "tar"],
    "water_leak": ["leak", "pipe", "burst", "water", "paani", "pani", "tap"],
    "drain_blockage": ["drain", "sewer", "clog", "overflow", "nala", "naala", "gutter", "blocked"],
    "garbage": ["garbage", "trash", "waste", "dump", "kachra", "litter", "rubbish"],
    "streetlight": ["streetlight", "street light", "light", "lamp", "dark", "bijli", "andhera"],
}
SEVERITY_KEYWORDS = ["accident", "dangerous", "hospital", "school", "flood", "overflow"]
DEFAULT_SEVERITY = 3
MAX_SEVERITY = 5
SUMMARY_MAX_CHARS = 120

# --- 4.9 demo geography -------------------------------------------------------------
# Real New Delhi geography. DEMO_CENTER is the map's default view (Central New Delhi, Sansad Marg / Patel Chowk).
DEMO_CENTER = (28.6192, 77.2090)
# Where the live storyline happens: Gurudwara Bangla Sahib on Ashoka Road, ~800 m north of DEMO_CENTER.
DEMO_SCENARIO_ORIGIN = (28.6264, 77.2090)
SEED_MIN_DISTANCE_FROM_SCENARIO_M = 500

# Vulnerable zones (hospital, school): real institutions, kept well clear of DEMO_SCENARIO_ORIGIN.
VULNERABLE_ZONES = [
    {"name": "Dr Ram Manohar Lohia Hospital", "lat": 28.6256, "lng": 77.2000, "radius_m": 200},
    {"name": "Modern School, Barakhamba Road", "lat": 28.6305, "lng": 77.2258, "radius_m": 150},
]

DB_URL = "sqlite:///./reesolve.db"
CORS_ORIGINS = ["http://localhost:5173"]
