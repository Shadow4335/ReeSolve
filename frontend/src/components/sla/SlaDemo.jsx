import React, { useState } from 'react';
import SlaBadge from './SlaBadge';
import StatusTimeline from './StatusTimeline';
import './sla.css';

/**
 * Generates an ISO date string offset from the current moment by specified hours and minutes.
 *
 * @param {number} hoursOffset - Positive for future, negative for past.
 * @param {number} [minutesOffset=0] - Additional minutes offset.
 * @returns {string} ISO timestamp string.
 */
function getOffsetIso(hoursOffset, minutesOffset = 0) {
  const d = new Date();
  d.setTime(d.getTime() + (hoursOffset * 60 * 60 * 1000) + (minutesOffset * 60 * 1000));
  return d.toISOString();
}

/**
 * Hardcoded sample events covering all 7 lifecycle event types.
 * Formatted with relative time offsets from current execution time.
 */
const SAMPLE_TIMELINE_EVENTS = [
  {
    type: 'ESCALATED',
    timestamp: getOffsetIso(0, -15), // 15 mins ago
    actor: 'System Watchdog',
    note: 'Resolution rejected by citizen verification. 24h SLA breached. Auto-escalated to Zonal Superintending Engineer.',
  },
  {
    type: 'REOPENED',
    timestamp: getOffsetIso(0, -45), // 45 mins ago
    actor: 'Citizen Verification Gate',
    note: 'Citizen rejected closure: "Loose gravel was dumped without compaction; crater reopened after afternoon rain."',
  },
  {
    type: 'EVIDENCE_CONTRADICTS',
    timestamp: getOffsetIso(-1, -10), // ~1h ago
    actor: 'Citizen Follow-up (Audit Photo)',
    note: 'Uploaded geolocated photo showing unresolved road collapse at 5th Main & Metro Pillar 42.',
  },
  {
    type: 'RESOLVED_CLAIMED',
    timestamp: getOffsetIso(-3, 0), // 3h ago
    actor: 'Road Works Dept (Field Team 4)',
    note: 'Reported asphalt hot-mix patch completed. Closure form submitted with work completion sign-off.',
  },
  {
    type: 'DUPLICATE_LINKED',
    timestamp: getOffsetIso(-5, 0), // 5h ago
    actor: 'Automated Dedup Engine',
    note: 'Linked duplicate report #CIT-8821 ("Waterlogged crater blocking lane") within 25m radius to master incident.',
  },
  {
    type: 'ASSIGNED',
    timestamp: getOffsetIso(-6, 0), // 6h ago
    actor: 'Central Civic Dispatcher',
    note: 'Assigned to Ward 14 Road Maintenance Division. 24-hour standard SLA clock initiated.',
  },
  {
    type: 'CREATED',
    timestamp: getOffsetIso(-8, 0), // 8h ago
    actor: 'Citizen (Mobile App)',
    note: 'Citizen report filed: Deep road cave-in causing traffic bottleneck and pedestrian hazard near Metro Pillar 42.',
  },
];

/**
 * SlaDemo component — Standalone demo showcase for SLA Badges & Complaint Status Timeline.
 * NOT wired into the app router.
 *
 * @returns {JSX.Element} The rendered standalone demo page.
 */
export default function SlaDemo() {
  // State for interactive playground
  const [demoStatus, setDemoStatus] = useState('OPEN');
  const [hoursOffset, setHoursOffset] = useState(5);
  const [minutesOffset, setMinutesOffset] = useState(12);

  // Computed interactive deadline
  const interactiveDeadline = getOffsetIso(hoursOffset, minutesOffset);

  return (
    <div className="sla-demo-wrapper">
      <div className="sla-demo-container">
        {/* Header Hero */}
        <header className="sla-demo-hero">
          <span className="sla-demo-hero-badge">Smart City Hackathon UI</span>
          <h1 className="sla-demo-title">ReeSolve — SLA & Audit Timeline</h1>
          <p className="sla-demo-subtitle">
            Component showcase for live SLA countdown badges, status escalation indicators,
            and the immutable citizen-complaint lifecycle audit trail.
          </p>
        </header>

        {/* Section 1: SLA Badge States Showcase */}
        <section className="sla-demo-section" aria-labelledby="sla-states-heading">
          <div className="sla-demo-section-header">
            <h2 id="sla-states-heading" className="sla-demo-section-title">
              1. SLA Countdown Badge States
            </h2>
            <p className="sla-demo-section-desc">
              Dynamic threshold color rules: Green (&gt;50% left), Amber (20%–50% left),
              Red (&lt;20% left), Dark Red (Breached), Grey (Resolved).
            </p>
          </div>

          <div className="sla-demo-badge-grid">
            {/* Optimal: >50% */}
            <div className="sla-demo-card">
              <span className="sla-demo-card-label">Optimal (&gt;50% remaining)</span>
              <div className="sla-demo-card-body">
                <SlaBadge deadline={getOffsetIso(18, 0)} status="OPEN" />
              </div>
              <span className="sla-demo-card-meta">Deadline: 18h left | Status: OPEN</span>
            </div>

            {/* Warning: 20-50% */}
            <div className="sla-demo-card">
              <span className="sla-demo-card-label">Warning (20% – 50% remaining)</span>
              <div className="sla-demo-card-body">
                <SlaBadge deadline={getOffsetIso(7, 30)} status="IN_PROGRESS" />
              </div>
              <span className="sla-demo-card-meta">Deadline: 7h 30m left | Status: IN_PROGRESS</span>
            </div>

            {/* Critical: <20% */}
            <div className="sla-demo-card">
              <span className="sla-demo-card-label">Critical (&lt;20% remaining)</span>
              <div className="sla-demo-card-body">
                <SlaBadge deadline={getOffsetIso(1, 45)} status="OPEN" />
              </div>
              <span className="sla-demo-card-meta">Deadline: 1h 45m left | Status: OPEN</span>
            </div>

            {/* Breached */}
            <div className="sla-demo-card">
              <span className="sla-demo-card-label">Breached (Post-Deadline)</span>
              <div className="sla-demo-card-body">
                <SlaBadge deadline={getOffsetIso(-2, -10)} status="OPEN" />
              </div>
              <span className="sla-demo-card-meta">Deadline: 2h 10m overdue | Dark red alert</span>
            </div>

            {/* Resolved */}
            <div className="sla-demo-card">
              <span className="sla-demo-card-label">Resolved (No Countdown)</span>
              <div className="sla-demo-card-body">
                <SlaBadge deadline={getOffsetIso(12, 0)} status="RESOLVED" />
              </div>
              <span className="sla-demo-card-meta">Grey badge with no countdown</span>
            </div>

            {/* Reopened: Active + Pill */}
            <div className="sla-demo-card">
              <span className="sla-demo-card-label">Reopened (Active + Label)</span>
              <div className="sla-demo-card-body">
                <SlaBadge deadline={getOffsetIso(5, 12)} status="REOPENED" />
              </div>
              <span className="sla-demo-card-meta">Active countdown with &quot;Reopened&quot; pill</span>
            </div>

            {/* Escalated: Active + Pill */}
            <div className="sla-demo-card">
              <span className="sla-demo-card-label">Escalated (Active + Label)</span>
              <div className="sla-demo-card-body">
                <SlaBadge deadline={getOffsetIso(2, 30)} status="ESCALATED" />
              </div>
              <span className="sla-demo-card-meta">Active countdown with &quot;Escalated&quot; pill</span>
            </div>

            {/* Escalated & Breached */}
            <div className="sla-demo-card">
              <span className="sla-demo-card-label">Escalated &amp; Breached</span>
              <div className="sla-demo-card-body">
                <SlaBadge deadline={getOffsetIso(-1, -15)} status="ESCALATED" />
              </div>
              <span className="sla-demo-card-meta">Breached badge with &quot;Escalated&quot; pill</span>
            </div>
          </div>
        </section>

        {/* Section 2: Interactive SLA Tester */}
        <section className="sla-demo-section" aria-labelledby="interactive-heading">
          <div className="sla-demo-section-header">
            <h2 id="interactive-heading" className="sla-demo-section-title">
              2. Interactive SLA Tester
            </h2>
            <p className="sla-demo-section-desc">
              Test live calculation, countdown, and styling with dynamic parameters.
            </p>
          </div>

          <div className="sla-demo-interactive">
            <div className="sla-demo-controls">
              <div className="sla-demo-field">
                <label htmlFor="demo-status-select">Status</label>
                <select
                  id="demo-status-select"
                  className="sla-demo-select"
                  value={demoStatus}
                  onChange={(e) => setDemoStatus(e.target.value)}
                >
                  <option value="OPEN">OPEN</option>
                  <option value="IN_PROGRESS">IN_PROGRESS</option>
                  <option value="REOPENED">REOPENED</option>
                  <option value="ESCALATED">ESCALATED</option>
                  <option value="RESOLVED">RESOLVED</option>
                </select>
              </div>

              <div className="sla-demo-field">
                <label htmlFor="demo-hours-range">
                  Time Offset: {hoursOffset >= 0 ? `+${hoursOffset}h` : `${hoursOffset}h`}{' '}
                  {minutesOffset}m
                </label>
                <input
                  id="demo-hours-range"
                  className="sla-demo-input"
                  type="range"
                  min="-12"
                  max="24"
                  step="1"
                  value={hoursOffset}
                  onChange={(e) => setHoursOffset(parseInt(e.target.value, 10))}
                />
              </div>
            </div>

            <div className="sla-demo-preview">
              <div className="sla-demo-preview-left">
                <span className="sla-demo-preview-title">Live Render Preview</span>
                <span className="sla-demo-preview-sub">
                  Updates in real time; interval refreshes every 30 seconds.
                </span>
              </div>
              <div className="sla-demo-preview-right">
                <SlaBadge deadline={interactiveDeadline} status={demoStatus} />
              </div>
            </div>
          </div>
        </section>

        {/* Section 3: Status Timeline Component */}
        <section className="sla-demo-section" aria-labelledby="timeline-heading">
          <div className="sla-demo-section-header">
            <h2 id="timeline-heading" className="sla-demo-section-title">
              3. Vertical Complaint Lifecycle Audit Timeline
            </h2>
            <p className="sla-demo-section-desc">
              Displays newest events at the top with distinct emoji icons, colors, relative time,
              and full exact ISO timestamps available on hover.
            </p>
          </div>

          <StatusTimeline events={SAMPLE_TIMELINE_EVENTS} />
        </section>
      </div>
    </div>
  );
}

