// FALLBACK written by the main dev (see DECISIONS.md). Reads only TaskOut fields:
// sla_state, sla_remaining_seconds, escalation_level, escalation_level_label, status.

const STATE_STYLE = {
  ok: 'bg-green-100 text-green-800 border-green-500',
  warning: 'bg-amber-100 text-amber-900 border-amber-500',
  breached: 'bg-red-100 text-red-800 border-red-600',
  paused: 'bg-slate-200 text-slate-700 border-slate-400',
}

const STATE_LABEL = { ok: 'ON TRACK', warning: 'AT RISK', breached: 'BREACHED', paused: 'PAUSED' }

export function formatDuration(totalSeconds) {
  const s = Math.abs(Math.round(totalSeconds))
  const days = Math.floor(s / 86400)
  const hours = Math.floor((s % 86400) / 3600)
  const minutes = Math.floor((s % 3600) / 60)
  if (days > 0) return `${days}d ${hours}h`
  if (hours > 0) return `${hours}h ${minutes}m`
  return `${minutes}m`
}

function detail(task) {
  const secs = task.sla_remaining_seconds ?? 0
  if (task.sla_state === 'breached') return `${formatDuration(secs)} overdue`
  if (task.sla_state === 'paused') return 'waiting on another department'
  return `${formatDuration(secs)} left`
}

export default function SlaBadge({ task }) {
  if (!task) return null
  if (task.status === 'CLOSED' || task.status === 'PENDING_VERIFICATION') {
    const closed = task.status === 'CLOSED'
    return (
      <span className="inline-flex items-center gap-2">
        <span
          className={`rounded-lg border-2 px-3 py-1 text-lg font-bold ${
            closed ? 'border-green-600 bg-green-100 text-green-800' : 'border-blue-500 bg-blue-100 text-blue-800'
          }`}
        >
          {closed ? 'CLOSED' : 'VERIFYING'}
        </span>
      </span>
    )
  }
  const state = STATE_STYLE[task.sla_state] ? task.sla_state : 'ok'
  return (
    <span className="inline-flex flex-wrap items-center gap-2" data-sla-state={state}>
      <span className={`rounded-lg border-2 px-3 py-1 text-lg font-bold ${STATE_STYLE[state]}`}>
        {STATE_LABEL[state]} · {detail(task)}
      </span>
      {task.escalation_level > 0 && (
        <span className="rounded-lg border-2 border-purple-500 bg-purple-100 px-3 py-1 text-base font-semibold text-purple-800">
          Escalated: {task.escalation_level_label}
        </span>
      )}
    </span>
  )
}
