import { api } from '../api'
import { usePolling } from '../hooks'
import { CATEGORY_ICON } from '../components/Icon'
import { Card, Chip, IconTile, PageHeader, SectionTitle } from '../components/ui'
import { fmtWhen, statusChip } from '../lib/friendly'

function Row({ task, incident }) {
  const chip = statusChip(task, incident)
  const reports = incident?.report_count ?? 1
  const when = task.status === 'CLOSED' ? `Closed ${fmtWhen(task.closed_at)}` : `Reported ${fmtWhen(task.created_at)}`
  return (
    <div className="flex items-center gap-4 p-4">
      <IconTile name={CATEGORY_ICON[task.incident_category]} />
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold">{task.incident_summary}</p>
        <p className="text-sm text-muted-foreground">
          {task.department_name} · {reports > 1 ? `${reports} reports merged` : '1 report'}
          {task.status === 'BLOCKED' ? ' · Starts after a related issue is cleared' : ''}
          {task.status === 'CLOSED' && task.closure_confidence ? ` · ${task.closure_confidence === 'VERIFIED' ? 'Confirmed fixed by residents' : 'Closed, no objections'}` : ''}
          {' · '}{when}
        </p>
      </div>
      <Chip tone={chip.tone}>{chip.label}</Chip>
    </div>
  )
}

export default function Projects() {
  const { data: tasks } = usePolling(() => api.get('/tasks'), 4000)
  const { data: incidents } = usePolling(() => api.get('/incidents'), 4000)
  const inc = (id) => (incidents || []).find((i) => i.id === id)
  const all = tasks || []
  const active = all.filter((t) => t.status !== 'CLOSED')
  const done = all.filter((t) => t.status === 'CLOSED').sort((a, b) => (b.closed_at || '').localeCompare(a.closed_at || ''))
  return (
    <div>
      <PageHeader eyebrow="City projects" title="Work around your area" sub="Planned and ongoing public works, and what's recently finished." />
      <SectionTitle>In progress</SectionTitle>
      <Card className="divide-y divide-border">
        {!active.length && <p className="p-5 text-muted-foreground">Nothing in progress right now.</p>}
        {active.map((t) => <Row key={t.id} task={t} incident={inc(t.incident_id)} />)}
      </Card>
      <div className="mt-10"><SectionTitle>Recently completed</SectionTitle></div>
      <Card className="divide-y divide-border">
        {!done.length && <p className="p-5 text-muted-foreground">Nothing completed yet.</p>}
        {done.map((t) => <Row key={t.id} task={t} incident={inc(t.incident_id)} />)}
      </Card>
    </div>
  )
}
