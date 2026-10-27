import React, { useMemo } from 'react';
import './sla.css';

/**
 * Event type configurations keyed by backend EVENT_TYPES strings.
 * Each type gets a distinct emoji icon, human label, and CSS theme class.
 *
 * Source of truth: backend/app/models.py EVENT_TYPES list.
 */
export const EVENT_CONFIG = {
  // Intake
  REPORT_RECEIVED: {
    label: 'Report Received',
    icon: '📨',
    theme: 'created',
  },
  INCIDENT_CREATED: {
    label: 'Incident Created',
    icon: '📝',
    theme: 'created',
  },
  // Dedup / clustering
  DUPLICATE_MERGED: {
    label: 'Duplicate Merged',
    icon: '🔗',
    theme: 'duplicate',
  },
  RELATED_LINKED: {
    label: 'Related Incident Linked',
    icon: '🔀',
    theme: 'duplicate',
  },
  // Task lifecycle
  TASK_CREATED: {
    label: 'Task Created',
    icon: '📋',
    theme: 'assigned',
  },
  TASK_BLOCKED: {
    label: 'Task Blocked',
    icon: '🚧',
    theme: 'contradicts',
  },
  TASK_UNBLOCKED: {
    label: 'Task Unblocked',
    icon: '🔓',
    theme: 'assigned',
  },
  PRIORITY_RAISED: {
    label: 'Priority Raised',
    icon: '⬆️',
    theme: 'contradicts',
  },
  TASK_STARTED: {
    label: 'Work Started',
    icon: '👷',
    theme: 'assigned',
  },
  // SLA
  SLA_WARNING: {
    label: 'SLA Warning',
    icon: '⚠️',
    theme: 'contradicts',
  },
  SLA_BREACHED: {
    label: 'SLA Breached',
    icon: '🚨',
    theme: 'escalated',
  },
  ESCALATED: {
    label: 'Escalated',
    icon: '📣',
    theme: 'escalated',
  },
  // Resolution / verification
  CLOSURE_SUBMITTED: {
    label: 'Closure Claimed',
    icon: '✅',
    theme: 'resolved-claimed',
  },
  CLOSURE_REJECTED: {
    label: 'Closure Rejected',
    icon: '❌',
    theme: 'contradicts',
  },
  VERIFICATION_REQUESTED: {
    label: 'Verification Requested',
    icon: '🔍',
    theme: 'assigned',
  },
  CITIZEN_CONFIRMED: {
    label: 'Citizen Confirmed Fix',
    icon: '👍',
    theme: 'resolved-claimed',
  },
  CITIZEN_REJECTED: {
    label: 'Citizen Rejected Fix',
    icon: '👎',
    theme: 'contradicts',
  },
  CONTRADICTION_DETECTED: {
    label: 'Evidence Contradicts Closure',
    icon: '🧾',
    theme: 'contradicts',
  },
  TASK_REOPENED: {
    label: 'Task Reopened',
    icon: '🔄',
    theme: 'reopened',
  },
  TASK_CLOSED: {
    label: 'Task Closed',
    icon: '🏁',
    theme: 'resolved-claimed',
  },
  INCIDENT_RESOLVED: {
    label: 'Incident Resolved',
    icon: '🎉',
    theme: 'resolved-claimed',
  },
  // Admin
  CLOCK_ADVANCED: {
    label: 'Clock Advanced (Demo)',
    icon: '⏩',
    theme: 'default',
  },
};

/**
 * Formats a timestamp into a relative human-readable string (e.g. "3h ago").
 * Accepts either an ISO string or the backend's `ts` field name.
 *
 * @param {string | number | Date} timestamp - The event timestamp (`ts` field from EventOut).
 * @param {string | number | Date} [now=new Date()] - Reference timestamp.
 * @returns {string} Relative time string.
 */
export function formatRelativeTime(timestamp, now = new Date()) {
  if (!timestamp) return 'unknown time';
  const eventMs = new Date(timestamp).getTime();
  const nowMs = new Date(now).getTime();

  if (Number.isNaN(eventMs) || Number.isNaN(nowMs)) {
    return 'invalid date';
  }

  const diffMs = nowMs - eventMs;

  // Handle future dates or clock skew
  if (diffMs < 0) {
    const aheadSec = Math.round(Math.abs(diffMs) / 1000);
    if (aheadSec < 60) return 'just now';
    const aheadMin = Math.round(aheadSec / 60);
    if (aheadMin < 60) return `in ${aheadMin}m`;
    const aheadHours = Math.round(aheadMin / 60);
    return `in ${aheadHours}h`;
  }

  const seconds = Math.floor(diffMs / 1000);
  if (seconds < 60) return 'just now';

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;

  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;

  const years = Math.floor(days / 365);
  return `${years}y ago`;
}

/**
 * StatusTimeline component displays a vertical audit trail of complaint lifecycle events,
 * sorted with the newest event at the top.
 *
 * Consumes the `EventOut` shape returned by `GET /api/events?incident_id=`:
 *   { id, ts, type, actor, reason, payload }
 *
 * @param {object} props - Component props.
 * @param {Array<{
 *   id: number,
 *   ts: string,
 *   type: string,
 *   actor: string,
 *   reason: string,
 *   payload: object
 * }>} props.events - Raw EventOut objects from the API.
 * @param {string | number | Date} [props.now] - Optional reference time for relative calculation (useful with the simulated clock).
 * @param {string} [props.className] - Optional custom CSS class.
 * @returns {JSX.Element} The rendered vertical timeline.
 */
export default function StatusTimeline({
  events = [],
  now = new Date(),
  className = '',
  ...rest
}) {
  // Sort events descending by `ts` (backend field name), newest at top.
  const sortedEvents = useMemo(() => {
    if (!Array.isArray(events)) return [];
    return [...events].sort((a, b) => {
      const timeA = new Date(a?.ts || 0).getTime();
      const timeB = new Date(b?.ts || 0).getTime();
      return timeB - timeA;
    });
  }, [events]);

  if (!sortedEvents || sortedEvents.length === 0) {
    return (
      <div className={`sla-timeline-empty ${className}`.trim()} {...rest}>
        <p>No lifecycle events recorded yet.</p>
      </div>
    );
  }

  return (
    <div
      className={`sla-timeline-container ${className}`.trim()}
      role="feed"
      aria-label="Complaint status history timeline"
      {...rest}
    >
      <div className="sla-timeline-list">
        {sortedEvents.map((event, index) => {
          const typeKey = (event.type || '').toUpperCase();
          const config = EVENT_CONFIG[typeKey] || {
            label: event.type?.replace(/_/g, ' ') || 'Event',
            icon: '📌',
            theme: 'default',
          };

          // Use backend field `ts` (not `timestamp`)
          const eventDate = new Date(event.ts);
          const isValidDate = !Number.isNaN(eventDate.getTime());
          const exactTimeStr = isValidDate
            ? `${eventDate.toLocaleString()} (${eventDate.toISOString()})`
            : 'Unknown date';

          const relativeTimeStr = formatRelativeTime(event.ts, now);
          const isLatest = index === 0;

          // Show `reason` as the note text (backend field), fall back to payload summary
          const noteText =
            event.reason ||
            (event.payload && Object.keys(event.payload).length > 0
              ? JSON.stringify(event.payload)
              : null);

          return (
            <article
              key={event.id ?? `${event.type}-${event.ts}-${index}`}
              className={`sla-timeline-item sla-timeline-item-${config.theme} ${isLatest ? 'is-latest' : ''}`}
              aria-labelledby={`timeline-title-${index}`}
            >
              {/* Timeline spine and node */}
              <div className="sla-timeline-marker">
                <div
                  className="sla-timeline-icon-box"
                  title={config.label}
                  aria-hidden="true"
                >
                  <span className="sla-timeline-icon">{config.icon}</span>
                </div>
                {index < sortedEvents.length - 1 && (
                  <div className="sla-timeline-stem" aria-hidden="true" />
                )}
              </div>

              {/* Event card content */}
              <div className="sla-timeline-body">
                <header className="sla-timeline-header">
                  <div className="sla-timeline-title-group">
                    <h4
                      id={`timeline-title-${index}`}
                      className="sla-timeline-title"
                    >
                      {config.label}
                    </h4>
                    {isLatest && (
                      <span className="sla-timeline-badge-latest">Latest</span>
                    )}
                  </div>
                  <time
                    className="sla-timeline-timestamp"
                    dateTime={isValidDate ? eventDate.toISOString() : ''}
                    title={exactTimeStr}
                  >
                    {relativeTimeStr}
                  </time>
                </header>

                {event.actor && (
                  <div className="sla-timeline-actor">
                    <span className="sla-timeline-actor-prefix">Actor:</span>{' '}
                    <span className="sla-timeline-actor-name">{event.actor}</span>
                  </div>
                )}

                {noteText && (
                  <p className="sla-timeline-note">{noteText}</p>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}

