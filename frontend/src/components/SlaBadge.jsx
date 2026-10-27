import React from 'react';
import './sla/sla.css';

/**
 * Format a raw seconds value into a human-readable countdown string.
 *
 * This is a pure function (no side-effects, no Date.now()) so it is easily
 * unit-testable. Callers pass the authoritative `sla_remaining_seconds` value
 * that the backend already computed — no client-side clock arithmetic needed.
 *
 * @param {number} seconds - Signed seconds until the SLA deadline.
 *   Positive → time remaining; negative → already breached.
 * @returns {{
 *   isBreached: boolean,
 *   hours: number,
 *   minutes: number,
 *   formatted: string
 * }}
 */
export function formatSlaSeconds(seconds) {
  const isBreached = seconds < 0;
  const abs = Math.abs(seconds);
  const hours = Math.floor(abs / 3600);
  const minutes = Math.floor((abs % 3600) / 60);
  const formatted = isBreached
    ? `BREACHED by ${hours}h ${minutes}m`
    : `${hours}h ${minutes}m left`;
  return { isBreached, hours, minutes, formatted };
}

/**
 * Map a backend `sla_state` string to the CSS modifier used in sla.css.
 *
 * @param {string} slaState - One of: "ok" | "warning" | "breached" | "paused"
 * @returns {"green" | "amber" | "red" | "breached" | "resolved"}
 */
function slaStateToUrgency(slaState) {
  switch (slaState) {
    case 'ok':      return 'green';
    case 'warning': return 'amber';
    case 'breached': return 'breached';
    case 'paused':  return 'resolved';   // grey — frozen, not counting down
    default:        return 'green';
  }
}

/**
 * SlaBadge — server-driven SLA countdown chip.
 *
 * Reads ONLY the fields the backend already provides in a `TaskOut` response:
 *   - `sla_state`            ("ok" | "warning" | "breached" | "paused")
 *   - `sla_remaining_seconds` (signed float; negative when breached)
 *   - `status`               task status string
 *   - `escalation_level`     integer
 *   - `escalation_level_label` human label for the escalation tier
 *
 * NO client-side deadline arithmetic is performed — the backend is the single
 * source of truth, including for paused tasks whose clock is frozen.
 *
 * @param {{ task: import('../api').TaskOut }} props
 * @param {object}  props.task
 * @param {string}  props.task.sla_state              - "ok"|"warning"|"breached"|"paused"
 * @param {number}  props.task.sla_remaining_seconds  - signed seconds
 * @param {string}  props.task.status                 - task status
 * @param {number}  props.task.escalation_level        - 0 = none, 1+ = escalated
 * @param {string}  props.task.escalation_level_label - human-readable escalation label
 * @param {string}  [props.className]                 - extra CSS class
 * @returns {JSX.Element}
 */
export default function SlaBadge({ task, className = '' }) {
  if (!task) {
    return (
      <span className={`sla-badge sla-badge-resolved ${className}`.trim()} role="status">
        <span className="sla-badge-dot" aria-hidden="true" />
        <span className="sla-badge-text">No SLA data</span>
      </span>
    );
  }

  const {
    sla_state,
    sla_remaining_seconds,
    status,
    escalation_level = 0,
    escalation_level_label = '',
  } = task;

  const normalizedStatus = (status || '').toUpperCase();

  // Closed / verified tasks render a static grey badge — no countdown.
  const isTerminal = normalizedStatus === 'CLOSED' || normalizedStatus === 'PENDING_VERIFICATION';

  if (isTerminal) {
    const label = normalizedStatus === 'PENDING_VERIFICATION' ? 'Pending Verification' : 'Closed';
    return (
      <span
        className={`sla-badge sla-badge-resolved ${className}`.trim()}
        role="status"
        aria-label={`SLA Status: ${label}`}
      >
        <span className="sla-badge-dot" aria-hidden="true" />
        <span className="sla-badge-text">{label}</span>
      </span>
    );
  }

  // Paused (BLOCKED) tasks: clock is frozen on the backend — show grey "Paused" badge.
  if (sla_state === 'paused') {
    const { formatted } = formatSlaSeconds(sla_remaining_seconds ?? 0);
    return (
      <span
        className={`sla-badge sla-badge-resolved ${className}`.trim()}
        role="status"
        aria-label="SLA paused (task blocked)"
        title="SLA clock is frozen while this task is blocked"
      >
        <span className="sla-badge-dot" aria-hidden="true" />
        <span className="sla-badge-text">Paused · {formatted}</span>
      </span>
    );
  }

  const urgency = slaStateToUrgency(sla_state);
  const { formatted } = formatSlaSeconds(sla_remaining_seconds ?? 0);

  // Escalation pill — shown when escalation_level > 0 alongside the countdown.
  const escalationPill =
    escalation_level > 0 ? (
      <span
        className="sla-status-pill sla-status-pill-escalated"
        title={escalation_level_label}
        aria-label={`Escalated: ${escalation_level_label}`}
      >
        {escalation_level_label || `L${escalation_level}`}
      </span>
    ) : null;

  const ariaLabel = [
    `SLA: ${formatted}`,
    escalation_level > 0 ? `Escalated to ${escalation_level_label}` : null,
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <span
      className={`sla-badge sla-badge-${urgency} ${className}`.trim()}
      role="status"
      aria-label={ariaLabel}
    >
      <span className="sla-badge-dot" aria-hidden="true" />
      <span className="sla-badge-text">{formatted}</span>
      {escalationPill}
    </span>
  );
}
