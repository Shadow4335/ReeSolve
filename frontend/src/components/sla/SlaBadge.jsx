import React, { useState, useEffect } from 'react';
import './sla.css';

/**
 * Pure helper function to compute remaining SLA time and formatting.
 *
 * @param {string | number | Date} deadline - The SLA deadline ISO string, timestamp, or Date.
 * @param {string | number | Date} [now=new Date()] - Reference timestamp (defaults to current time).
 * @param {number | { totalDuration?: number, startTime?: string | number | Date }} [options=86400000] - Total SLA window in ms or options object. Defaults to 24 hours (86,400,000 ms).
 * @returns {{
 *   diffMs: number,
 *   isBreached: boolean,
 *   hours: number,
 *   minutes: number,
 *   seconds: number,
 *   formatted: string,
 *   percentRemaining: number,
 *   urgency: 'green' | 'amber' | 'red' | 'breached' | 'resolved'
 * }} Object containing calculation results and formatted strings.
 */
export function timeRemaining(deadline, now = new Date(), options = {}) {
  if (!deadline) {
    return {
      diffMs: 0,
      isBreached: false,
      hours: 0,
      minutes: 0,
      seconds: 0,
      formatted: 'No deadline',
      percentRemaining: 0,
      urgency: 'resolved',
    };
  }

  const deadMs = new Date(deadline).getTime();
  const nowMs = new Date(now).getTime();

  if (Number.isNaN(deadMs) || Number.isNaN(nowMs)) {
    return {
      diffMs: 0,
      isBreached: false,
      hours: 0,
      minutes: 0,
      seconds: 0,
      formatted: 'Invalid date',
      percentRemaining: 0,
      urgency: 'resolved',
    };
  }

  const diffMs = deadMs - nowMs;
  const isBreached = diffMs < 0;
  const absDiff = Math.abs(diffMs);

  const totalSeconds = Math.floor(absDiff / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  // Determine total SLA window for percentage calculation
  let totalDurationMs;
  if (typeof options === 'number') {
    totalDurationMs = options;
  } else if (options && typeof options === 'object') {
    if (typeof options.totalDuration === 'number' && options.totalDuration > 0) {
      totalDurationMs = options.totalDuration;
    } else if (options.startTime) {
      const startMs = new Date(options.startTime).getTime();
      if (!Number.isNaN(startMs) && deadMs > startMs) {
        totalDurationMs = deadMs - startMs;
      }
    }
  }

  // Fallback to 24 hours if not provided or invalid
  if (!totalDurationMs || totalDurationMs <= 0) {
    totalDurationMs = 24 * 60 * 60 * 1000;
  }

  let percentRemaining = 0;
  let urgency = 'green';

  if (isBreached) {
    percentRemaining = 0;
    urgency = 'breached';
  } else {
    percentRemaining = Math.max(0, Math.min(100, (diffMs / totalDurationMs) * 100));
    if (percentRemaining > 50) {
      urgency = 'green';
    } else if (percentRemaining >= 20) {
      urgency = 'amber';
    } else {
      urgency = 'red';
    }
  }

  const formatted = isBreached
    ? `BREACHED by ${hours}h ${minutes}m`
    : `${hours}h ${minutes}m left`;

  return {
    diffMs,
    isBreached,
    hours,
    minutes,
    seconds,
    formatted,
    percentRemaining,
    urgency,
  };
}

/**
 * SlaBadge component displays a live SLA countdown badge with dynamic urgency colors
 * and status indicators.
 *
 * @param {object} props - Component props.
 * @param {string} props.deadline - ISO string representing the SLA deadline.
 * @param {"OPEN" | "IN_PROGRESS" | "RESOLVED" | "REOPENED" | "ESCALATED"} props.status - Complaint/task status.
 * @param {string | number | Date} [props.now] - Optional reference time (defaults to live local clock).
 * @param {number} [props.totalDuration] - Optional total duration in ms for accurate percentage calculation.
 * @param {string | number | Date} [props.startTime] - Optional start timestamp to deduce total SLA window.
 * @param {string} [props.className] - Optional additional CSS class.
 * @returns {JSX.Element} The rendered SLA badge component.
 */
export default function SlaBadge({
  deadline,
  status = 'OPEN',
  now: propNow,
  totalDuration,
  startTime,
  className = '',
  ...rest
}) {
  const [currentNow, setCurrentNow] = useState(() => (propNow ? new Date(propNow) : new Date()));
  const normalizedStatus = (status || 'OPEN').toUpperCase();
  const isResolved = normalizedStatus === 'RESOLVED';

  // Live countdown updating every 30 seconds, cleaned up properly on unmount
  useEffect(() => {
    if (isResolved) return;

    // If external `propNow` is provided (e.g. simulated clock or testing), sync to it
    if (propNow) {
      setCurrentNow(new Date(propNow));
      return;
    }

    const intervalId = setInterval(() => {
      setCurrentNow(new Date());
    }, 30000); // 30 seconds

    return () => clearInterval(intervalId);
  }, [deadline, isResolved, propNow]);

  // If status is RESOLVED, render a grey badge with no countdown
  if (isResolved) {
    return (
      <span
        className={`sla-badge sla-badge-resolved ${className}`.trim()}
        role="status"
        aria-label="SLA Status: Resolved"
        {...rest}
      >
        <span className="sla-badge-dot" aria-hidden="true" />
        <span className="sla-badge-text">Resolved</span>
      </span>
    );
  }

  // Effective current time (from props or local tick)
  const effectiveNow = propNow ? new Date(propNow) : currentNow;
  const timeInfo = timeRemaining(deadline, effectiveNow, { totalDuration, startTime });

  // REOPENED and ESCALATED are treated as active and display a small label next to countdown
  let statusPill = null;
  if (normalizedStatus === 'REOPENED') {
    statusPill = <span className="sla-status-pill sla-status-pill-reopened">Reopened</span>;
  } else if (normalizedStatus === 'ESCALATED') {
    statusPill = <span className="sla-status-pill sla-status-pill-escalated">Escalated</span>;
  }

  const badgeAriaLabel = `SLA: ${timeInfo.formatted}${statusPill ? `, Status: ${normalizedStatus}` : ''}`;
  const deadlineTitle = deadline
    ? `Deadline: ${new Date(deadline).toLocaleString()}`
    : undefined;

  return (
    <span
      className={`sla-badge sla-badge-${timeInfo.urgency} ${className}`.trim()}
      role="status"
      aria-label={badgeAriaLabel}
      title={deadlineTitle}
      {...rest}
    >
      <span className="sla-badge-dot" aria-hidden="true" />
      <span className="sla-badge-text">{timeInfo.formatted}</span>
      {statusPill}
    </span>
  );
}

