# ReeSolve — 3-Minute Live Demo Script for Judges

> **Hackathon Track:** Problem 8 — *Smart Cities: From Citizen Reports to Verified Resolution*  
> **Target Duration:** Exactly 3 minutes (180 seconds)  
> **Core Value Proposition:** Civic grievance systems in Indian cities fail because they are unverified black holes. ReeSolve enforces one golden rule: **"A case only closes when evidence confirms it."**

---

## Pre-Demo Checklist (60 Seconds Before Pitch)

- [ ] Backend server running on `http://localhost:8000`
- [ ] Frontend running on `http://localhost:5173`
- [ ] Seed data loaded (`POST http://localhost:8000/admin/reset` followed by `POST http://localhost:8000/admin/seed`)
- [ ] Browser tabs arranged in order:
  1. **Tab 1:** `http://localhost:5173/` (Citizen Portal / Report Complaint)
  2. **Tab 2:** `http://localhost:5173/admin` (Executive Map & Live Feed)
  3. **Tab 3:** `http://localhost:5173/department` (Department Work Queue)
  4. **Tab 4:** `http://localhost:5173/track/C-020` (Case Verification & Timeline)

---

## Quick Reference Table of Featured Complaint IDs

| Feature | Primary ID | Related / Refuting IDs | Location | Key Takeaway |
|---|---|---|---|---|
| **Duplicate Clustering** | `C-001` (Formal English) | `C-002` (Hinglish), `C-003` (Casual) | Ward 14 (Karol Bagh) | Deduplicates cross-lingual reports within 30m; boosts priority instead of creating duplicate work. |
| **SLA Breach & Escalation** | `C-016` (Water Leak) | `C-017` (High-Voltage Spark) | Ward 5 (Civil Lines) & Ward 19 (Janakpuri) | Unattended 9 days past 24h SLA; auto-escalates to Department Head (Level 2). |
| **Contradicted Closure** | `C-020` (PWD Closed) | `C-021` (Citizen Photo Evidence) | Ward 9 (Dwarka Sec 10) | JE claimed asphalt road fix; citizen photo proved loose mud. System reopens ticket and flags fraud. |
| **Safety Hazard Reopen** | `C-024` (BSES Closed) | `C-025` (Citizen Photo Note) | Ward 3 (Connaught Place) | Contractor covered 440V wires with wet cardboard; auto-reopened to Critical priority. |

---

## Minute-by-Minute Demo Flow

```
[0:00 ─── 0:25]  ACT 1: The Civic Black Hole & The ReeSolve Rule
[0:25 ─── 1:05]  ACT 2: Multilingual Near-Duplicate Clustering
[1:05 ─── 1:50]  ACT 3: SLA Watchdog & Automated Escalation
[1:50 ─── 2:35]  ACT 4: The Closed Loop — Reopening False Closures
[2:35 ─── 3:00]  ACT 5: Executive Map, Analytics & Impact
```

---

### Act 1: The Problem & The Core Rule (0:00 – 0:25 | 25 seconds)

**Screen:** Tab 1 — Citizen Portal / Live Landing Page (`/`)

#### Presenter Action
Stand center stage. Point to the landing page banner showing the tagline: *"From Citizen Reports to Verified Resolution"*.

#### Talking Points
> "Good evening judges. Municipal helplines in Indian cities aren’t failing because citizens don’t report problems—they fail because existing systems are **unverified black holes**.
> 
> When a main pipeline bursts or a road craters, fifty citizens submit duplicate complaints in English and Hinglish, flooding department queues. Contractors mark tickets 'Resolved' with fake closure notes without fixing a single brick. And critical SLAs lapse unnoticed.
> 
> We built **ReeSolve** around one unbreakable rule:  
> **A case only closes when evidence confirms it.**  
> Let me show you how it works live."

---

### Act 2: Multilingual Near-Duplicate Clustering (0:25 – 1:05 | 40 seconds)

**Screen:** Tab 1 (Report Form) $\rightarrow$ Tab 2 (Admin Live Feed & Map)

#### Presenter Action
1. Open Admin Map, zoom in on **Ward 14 (Karol Bagh)**, clicking on complaint **`C-001`**.
2. Switch to Citizen Report Form, paste in text for **`C-002`**, select Ward 14, and click **Submit**.
3. Return to Admin View to reveal the instant merge into `C-001`'s master cluster.

#### Talking Points
> "Here in Ward 14, Karol Bagh, citizen Rajesh Malhotra submitted complaint **C-001** in formal English: *'Massive pothole right opposite Metro Pillar 112 on Arya Samaj Road. Multiple two-wheelers slipping.'*
> 
> Now, another citizen, Aman Preet, encounters the same pothole and submits a report in casual Hinglish:  
> *'Bhai Arya Samaj Road pe metro pillar 112 ke samne bohot bada gaddha ho gaya hai. Kal raat scooty girte girte bachi, accident hone se pehle jaldi theek karao.'* (Complaint **C-002**).
> 
> In legacy municipal portals, this spawns a duplicate ticket and dispatches a second PWD inspection team.
> 
> Watch what ReeSolve does: our dual-engine dedup combines **Haversine geo-distance (<30 meters)** with **multilingual TF-IDF semantic similarity**. It detects the spatial and topical match, clusters **C-002** and a third report **C-003** directly under master incident **C-001**.
> 
> Instead of two separate work orders, ReeSolve **increments the incident priority score**, alerts the PWD engineer that multiple citizens are affected, and synchronizes real-time status updates to every reporting citizen under a single thread."

---

### Act 3: SLA Watchdog & Automated Escalation (1:05 – 1:50 | 45 seconds)

**Screen:** Tab 3 — Department Queue (`/department`) filtered by `WATER` and `ELEC`

#### Presenter Action
1. Filter Department Queue to **Water & Sewerage**.
2. Click on complaint **`C-016`** (Civil Lines Water Pipe Burst).
3. Highlight the glowing red **SlaBadge** component showing `BREACHED` and the escalation level: `Department Head (Level 2)`.
4. Quick switch to **`C-017`** (Janakpuri high-tension wire).

#### Talking Points
> "What happens when municipal departments drag their feet?
> 
> Look at complaint **`C-016`** in Ward 5, Civil Lines: a major drinking water pipeline burst reported 9 days ago. The official SLA for water leaks is 24 hours.
> 
> In conventional governance, this ticket would sit buried at the bottom of an engineer's tray indefinitely.
> 
> Look at ReeSolve's live SLA badge: it is glowing red — **`BREACHED`**.
> 
> Because ReeSolve runs an autonomous background SLA watchdog, the moment the 24-hour mark was passed without resolution, the platform didn't just log a static timestamp. It automatically triggered the **Escalation Ladder**:
> - It bypassed the inactive Field Team (Level 0).
> - It bypassed the Department Supervisor (Level 1).
> - It escalated directly to the **Department Head (Level 2)** with an urgent intervention alert!
> 
> Look at **`C-017`** in Janakpuri: high-tension wires sparking near a school. Because ReeSolve cross-references our geo-fenced **Vulnerable Zones**, it automatically shortened the SLA window and triggered an emergency priority override to **CRITICAL**. Bureaucrats can no longer hide overdue civic failures."

---

### Act 4: The Closed Loop — Reopening False Closures (1:50 – 2:35 | 45 seconds)

**Screen:** Tab 4 — Incident Detail & Verification Audit View (`/track/C-020`)

#### Presenter Action
1. Open the timeline for complaint **`C-020`** (Ward 9, Dwarka Sector 10).
2. Show the Junior Engineer's closure report submitted on Oct 23.
3. Scroll down to show citizen complaint **`C-021`** with photo evidence submitted on Oct 24.
4. Show the platform event audit: `CLOSURE_REJECTED` $\rightarrow$ `TASK_REOPENED` $\rightarrow$ `reopen_count = 1`.

#### Talking Points
> "Now for our core innovation: **The Verification Gate**.
> 
> Every citizen in India has experienced this: you report a broken road, and two days later you get an SMS: *'Your complaint has been resolved.'* You visit the spot—the road is still broken.
> 
> Here is complaint **`C-020`** in Dwarka Sector 10. Junior Engineer Rajesh Kumar marked it resolved, submitting an official closure note claiming:  
> *'Trench backfilled with compacted aggregate and sealed with hot-mix asphalt.'*
> 
> In legacy systems, this case is dead. In ReeSolve, case closure is only provisional.
> 
> Twenty-four hours later, citizen Priya Saxena files complaint **`C-021`** with photographic evidence:  
> *'PWD claimed C-020 is resolved, but they only dumped loose dry soil without bitumen! The mud sank after rain creating an even deeper crater; photo attached showing car bumper damaged.'*
> 
> ReeSolve’s verification gate detects the contradiction. It **rejects the closure**, resets the task to **`IN_PROGRESS`**, increments the `reopen_count`, and triggers a **Fraud & Quality Audit** flag against the contractor.
> 
> If a contractor attempts this twice (`reopen_count >= 2`), ReeSolve automatically escalates the ticket directly to the Department Head. A case never closes on a contractor’s word—it only closes when evidence confirms it."

---

### Act 5: Executive Map, Analytics & Conclusion (2:35 – 3:00 | 25 seconds)

**Screen:** Tab 2 — Admin Command Center Map View (`/admin`)

#### Presenter Action
Zoom out on the full Delhi NCR Leaflet map, displaying all 40 clustered complaints across Karol Bagh, Lajpat Nagar, Rohini, Saket, Hauz Khas, and Mayur Vihar.

#### Talking Points
> "Here is the Municipal Commissioner’s Executive Cockpit. Across 40 live incidents in Delhi NCR:
> - Duplicate spam is eliminated at ingestion.
> - Department tasks are routed and watched by strict SLA timers.
> - Contractor accountability is locked behind citizen evidence.
> 
> ReeSolve transforms municipal governance from passive complaint logging into **guaranteed, verified civic resolution**.
> 
> Thank you, and we welcome your questions!"

---

## Judge Q&A Anticipated Questions & Winning Answers

### Q1: "How does the system handle Hinglish and diverse regional Indian languages?"
> **Answer:**  
> "ReeSolve employs a hybrid approach:
> 1. Our deterministic pipeline uses a domain-specific vocabulary map covering common Hinglish terms (`gaddha`, `sadak`, `paani`, `andhera`, `kachra`, `naala`) paired with scikit-learn TF-IDF n-gram tokenization.
> 2. Because civic issues occur at specific physical locations, we use **spatial proximity as a hard heuristic** (<100m). Two complaints 25 meters apart discussing 'gaddha' and 'pothole' match with over 90% confidence without needing complex deep learning models, keeping it 100% offline-capable and blazingly fast."

### Q2: "What prevents a malicious citizen from repeatedly reopening valid closures to harass a contractor?"
> **Answer:**  
> "ReeSolve enforces three verification safeguards:
> 1. **Geo-location fencing:** Contradiction reports must originate within 150 meters of the original incident coordinates.
> 2. **Verification Quorum:** For high-value works, ReeSolve requires verification confirmation from multiple distinct citizens or trusted ward marshals (`VERIFY_QUORUM_FRACTION = 0.5`).
> 3. **Photo Evidence requirement:** Reopenings require mandatory image metadata attachment. Contradictions trigger an escalation to an independent Department Supervisor (Level 1/2) for a mandatory field inspection rather than an endless loop."

### Q3: "Does this require an internet connection or costly proprietary LLMs?"
> **Answer:**  
> "No! ReeSolve is built strictly **offline-safe** and production-resilient. All keyword intake, Haversine geo-spatial clustering, SLA watchdog scheduler, and verification gate logic run entirely in-process using Python and SQLite. Live LLM structuring is an optional enhancement, but 100% of the core functionality runs independently of external APIs."

### Q4: "How does this scale to millions of complaints across a megacity like Delhi?"
> **Answer:**  
> "All spatial queries utilize R-tree spatial indexing and geohashes bounded by municipal ward partitions (`Ward 14`, `Ward 8`, etc.). Clustering comparisons only evaluate active complaints within the candidate's immediate bounding box, yielding $O(1)$ spatial lookups rather than $O(N)$ full table scans."

