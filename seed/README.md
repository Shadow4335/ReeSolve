# ReeSolve Seed Dataset (`seed/complaints.json`)

This directory contains the baseline seed dataset for **ReeSolve**, a closed-loop civic complaint platform for Indian smart cities that detects duplicate reports, routes tickets to municipal departments, enforces SLA deadlines, and ensures **a case only closes when evidence confirms it**.

---

## 1. File Structure & Format

`seed/complaints.json` is structured as a single JSON object containing three top-level keys:

```json
{
  "complaints": [ ... ],
  "duplicate_groups": [ ... ],
  "scenarios": [ ... ]
}
```

### 1.1 `complaints` Array
Contains **40 realistic citizen grievances** situated in Delhi NCR across 20+ distinct municipal wards. Each complaint object contains the following attributes:

| Field | Type | Description |
|---|---|---|
| `id` | `string` | Unique complaint identifier formatted as `"C-001"` through `"C-040"`. |
| `text` | `string` | Realistic complaint narrative (1–3 sentences), featuring a realistic mix of formal English, casual Hinglish, and Hindi colloquialisms (`gaddha`, `sadak`, `paani`, `andhera`, `kachra`, `naala`). |
| `ward` | `string` | Municipal administrative ward (e.g., `"Ward 14"`, `"Ward 8"`, `"Ward 22"`). |
| `lat` | `float` | GPS Latitude coordinate within Delhi NCR bounds (`28.52` to `28.72`). |
| `lng` | `float` | GPS Longitude coordinate within Delhi NCR bounds (`77.05` to `77.32`). |
| `created_at` | `string` | ISO 8601 UTC timestamp spread realistically over the past 10 days (`2026-10-18` to `2026-10-27`). |
| `reported_by` | `string` | Fictional citizen reporter name. |
| `category_hint` | `string` | High-level category: `Water Supply`, `Roads & Public Works`, `Electricity`, `Sanitation & Waste`, `Public Safety`, or `Health`. |
| `closure_report` | `object` *(optional)* | Included on the 3 prematurely closed cases (`C-020`, `C-022`, `C-024`). Contains `{"closed_at", "claimed_by", "note"}` documenting the department's claimed resolution. |

### 1.2 `duplicate_groups` Array
Contains **5 groups of 3 complaint IDs** (`[[id1, id2, id3], ...]`) that represent near-duplicate citizen grievances regarding the exact same physical issue and location, submitted using different phrasing and languages.

### 1.3 `scenarios` Array
Lists all 25 benchmark demo cases by `id` with a one-line description detailing the exact behavior and state transition the platform must execute (clustering, SLA escalation, or verification rejection/reopening).

---

## 2. Feature Demonstration Mapping

The dataset is explicitly designed to test and demo the core capabilities of ReeSolve:

### 2.1 Near-Duplicate Detection & Incident Clustering (5 Groups of 3)

When multiple citizens report the same issue, ReeSolve avoids redundant departmental dispatch by computing spatial proximity (Haversine distance `< 100m`) combined with semantic TF-IDF text similarity (threshold `>= 0.55`). The incoming reports are clustered under the master incident, and the incident priority score is incremented.

| Group | IDs | Category | Ward & Landmark | Languages & Phrasing Differences |
|---|---|---|---|---|
| **1** | `C-001`, `C-002`, `C-003` | Roads & Public Works | Ward 14 (Karol Bagh, Arya Samaj Rd, Metro Pillar 112) | **C-001**: Formal English ("massive pothole right opposite Metro Pillar 112... multiple two-wheelers have almost slipped").<br>**C-002**: Colloquial Hinglish ("bohot bada gaddha ho gaya hai... scooty girte girte bachi").<br>**C-003**: Casual English/Hinglish ("Huge road crater... tar is completely eroded and water filling up"). |
| **2** | `C-004`, `C-005`, `C-006` | Water Supply | Ward 8 (Lajpat Nagar II, E-Block Central Market) | **C-004**: Formal English ("Main water pipeline burst... drinking water gushing since 6 AM").<br>**C-005**: Casual Hinglish ("main pipe phat gaya hai, poori sadak par paani beh raha hai... dukaano me paani ghus raha hai").<br>**C-006**: Urgent civic alert ("Severe water pipe leak... tons of fresh paani wasted, Jal Board intervention needed"). |
| **3** | `C-007`, `C-008`, `C-009` | Sanitation & Waste | Ward 22 (Rohini Sector 7 Community Center) | **C-007**: Formal municipal report ("Unattended municipal garbage dump accumulating... foul odor and health hazard").<br>**C-008**: Hinglish grievance ("kachra ka bada dher laga hua hai, 4 din se kachra gaadi nahi aayi... awara kutton ka terror").<br>**C-009**: Casual English ("Rotting solid waste dumped... stray cows and dogs scattering trash"). |
| **4** | `C-010`, `C-011`, `C-012` | Electricity | Ward 17 (Hauz Khas Enclave, Lane 3) | **C-010**: Formal English ("All four consecutive streetlights on Lane 3 are non-operational... completely dark").<br>**C-011**: Hinglish complaint ("saari street lights pichhle 3 din se band padi hain... ladies ka nikalna unsafe ho gaya hai").<br>**C-012**: Urgent safety alert ("Broken streetlamps behind market... total blackout after 7 PM, vulnerable for chain snatchers"). |
| **5** | `C-013`, `C-014`, `C-015` | Sanitation & Waste | Ward 31 (Mayur Vihar Phase 1, Pocket 1 Road) | **C-013**: Formal English ("Blocked stormwater drain overflowing with filthy black sewage... breeding mosquitoes").<br>**C-014**: Casual Hinglish ("naala poori tarah chok ho gaya hai... ganda sewer ka paani sadak pe beh raha hai, bimari ka darr").<br>**C-015**: Commuter impact ("Severe drain choke and sewage overflow... horrible stench, cannot walk to bus stand"). |

---

### 2.2 SLA Tracking & Automated Watchdog Escalation (4 Cases)

ReeSolve monitors unresolved tasks against standard department SLAs (`road_damage`: 144h, `water_leak`: 24h, `drain_blockage`: 48h, `garbage`: 48h, `streetlight`: 72h). When a deadline passes, the background SLA watchdog updates `sla_state` to `BREACHED` and automatically advances the task along the **Escalation Ladder**:
$$\text{Field Team (L0)} \longrightarrow \text{Department Supervisor (L1)} \longrightarrow \text{Department Head (L2)} \longrightarrow \text{Municipal Commissioner (L3)}$$

| ID | Category | Ward & Location | Created At | Base SLA | Elapsed | SLA State & Platform Escalation Action |
|---|---|---|---|---|---|---|
| **`C-016`** | Water Supply | Ward 5 (Civil Lines, Rajpur Rd) | `2026-10-18T08:30:00Z` | 24 hours | ~9 days | **BREACHED**: Water leak unattended for 9 days. Auto-escalates from Field Team past Supervisor directly to **Department Head (Level 2)**. |
| **`C-017`** | Electricity | Ward 19 (Janakpuri, School crossing) | `2026-10-19T10:15:00Z` | 24 hours | ~8 days | **BREACHED**: High-voltage transformer sparking near school gate. Multiplier sets priority to **CRITICAL**; auto-escalates to **Department Head (Level 2)**. |
| **`C-018`** | Sanitation & Waste | Ward 11 (Shahdara, Dispensary) | `2026-10-20T14:45:00Z` | 48 hours | ~7 days | **BREACHED**: Commercial hazardous and poultry waste dumped behind clinic. Auto-escalates to **Department Supervisor (Level 1)** and notifies zonal health officer. |
| **`C-019`** | Roads & Public Works | Ward 27 (Saket, Press Enclave Marg) | `2026-10-19T16:20:00Z` | 144 hours | ~8 days | **BREACHED**: Collapsed storm culvert chasm on arterial road. Overdue past 6-day SLA; auto-escalates to **Municipal Commissioner (Level 3)** for emergency contracting. |

---

### 2.3 Verification Gate & Evidence-Contradicted Closure Reopening (3 Pairs)

A foundational tenet of ReeSolve is: **"A case only closes when evidence confirms it."** When a department technician marks an issue "resolved", the case enters a provisional verification window. If a citizen submits a follow-up complaint or photographic note proving the defect persists, the verification engine:
1. Rejects the department's closure report.
2. Reverts the task state to **`IN_PROGRESS`**.
3. Increments `reopen_count`.
4. Enforces escalation (at `reopen_count >= 2`, forced to Level 2 Department Head).
5. Flags the technician/contractor for potential false resolution audit.

| Case | Original (Closed Ticket) | Closure Claim | Contradicting Citizen Evidence | Platform Action |
|---|---|---|---|---|
| **1** | **`C-020`**<br>(Ward 9, Dwarka Sec 10) | JE Rajesh Kumar claimed:<br>*"Trench backfilled with compacted aggregate and sealed with hot-mix asphalt. Road restored to level grade."* | **`C-021`** (Priya Saxena):<br>*"PWD only dumped loose dry soil without bitumen! The mud sank after rain creating an even deeper crater; photo attached showing car bumper damaged."* | Verification gate detects coordinate match and contradicting photo note. Reopens `C-020`, increments `reopen_count = 1`, and dispatches supervisor audit. |
| **2** | **`C-022`**<br>(Ward 15, Okhla Phase 2) | AE M. P. Sharma claimed:<br>*"Flushed supply line, isolated cross-connection at valve pit 4, and chlorinated storage tanks. Residual chlorine test confirmed potable grade."* | **`C-023`** (Vikram Sethi):<br>*"Paani abhi bhi bilkul kaala aur badboodar aa raha hai! Water test sample photo uploaded showing high turbidity and chemical residue; nobody even came to check our lane."* | Contradicted chemical resolution detected. System reopens task, elevates priority to `HIGH`, and alerts Delhi Jal Board Quality Assurance cell. |
| **3** | **`C-024`**<br>(Ward 3, Connaught Place) | Line Inspector Arvind Tyagi claimed:<br>*"High-voltage cable terminations fully re-insulated with heat-shrink sleeves and enclosed inside locked weather-proof junction cabinet."* | **`C-025`** (Sunita Deshmukh):<br>*"False closure filed! Inspector just threw a soggy cardboard carton over live 440V wires near Regal bus shelter. Wires are totally naked in the rain; photo attached showing sparks flying."* | Critical safety hazard contradiction. Platform instantly reopens task, flags contractor for fraudulent closure, and dispatches emergency safety crew. |

---

### 2.4 Baseline Incidents & Ward Coverage (Complaints `C-026` to `C-040`)

The remaining 15 complaints supply realistic baseline density across Delhi NCR municipal wards and cover all primary civic services:

- **Public Safety**: Blind curve tree hazard in Vasant Kunj (`C-026`), missing manhole cover in Pitampura (`C-030`), jagged rusted pedestrian guardrail in South Extension (`C-035`), fire exit lane barricade obstruction in Shalimar Bagh (`C-040`).
- **Health**: Dengue breeding swamp in Paschim Vihar (`C-027`), rancid food stall drain dumping in Chandni Chowk (`C-031`), uncollected animal carcass in Model Town (`C-037`).
- **Roads & Public Works**: Broken footpath tiles at Preet Vihar metro station (`C-028`), unpainted hazardous speed bump in Rajouri Garden (`C-036`).
- **Electricity**: Dangerous strobe-flickering high mast tower in Punjabi Bagh (`C-033`), leaning 30-degree electric pole in Defence Colony (`C-038`).
- **Water Supply**: Sluice valve leak in Kalkaji (`C-039`), booster pump flooding at Malviya Nagar (`C-032`).
- **Sanitation & Waste**: Construction debris dumping in Greater Kailash 1 (`C-029`), overflowing market dhalao in Laxmi Nagar (`C-034`).

---

## 3. Integration with ReeSolve Backend

This dataset is directly consumed by `backend/scripts/seed.py`:

```python
import json
from pathlib import Path
from app.services.reports import submit_report

def seed(db):
    data_path = Path(__file__).resolve().parent.parent.parent / "seed" / "complaints.json"
    with open(data_path, "r", encoding="utf-8") as f:
        data = json.load(f)
        
    for item in data["complaints"]:
        submit_report(
            db=db,
            text=item["text"],
            lat=item["lat"],
            lng=item["lng"],
            ward=item["ward"],
            reported_by=item["reported_by"],
            created_at=item["created_at"],
            category_hint=item["category_hint"]
        )
```

The database initialization ensures all 40 complaints are ingested through the official domain services, creating the corresponding `Report`, `Incident`, `Task`, and `Event` audit logs.

