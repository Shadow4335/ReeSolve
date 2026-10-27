import { useState } from 'react'
import { api } from '../api'
import { usePolling } from '../hooks'
import SlaBadge from '../components/SlaBadge'
import { Button, Card, Chip, PageHeader } from '../components/ui'
import { DEMO_PHOTO_URL } from '../constants'

const input = 'w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary'

function CloseForm({ task, incident, onDone }) {
  const [note, setNote] = useState('')
  const [photo, setPhoto] = useState('')
  const [loc, setLoc] = useState(null)
  const [result, setResult] = useState(null)
  const submit = async () => {
    try {
      const r = await api.post(`/tasks/${task.id}/close`, { note, photo_url: photo || null, lat: loc?.lat ?? null, lng: loc?.lng ?? null })
      setResult(r.closure.outcome === 'REJECTED'
        ? { bad: true, text: 'Closure REJECTED automatically: missing photo or wrong location. The task was reopened.' }
        : { text: 'Closure submitted. Waiting for residents to confirm.' })
      onDone()
    } catch (e) {
      setResult({ bad: true, text: e.message })
    }
  }
  return (
    <div className="mt-4 space-y-3 rounded-xl bg-muted p-4">
      <input className={input} placeholder="What was done?" value={note} onChange={(e) => setNote(e.target.value)} />
      <div className="flex gap-2">
        <input className={input} placeholder="Photo link (proof of repair)" value={photo} onChange={(e) => setPhoto(e.target.value)} />
        <Button type="button" variant="soft" onClick={() => setPhoto(DEMO_PHOTO_URL)}>Use demo photo</Button>
      </div>
      <div className="flex items-center gap-3">
        <Button type="button" variant="soft" onClick={() => setLoc({ lat: incident.lat, lng: incident.lng })}>Use incident location</Button>
        <span className="text-sm text-muted-foreground">{loc ? `${loc.lat.toFixed(5)}, ${loc.lng.toFixed(5)}` : 'no location set'}</span>
      </div>
      <Button onClick={submit}>Submit closure</Button>
      {result && <p className={`text-sm font-semibold ${result.bad ? 'text-destructive' : 'text-primary'}`}>{result.text}</p>}
    </div>
  )
}

function TaskCard({ task, incident, depTask, reload }) {
  const [closing, setClosing] = useState(false)
  const [err, setErr] = useState('')
  const start = async () => {
    setErr('')
    try { await api.post(`/tasks/${task.id}/start`); reload() } catch (e) { setErr(e.message) }
  }
  const canWork = task.status === 'OPEN' || task.status === 'IN_PROGRESS'
  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="mr-2 text-lg font-semibold">Task #{task.id}: {task.incident_summary}</h3>
        <Chip tone={task.priority === 'HIGH' || task.priority === 'CRITICAL' ? 'danger' : 'muted'} dot={false}>{task.priority}</Chip>
        <Chip tone="muted" dot={false}>{task.status.replace('_', ' ')}</Chip>
        {task.reopen_count > 0 && <Chip tone="warn" dot={false}>Reopened ×{task.reopen_count}</Chip>}
      </div>
      <div className="mt-3"><SlaBadge task={task} /></div>
      {task.status === 'BLOCKED' && (
        <div className="mt-3 rounded-xl bg-warn p-3 font-semibold text-warn-foreground">
          Waiting for {depTask?.department_name || 'another department'} (task #{task.depends_on_task_id}). SLA clock is paused.
        </div>
      )}
      {task.is_lead && <p className="mt-3 text-sm font-semibold text-primary">Lead task: other departments are waiting on this one.</p>}
      {task.status === 'PENDING_VERIFICATION' && <p className="mt-3 text-sm font-semibold text-peach-foreground">Waiting for residents to confirm the fix.</p>}
      {canWork && (
        <div className="mt-4 flex gap-2">
          {task.status === 'OPEN' && <Button onClick={start}>Start</Button>}
          <Button variant="dark" onClick={() => setClosing(!closing)}>Close…</Button>
        </div>
      )}
      {err && <p className="mt-2 text-sm font-semibold text-destructive">{err}</p>}
      {closing && canWork && incident && <CloseForm task={task} incident={incident} onDone={reload} />}
    </Card>
  )
}

export default function Department({ code }) {
  const { data: tasks, reload } = usePolling(() => api.get(`/tasks?department=${code}`), 3000, [code])
  const { data: all } = usePolling(() => api.get('/tasks'), 5000)
  const { data: incidents } = usePolling(() => api.get('/incidents'), 5000)
  const active = (tasks || []).filter((t) => t.status !== 'CLOSED')
  const done = (tasks || []).filter((t) => t.status === 'CLOSED')
  const incOf = (id) => incidents?.find((i) => i.id === id)
  return (
    <div>
      <PageHeader eyebrow={`Department ${code}`} title="Task queue" sub="Most urgent first. A task only closes once residents confirm the fix." />
      <div className="space-y-4">
        {tasks && !active.length && <p className="text-muted-foreground">No active tasks.</p>}
        {active.map((t) => <TaskCard key={t.id} task={t} incident={incOf(t.incident_id)} depTask={all?.find((x) => x.id === t.depends_on_task_id)} reload={reload} />)}
        {done.length > 0 && <h2 className="pt-4 text-xl font-semibold">Closed ({done.length})</h2>}
        {done.map((t) => <TaskCard key={t.id} task={t} incident={incOf(t.incident_id)} reload={reload} />)}
      </div>
    </div>
  )
}
