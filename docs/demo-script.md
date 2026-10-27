# ReeSolve: live demo script (~4 minutes)

**One-liner:** *"A complaint isn't resolved when a department says so. It's resolved when the evidence agrees."*

Three things to say out loud: **explainable dedup**, **cross-department dependencies**, **verified closure with automatic reopen and escalation**.

## Before you go on stage

```bash
cd backend && source .venv/bin/activate
uvicorn app.main:app --port 8000          # terminal 1
cd frontend && npm run dev                # terminal 2 -> http://localhost:5173
```

1. Open the app, switch the role to **Admin**. Click **Reset demo** then **Load seed data** (about 12 incidents appear on the map).
2. The clock badge in the header should show the simulated time. Click the clock **Reset** button.
3. Keep three tabs ready: **Admin**, **Department: WATER / ROADS**, **Resident** (Report a problem / My requests). In *My requests*, open **Demo tools** to follow any incident as a resident.

Two ways to run the story:

- **By hand** (best for judges): follow the steps below in the UI.
- **Scripted**: `python scripts/demo_scenario.py --pause 4` runs the same storyline through the API while you narrate from the Admin live feed.

Everything works offline; map tiles are the only thing that need the internet.

---

## Step 1. Five citizens report the same pothole (30 s)

**Do:** Role = Resident, **Report a problem**. Pick **Roads & sidewalks**, click **Use demo location**, type
*"Huge pothole on Rosewood Lane near the bakery"*, submit. Repeat 4 more times with different wording, nudging the pin a few metres.

**Say:** "Citizens describe the same problem in different words. We don't create five tickets."

**They should see:** after the first report, "New incident created". After the others, **"Merged with an existing incident (N reports, 9 m away, similarity 0.51)"**. On Admin the pothole marker stays one marker and turns from amber to red (priority raised to HIGH).

## Step 2. A related problem 60 m away (30 s)

**Do:** Submit *"Water pipe burst and leaking near Rosewood Lane bakery"* 60 m east of the pothole.

**Say:** "Different problem, same cause. The system links them and tells the departments what to do in which order."

**They should see:** a dashed line between the two markers on the map, the coordination note ("Water & Sewerage must resolve the water leak first… Roads SLA clock is paused meanwhile"), and in **Department: ROADS** the pothole task with a **Waiting for Water & Sewerage** banner and a grey *PAUSED* badge.

## Step 3. A department misses its deadline (30 s)

**Do:** Admin → clock **+24h**, then **+1h**.

**Say:** "We simulate time so you can see SLAs in seconds, not days."

**They should see in the live feed:** amber **SLA_WARNING**, then red **SLA_BREACHED**, then **ESCALATED** to *Department Supervisor* with the reason. The Water badge in the Department view turns red with an escalation chip. Roads stays grey: *we don't punish a department for waiting on another one*.

## Step 4. Water fixes it properly (40 s)

**Do:** Role = Department: WATER. **Start**, then **Close**: note *"Pipe section replaced"*, photo URL (**Use demo photo**), **Use incident location**, submit. Switch to Resident → **My requests** → follow the leak incident (Demo tools) → click **Yes, it's fixed**.

**Say:** "Closing doesn't close. The department's claim goes to *pending verification* and we ask the people who reported it."

**They should see:** status *VERIFYING*, then *CLOSED / VERIFIED*, incident *RESOLVED*, and in Roads the banner disappears: the task is **OPEN** with its SLA clock resumed, automatically.

## Step 5. Roads claims it's done, a citizen disagrees (40 s)

**Do:** Role = Department: ROADS → **Start**, **Close** with a photo and the incident location. Resident → **My requests** → the pothole → **No, still a problem**, comment *"The patch already crumbled"*.

**Say:** "A department can say 'done'. The citizens say 'no'. The system believes the evidence."

**They should see:** **TASK_REOPENED**, reopen count **1**, a shorter SLA. Optional extra: try closing **without a photo** and see the instant `CLOSURE_REJECTED` and reopen.

## Step 6. A new report after closure (40 s)

**Do:** Roads closes again; confirm as 3 citizens (My requests → *Answering as reporter* → Yes, ×3 with different reporters) until *CLOSED / VERIFIED*. Then Resident → **Report a problem**: *"The pothole on Rosewood Lane is back"* at the same spot.

**Say:** "Even after a verified closure, new evidence reopens the case. And if it keeps failing, it goes up the chain."

**They should see:** **CONTRADICTION_DETECTED**, **TASK_REOPENED** (#2), and **ESCALATED** to *Department Head* with the reason "repeated failed closure".

## Step 7. The commissioner's view (30 s)

**Do:** Admin: scroll the stats, then open the pothole in **My requests** and expand **Why?** on a timeline line.

**Say:** "SLA compliance and reopen rate per department, and every decision is explained in the audit trail."

**They should see:** the department bars (SLA %, reopen %), escalations by level, average resolution time, and the full pothole timeline with a human-readable *reason* on every line.

---

## Likely judge questions

- **What if citizens don't respond?** After 48 h the task closes as **LOW_CONFIDENCE**, flagged in stats.
- **Fake or spam reports?** Duplicates collapse into one incident, report count is capped in the priority score, closures need photo + location proof. Future: reporter reputation.
- **How does it scale?** Geo-indexing (PostGIS/H3) and embeddings for dedup, a queue-based SLA scheduler. The state machine stays the same.
- **Why a simulated clock?** To show SLA behaviour live. Production uses real time.

Be honest about the MVP limits: SQLite, simulated citizen verification, no real SMS.

## If something goes wrong

- **Blank map:** tiles need internet; the markers and feed still work.
- **State looks odd:** Admin → **Reset demo** → **Load seed data**, then start from Step 1.
- **Need to skip ahead:** `python scripts/demo_scenario.py --no-reset --pause 0` replays the storyline against the current data.
