// Plain-language labels for residents. The technical reason line from the audit log is always kept as a "why".
export const REPORT_CATEGORIES = [
  { key: 'roads', hint: 'road_damage', title: 'Roads & sidewalks', sub: 'Potholes, cracks, broken paths', icon: 'road', example: 'Huge pothole on Rosewood Lane near the bakery' },
  { key: 'electricity', hint: 'streetlight', title: 'Electricity & streetlights', sub: 'Outages, dark streets', icon: 'bulb', example: 'Street light on Orchard Lane has been out for days' },
  { key: 'water', hint: 'water', title: 'Water & drainage', sub: 'Leaks, blocked drains, flooding', icon: 'drop', example: 'Water pipe burst and leaking near the corner shop' },
  { key: 'waste', hint: 'garbage', title: 'Waste', sub: 'Missed pickup, overflowing bins', icon: 'trash', example: 'Garbage dump not cleared for a week' },
  { key: 'parks', hint: 'other', title: 'Parks', sub: 'Damaged benches, paths, greenery', icon: 'tree', example: 'Broken bench in the park' },
  { key: 'facilities', hint: 'other', title: 'Public facilities', sub: 'Toilets, bus stops, buildings', icon: 'building', example: 'Bus stop shelter roof is damaged' },
  { key: 'construction', hint: 'other', title: 'Construction', sub: 'Unsafe sites, debris, noise', icon: 'cone', example: 'Debris left on the road from a building site' },
]

export const requestId = (incidentId) => `RS-${1000 + incidentId}`

export const fmtWhen = (ts) =>
  ts ? new Date(ts + 'Z').toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'UTC' }) : ''

// Task status -> chip for residents: tone (status colour) + i18n key for the label.
export function statusChip(task, incident) {
  if (!task) return { tone: incident?.status === 'RESOLVED' ? 'ok' : 'paused', key: incident?.status === 'RESOLVED' ? 'chip.completed' : 'chip.reported' }
  switch (task.status) {
    case 'PENDING_VERIFICATION': return { tone: 'warn', key: 'chip.askFixed' }
    case 'BLOCKED': return { tone: 'paused', key: 'chip.waiting' }
    case 'CLOSED': return { tone: 'ok', key: 'chip.completed' }
    case 'IN_PROGRESS': return { tone: 'info', key: 'chip.inProgress' }
    default: return task.reopen_count > 0 ? { tone: 'danger', key: 'chip.reopened' } : { tone: 'paused', key: 'chip.reported' }
  }
}

// Audit event -> resident-friendly sentence (null = hide from residents)
export function friendlyEvent(e, deptName) {
  const p = e.payload || {}
  switch (e.type) {
    case 'REPORT_RECEIVED': return 'Your report was received'
    case 'INCIDENT_CREATED': return null
    case 'TASK_CREATED': return `Sent to ${deptName || 'the right team'}`
    case 'DUPLICATE_MERGED': return 'Merged with a similar report nearby'
    case 'RELATED_LINKED': return 'Linked to a related problem on the same street'
    case 'PRIORITY_RAISED': return 'Marked more urgent as more residents reported it'
    case 'TASK_BLOCKED': return 'Waiting on another team to finish first'
    case 'TASK_UNBLOCKED': return 'The other team finished, so work can start'
    case 'TASK_STARTED': return 'Team started work'
    case 'SLA_WARNING': return 'Deadline is getting close'
    case 'SLA_BREACHED': return 'Deadline missed'
    case 'ESCALATED': return `Moved up to ${p.to_role || 'a senior team'}`
    case 'CLOSURE_SUBMITTED': return "Team says it's fixed"
    case 'CLOSURE_REJECTED': return "The fix didn't come with proof, so it was reopened"
    case 'VERIFICATION_REQUESTED': return "We asked residents to confirm it's fixed"
    case 'CITIZEN_CONFIRMED': return "A resident confirmed it's fixed"
    case 'CITIZEN_REJECTED': return "A resident says it's still a problem"
    case 'CONTRADICTION_DETECTED': return 'A new report says the problem is back'
    case 'TASK_REOPENED': return 'Reopened and put back on the team’s list'
    case 'TASK_CLOSED': return p.confidence === 'VERIFIED' ? "Closed: residents confirmed it's fixed" : 'Closed: no one objected within 48 hours'
    case 'INCIDENT_RESOLVED': return 'Resolved'
    default: return null
  }
}

const KEY = 'reesolve.myRequests'
export function loadMine() {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]') } catch { return [] }
}
export function saveMine(list) {
  try { localStorage.setItem(KEY, JSON.stringify(list)) } catch { /* private mode */ }
}
export function addMine(incidentId, reportId) {
  const cur = loadMine().filter((m) => m.incidentId !== incidentId)
  const next = [{ incidentId, reportId: reportId ?? null }, ...cur]
  saveMine(next)
  return next
}

export const DEPT_BY_CATEGORY = {
  road_damage: 'Roads & Infrastructure', water_leak: 'Water & Sewerage', drain_blockage: 'Drainage',
  garbage: 'Sanitation', streetlight: 'Electrical', other: 'Sanitation',
}
