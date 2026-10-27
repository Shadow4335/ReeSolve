// Event type -> status colour. ok = green, warn = amber, danger (breached / reopened) = red, paused = slate, info = navy.
const OK = new Set(['CITIZEN_CONFIRMED', 'TASK_CLOSED', 'INCIDENT_RESOLVED', 'TASK_UNBLOCKED'])
const WARN = new Set(['SLA_WARNING', 'PRIORITY_RAISED'])
const DANGER = new Set(['SLA_BREACHED', 'ESCALATED', 'CONTRADICTION_DETECTED', 'TASK_REOPENED', 'CITIZEN_REJECTED', 'CLOSURE_REJECTED'])
const PAUSED = new Set(['TASK_BLOCKED'])

function styleFor(type) {
  if (OK.has(type)) return 'bg-ok text-white'
  if (DANGER.has(type)) return 'bg-danger text-white'
  if (PAUSED.has(type)) return 'bg-paused text-white'
  if (WARN.has(type)) return 'border border-warn bg-warn-tint text-ink'
  if (type === 'CLOCK_ADVANCED') return 'bg-navy-900 text-white'
  return 'bg-navy-50 text-navy-700'
}

export default function EventBadge({ type }) {
  return (
    <span className={`whitespace-nowrap rounded px-2 py-0.5 text-xs font-semibold ${styleFor(type)}`}>
      {type.replace(/_/g, ' ')}
    </span>
  )
}

export const fmtTs = (ts) => (ts ? ts.replace('T', ' ').slice(0, 16) : '')
