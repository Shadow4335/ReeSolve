import { useState } from 'react'
import { api } from '../api'
import { usePolling } from '../hooks'
import SlaBadge from '../components/SlaBadge'
import { DEMO_PHOTO_URL } from '../constants'

function CloseForm({ task, incident, onDone }) {
  const [note, setNote] = useState('')
  const [photo, setPhoto] = useState('')
  const [loc, setLoc] = useState(null)
  const [result, setResult] = useState(null)
  const submit = async () => {
    try {
      const r = await api.post(`/tasks/${task.id}/close`, {
        note, photo_url: photo || null, lat: loc?.lat ?? null, lng: loc?.lng ?? null,
      })
      setResult(r.closure.outcome === 'REJECTED'
        ? { bad: true, text: 'Closure REJECTED automatically: missing photo or wrong location. Task reopened.' }
        : { text: 'Closure submitted. Waiting for citizens to verify.' })
      onDone()
    } catch (e) {
      setResult({ bad: true, text: e.message })
    }
  }
  return (
    <div className="mt-3 space-y-2 rounded-lg bg-slate-50 p-3">
      <input className="w-full rounded border p-2" placeholder="What was done?" value={note} onChange={(e) => setNote(e.target.value)} />
      <div className="flex gap-2">
        <input className="flex-1 rounded border p-2" placeholder="Photo URL" value={photo} onChange={(e) => setPhoto(e.target.value)} />
        <button type="button" className="rounded bg-slate-600 px-3 text-white" onClick={() => setPhoto(DEMO_PHOTO_URL)}>Use demo photo</button>
      </div>
      <div className="flex items-center gap-2">
        <button type="button" className="rounded bg-slate-600 px-3 py-2 text-white" onClick={() => setLoc({ lat: incident.lat, lng: incident.lng })}>
          Use incident location
        </button>
        <span className="text-sm text-slate-600">{loc ? `${loc.lat.toFixed(5)}, ${loc.lng.toFixed(5)}` : 'no location set'}</span>
      </div>
      <button onClick={submit} className="rounded-lg bg-green-700 px-5 py-2 text-lg font-bold text-white">Submit closure</button>
      {result && <p className={`font-semibold ${result.bad ? 'text-red-700' : 'text-green-700'}`}>{result.text}</p>}
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
    <div className="rounded-xl bg-white p-4 shadow">
      <div className="flex flex-wrap items-center gap-3">
        <h3 className="text-xl font-bold">Task #{task.id}: {task.incident_summary}</h3>
        <span className="rounded bg-slate-100 px-2 py-1 font-semibold">{task.priority}</span>
        <span className="rounded bg-slate-100 px-2 py-1">{task.status.replace('_', ' ')}</span>
        {task.reopen_count > 0 && <span className="rounded bg-orange-100 px-2 py-1 font-semibold text-orange-800">Reopened ×{task.reopen_count}</span>}
      </div>
      <div className="mt-2"><SlaBadge task={task} /></div>
      {task.status === 'BLOCKED' && (
        <div className="mt-3 rounded-lg border-2 border-slate-400 bg-slate-100 p-3 text-lg font-bold text-slate-700">
          Waiting for {depTask?.department_name || 'another department'} (task #{task.depends_on_task_id}). SLA clock is paused.
        </div>
      )}
      {task.is_lead && <p className="mt-2 font-semibold text-purple-800">Lead task: other departments are waiting on this one.</p>}
      {task.status === 'PENDING_VERIFICATION' && <p className="mt-2 font-semibold text-purple-800">Waiting for citizens to confirm the fix.</p>}
      {canWork && (
        <div className="mt-3 flex gap-3">
          {task.status === 'OPEN' && <button onClick={start} className="rounded-lg bg-cyan-700 px-5 py-2 text-lg font-bold text-white">Start</button>}
          <button onClick={() => setClosing(!closing)} className="rounded-lg bg-green-700 px-5 py-2 text-lg font-bold text-white">Close…</button>
        </div>
      )}
      {err && <p className="mt-2 font-semibold text-red-700">{err}</p>}
      {closing && canWork && incident && <CloseForm task={task} incident={incident} onDone={reload} />}
    </div>
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
    <div className="mx-auto max-w-4xl space-y-4">
      <h2 className="text-3xl font-extrabold">Department queue: {code}</h2>
      <p className="text-slate-600">Most urgent first.</p>
      {tasks && !active.length && <p className="text-lg text-slate-600">No active tasks.</p>}
      {active.map((t) => (
        <TaskCard key={t.id} task={t} incident={incOf(t.incident_id)} depTask={all?.find((x) => x.id === t.depends_on_task_id)} reload={reload} />
      ))}
      {done.length > 0 && <h3 className="pt-4 text-xl font-bold text-slate-700">Closed ({done.length})</h3>}
      {done.map((t) => (
        <TaskCard key={t.id} task={t} incident={incOf(t.incident_id)} reload={reload} />
      ))}
    </div>
  )
}
