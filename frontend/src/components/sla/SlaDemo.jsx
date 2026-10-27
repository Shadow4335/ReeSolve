import React, { useState } from 'react';
import SlaBadge from '../SlaBadge';        // canonical path — server-driven badge
import StatusTimeline from './StatusTimeline';
import './sla.css';

/**
 * Returns a simulated ISO timestamp offset from "now" by hours + minutes.
 * @param {number} hoursOffset  Positive = future, negative = past.
 * @param {number} [minsOffset=0]
 * @returns {string} ISO 8601 string
 */
function offsetIso(hoursOffset, minsOffset = 0) {
  const d = new Date();
  d.setTime(d.getTime() + (hoursOffset * 3600 + minsOffset * 60) * 1000);
  return d.toISOString();
}

/**
 * Build a minimal TaskOut-shaped object that satisfies SlaBadge's contract.
 * All SLA state comes from the "backend" fields — no deadline arithmetic.
 *
 * @param {object} overrides
 * @returns {import('../../api').TaskOut}
 */
function makeTask({
  sla_state = 'ok',
  sla_remaining_seconds = 18 * 3600,
  status = 'OPEN',
  escalation_level = 0,
  escalation_level_label = 'None',
} = {}) {
  return { sla_state, sla_remaining_seconds, status, escalation_level, escalation_level_label };
}

/**
 * Hardcoded sample events using the REAL backend EventOut shape:
 *   { id, ts, type, actor, reason, payload }
 *
 * Types drawn from backend/app/models.py EVENT_TYPES.
 */
const SAMPLE_EVENTS = [
  {
    id: 7,
    ts: offsetIso(0, -15),
    type: 'ESCALATED',
    actor: 'System Watchdog',
    reason: 'SLA breached; auto-escalated to Zonal Superintending Engineer.',
    payload: { escalation_level: 2, label: 'Zonal SE' },
  },
  {
    id: 6,
    ts: offsetIso(0, -45),
    type: 'CITIZEN_REJECTED',
    actor: 'Citizen App (reporter)',
    reason: 'Loose gravel dumped without compaction; crater reopened after rain.',
    payload: { outcome: 'NOT_FIXED' },
  },
  {
    id: 5,
    ts: offsetIso(-1, -10),
    type: 'CONTRADICTION_DETECTED',
    actor: 'Verification Engine',
    reason: 'Geolocated photo shows unresolved road collapse at 5th Main & Metro Pillar 42.',
    payload: { photo_url: 'https://example.com/photo.jpg', distance_m: 4.2 },
  },
  {
    id: 4,
    ts: offsetIso(-3),
    type: 'CLOSURE_SUBMITTED',
    actor: 'Road Works Dept – Field Team 4',
    reason: 'Asphalt hot-mix patch completed. Work completion form signed.',
    payload: { confidence: 'LOW_CONFIDENCE' },
  },
  {
    id: 3,
    ts: offsetIso(-5),
    type: 'DUPLICATE_MERGED',
    actor: 'Dedup Engine',
    reason: 'Report #CIT-8821 ("Waterlogged crater blocking lane") merged — 25m radius match.',
    payload: { merged_report_id: 8821, distance_m: 25 },
  },
  {
    id: 2,
    ts: offsetIso(-6),
    type: 'TASK_CREATED',
    actor: 'Assignment Router',
    reason: 'Routed to Ward 14 Road Maintenance. 24-hour SLA clock started.',
    payload: { department: 'RD', base_sla_hours: 24 },
  },
  {
    id: 1,
    ts: offsetIso(-8),
    type: 'INCIDENT_CREATED',
    actor: 'Citizen (Mobile App)',
    reason: 'Deep road cave-in causing traffic bottleneck near Metro Pillar 42.',
    payload: { category: 'road_damage', severity: 4 },
  },
];

/**
 * SlaDemo — standalone demo page for the SLA Badge and Status Timeline components.
 * NOT wired into the app router; visit directly during development.
 *
 * @returns {JSX.Element}
 */
export default function SlaDemo() {
  const [demoSlaState, setDemoSlaState] = useState('ok');
  const [demoRemainingHours, setDemoRemainingHours] = useState(10);
  const [demoEscLevel, setDemoEscLevel] = useState(0);
  const [demoStatus, setDemoStatus] = useState('OPEN');

  const interactiveTask = makeTask({
    sla_state: demoSlaState,
    sla_remaining_seconds:
      demoSlaState === 'breached'
        ? -(Math.abs(demoRemainingHours) * 3600)
        : demoRemainingHours * 3600,
    status: demoStatus,
    escalation_level: demoEscLevel,
    escalation_level_label:
      ['None', 'Supervisor', 'Zonal SE', 'Commissioner'][Math.min(demoEscLevel, 3)],
  });

  return (
    <div className="sla-demo-wrapper">
      <div className="sla-demo-container">

        {/* ── Hero ─────────────────────────────────────────────── */}
        <header className="sla-demo-hero">
          <span className="sla-demo-hero-badge">ReeSolve · Hackathon Demo</span>
          <h1 className="sla-demo-title">SLA Badge &amp; Complaint Timeline</h1>
          <p className="sla-demo-subtitle">
            Badge reads server-computed <code>sla_state</code> and{' '}
            <code>sla_remaining_seconds</code> — no client-side deadline arithmetic.
            Timeline consumes <code>EventOut</code> from{' '}
            <code>GET /api/events?incident_id=</code>.
          </p>
        </header>

        {/* ── Section 1: All badge states ───────────────────────── */}
        <section className="sla-demo-section" aria-labelledby="badge-states-heading">
          <div className="sla-demo-section-header">
            <h2 id="badge-states-heading" className="sla-demo-section-title">
              1 · SLA Badge States
            </h2>
            <p className="sla-demo-section-desc">
              All states driven by <code>task.sla_state</code>. No timestamps involved.
            </p>
          </div>

          <div className="sla-demo-badge-grid">

            <div className="sla-demo-card">
              <span className="sla-demo-card-label">ok — green (&gt;80% window left)</span>
              <div className="sla-demo-card-body">
                <SlaBadge task={makeTask({ sla_state: 'ok', sla_remaining_seconds: 18 * 3600 })} />
              </div>
              <span className="sla-demo-card-meta">18h remaining · status: OPEN</span>
            </div>

            <div className="sla-demo-card">
              <span className="sla-demo-card-label">warning — amber (within 80% threshold)</span>
              <div className="sla-demo-card-body">
                <SlaBadge task={makeTask({ sla_state: 'warning', sla_remaining_seconds: 5 * 3600 + 12 * 60 })} />
              </div>
              <span className="sla-demo-card-meta">5h 12m remaining · status: IN_PROGRESS</span>
            </div>

            <div className="sla-demo-card">
              <span className="sla-demo-card-label">breached — dark red</span>
              <div className="sla-demo-card-body">
                <SlaBadge task={makeTask({ sla_state: 'breached', sla_remaining_seconds: -(2 * 3600 + 10 * 60) })} />
              </div>
              <span className="sla-demo-card-meta">Overdue by 2h 10m</span>
            </div>

            <div className="sla-demo-card">
              <span className="sla-demo-card-label">paused — grey (task blocked)</span>
              <div className="sla-demo-card-body">
                <SlaBadge task={makeTask({ sla_state: 'paused', sla_remaining_seconds: 7 * 3600, status: 'BLOCKED' })} />
              </div>
              <span className="sla-demo-card-meta">Clock frozen; 7h left at pause</span>
            </div>

            <div className="sla-demo-card">
              <span className="sla-demo-card-label">CLOSED — grey, no countdown</span>
              <div className="sla-demo-card-body">
                <SlaBadge task={makeTask({ sla_state: 'ok', status: 'CLOSED' })} />
              </div>
              <span className="sla-demo-card-meta">Terminal state — static label</span>
            </div>

            <div className="sla-demo-card">
              <span className="sla-demo-card-label">warning + Escalated (level 1)</span>
              <div className="sla-demo-card-body">
                <SlaBadge task={makeTask({
                  sla_state: 'warning',
                  sla_remaining_seconds: 3 * 3600,
                  escalation_level: 1,
                  escalation_level_label: 'Supervisor',
                })} />
              </div>
              <span className="sla-demo-card-meta">Amber + "Supervisor" pill</span>
            </div>

            <div className="sla-demo-card">
              <span className="sla-demo-card-label">breached + Escalated (level 2)</span>
              <div className="sla-demo-card-body">
                <SlaBadge task={makeTask({
                  sla_state: 'breached',
                  sla_remaining_seconds: -(1 * 3600 + 30 * 60),
                  escalation_level: 2,
                  escalation_level_label: 'Zonal SE',
                })} />
              </div>
              <span className="sla-demo-card-meta">Dark red + "Zonal SE" pill</span>
            </div>

            <div className="sla-demo-card">
              <span className="sla-demo-card-label">PENDING_VERIFICATION</span>
              <div className="sla-demo-card-body">
                <SlaBadge task={makeTask({ sla_state: 'ok', status: 'PENDING_VERIFICATION' })} />
              </div>
              <span className="sla-demo-card-meta">Terminal — awaiting citizen sign-off</span>
            </div>

          </div>
        </section>

        {/* ── Section 2: Interactive playground ────────────────── */}
        <section className="sla-demo-section" aria-labelledby="interactive-heading">
          <div className="sla-demo-section-header">
            <h2 id="interactive-heading" className="sla-demo-section-title">
              2 · Interactive Tester
            </h2>
            <p className="sla-demo-section-desc">
              Simulate any server-returned combination and preview the badge in real time.
            </p>
          </div>

          <div className="sla-demo-interactive">
            <div className="sla-demo-controls">
              <div className="sla-demo-field">
                <label htmlFor="i-sla-state">sla_state</label>
                <select
                  id="i-sla-state"
                  className="sla-demo-select"
                  value={demoSlaState}
                  onChange={(e) => setDemoSlaState(e.target.value)}
                >
                  <option value="ok">ok</option>
                  <option value="warning">warning</option>
                  <option value="breached">breached</option>
                  <option value="paused">paused</option>
                </select>
              </div>

              <div className="sla-demo-field">
                <label htmlFor="i-status">task status</label>
                <select
                  id="i-status"
                  className="sla-demo-select"
                  value={demoStatus}
                  onChange={(e) => setDemoStatus(e.target.value)}
                >
                  <option value="OPEN">OPEN</option>
                  <option value="IN_PROGRESS">IN_PROGRESS</option>
                  <option value="BLOCKED">BLOCKED</option>
                  <option value="PENDING_VERIFICATION">PENDING_VERIFICATION</option>
                  <option value="CLOSED">CLOSED</option>
                </select>
              </div>

              <div className="sla-demo-field">
                <label htmlFor="i-hours">
                  sla_remaining_seconds ({demoRemainingHours}h equiv.)
                </label>
                <input
                  id="i-hours"
                  className="sla-demo-input"
                  type="range"
                  min="-12"
                  max="144"
                  step="1"
                  value={demoRemainingHours}
                  onChange={(e) => setDemoRemainingHours(parseInt(e.target.value, 10))}
                />
              </div>

              <div className="sla-demo-field">
                <label htmlFor="i-esc">escalation_level</label>
                <select
                  id="i-esc"
                  className="sla-demo-select"
                  value={demoEscLevel}
                  onChange={(e) => setDemoEscLevel(parseInt(e.target.value, 10))}
                >
                  <option value={0}>0 — None</option>
                  <option value={1}>1 — Supervisor</option>
                  <option value={2}>2 — Zonal SE</option>
                  <option value={3}>3 — Commissioner</option>
                </select>
              </div>
            </div>

            <div className="sla-demo-preview">
              <div className="sla-demo-preview-left">
                <span className="sla-demo-preview-title">Live Preview</span>
                <span className="sla-demo-preview-sub">
                  Reflects what the page renders when the API returns these values.
                </span>
              </div>
              <div className="sla-demo-preview-right">
                <SlaBadge task={interactiveTask} />
              </div>
            </div>
          </div>
        </section>

        {/* ── Section 3: Status Timeline ─────────────────────────── */}
        <section className="sla-demo-section" aria-labelledby="timeline-heading">
          <div className="sla-demo-section-header">
            <h2 id="timeline-heading" className="sla-demo-section-title">
              3 · Complaint Lifecycle Timeline
            </h2>
            <p className="sla-demo-section-desc">
              Driven by <code>EventOut[]</code> from <code>GET /api/events?incident_id=</code>.
              Hover any timestamp for the exact ISO value.
            </p>
          </div>

          <StatusTimeline events={SAMPLE_EVENTS} />
        </section>

      </div>
    </div>
  );
}
