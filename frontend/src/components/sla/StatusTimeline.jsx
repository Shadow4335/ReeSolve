import React, { useMemo } from 'react';
import './sla.css';

/**
 * Event type configurations including display label, emoji icon, and color theme identifier.
 */
export const EVENT_CONFIG = {
  CREATED: {
    label: 'Complaint Created',
    icon: '📝',
    theme: 'created',
  },
  ASSIGNED: {
    label: 'Assigned to Dept',
    icon: '👤',
    theme: 'assigned',
  },
  DUPLICATE_LINKED: {
    label: 'Duplicate Linked',
    icon: '🔗',
    theme: 'duplicate',
  },
  RESOLVED_CLAIMED: {
    label: 'Resolution Claimed',
    icon: '✅',
    theme: 'resolved-claimed',
  },
  EVIDENCE_CONTRADICTS: {
    label: 'Evidence Contradicts',
    icon: '⚠️',
    theme: 'contradicts',
  },
  REOPENED: {
    label: 'Case Reopened',
    icon: '🔄',
    theme: 'reopened',
  },
  ESCALATED: {
    label: 'Escalated',
    icon: '🚨',
    theme: 'escalated',
  },
};

/**
 * Formats a timestamp into a relative human-readable string (e.g. "3h ago").
 *
 * @param {string | number | Date} timestamp - The event timestamp.
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
 * StatusTimeline component displays a vertical audit trail of complaint events,
 * sorted with the newest event at the top.
 *
 * @param {object} props - Component props.
 * @param {Array<{
 *   type: "CREATED" | "ASSIGNED" | "DUPLICATE_LINKED" | "RESOLVED_CLAIMED" | "EVIDENCE_CONTRADICTS" | "REOPENED" | "ESCALATED",
 *   timestamp: string | number | Date,
 *   actor?: string,
 *   note?: string
 * }>} props.events - List of lifecycle events.
 * @param {string | number | Date} [props.now] - Optional reference time for relative calculation.
 * @param {string} [props.className] - Optional custom CSS class.
 * @returns {JSX.Element} The rendered vertical timeline.
 */
export default function StatusTimeline({
  events = [],
  now = new Date(),
  className = '',
  ...rest
}) {
  // Sort events descending (newest at the top)
  const sortedEvents = useMemo(() => {
    if (!Array.isArray(events)) return [];
    return [...events].sort((a, b) => {
      const timeA = new Date(a?.timestamp || 0).getTime();
      const timeB = new Date(b?.timestamp || 0).getTime();
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

          const eventDate = new Date(event.timestamp);
          const exactTimeStr = !Number.isNaN(eventDate.getTime())
            ? `${eventDate.toLocaleString()} (${eventDate.toISOString()})`
            : 'Unknown date';

          const relativeTimeStr = formatRelativeTime(event.timestamp, now);
          const isLatest = index === 0;

          return (
            <article
              key={`${event.type}-${event.timestamp}-${index}`}
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
                    dateTime={eventDate.toISOString?.() || ''}
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

                {event.note && (
                  <p className="sla-timeline-note">
                    {event.note}
                  </p>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}

