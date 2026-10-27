const COLORS = {
  REPORT_RECEIVED: 'bg-slate-200 text-slate-800',
  INCIDENT_CREATED: 'bg-blue-100 text-blue-800',
  DUPLICATE_MERGED: 'bg-indigo-100 text-indigo-800',
  RELATED_LINKED: 'bg-purple-100 text-purple-800',
  TASK_CREATED: 'bg-blue-100 text-blue-800',
  TASK_BLOCKED: 'bg-slate-300 text-slate-800',
  TASK_UNBLOCKED: 'bg-teal-100 text-teal-800',
  PRIORITY_RAISED: 'bg-orange-100 text-orange-800',
  TASK_STARTED: 'bg-cyan-100 text-cyan-800',
  SLA_WARNING: 'bg-amber-200 text-amber-900',
  SLA_BREACHED: 'bg-red-200 text-red-900',
  ESCALATED: 'bg-red-600 text-white',
  CLOSURE_SUBMITTED: 'bg-sky-100 text-sky-800',
  CLOSURE_REJECTED: 'bg-rose-200 text-rose-900',
  VERIFICATION_REQUESTED: 'bg-sky-100 text-sky-800',
  CITIZEN_CONFIRMED: 'bg-green-200 text-green-900',
  CITIZEN_REJECTED: 'bg-rose-200 text-rose-900',
  CONTRADICTION_DETECTED: 'bg-red-600 text-white',
  TASK_REOPENED: 'bg-orange-500 text-white',
  TASK_CLOSED: 'bg-green-600 text-white',
  INCIDENT_RESOLVED: 'bg-emerald-600 text-white',
  CLOCK_ADVANCED: 'bg-slate-700 text-white',
}

export default function EventBadge({ type }) {
  return (
    <span className={`whitespace-nowrap rounded px-2 py-0.5 text-xs font-bold ${COLORS[type] || 'bg-slate-200'}`}>
      {type.replace(/_/g, ' ')}
    </span>
  )
}

export const fmtTs = (ts) => (ts ? ts.replace('T', ' ').slice(0, 16) : '')
