import { useEffect, useState } from 'react'
import { api } from '../api'
import { usePolling } from '../hooks'
import SlaBadge from '../components/SlaBadge'
import EventBadge, { fmtTs } from '../components/EventBadge'

const chip = (status) =>
  ({
    OPEN: 'bg-blue-100 text-blue-800',
    IN_PROGRESS: 'bg-cyan-100 text-cyan-800',
    BLOCKED: 'bg-slate-200 text-slate-700',
    PENDING_VERIFICATION: 'bg-purple-100 text-purple-800',
    CLOSED: 'bg-green-100 text-green-800',
    RESOLVED: 'bg-green-600 text-white',
  })[status] || 'bg-slate-100'

function VerifyPrompt({ task, reports, defaultReportId, onDone }) {
  const askable = reports.slice(0, 5)
  const [reportId, setReportId] = useState(defaultReportId && askable.some((r) => r.id === defaultReportId) ? defaultReportId : askable[0]?.id)
  const [comment, setComment] = useState('')
  const [err, setErr] = useState('')
  const send = async (fixed) => {
    setErr('')
    try {
      await api.post(`/tasks/${task.id}/verify-response`, { report_id: Number(reportId), fixed, comment: comment || null })
      setComment('')
      onDone()
    } catch (e) {
      setErr(e.message)
    }
  }
  return (
    <div className="rounded-xl border-4 border-purple-500 bg-purple-50 p-5">
      <h3 className="text-2xl font-extrabold text-purple-900">Was this fixed?</h3>
      <p className="mb-3 text-purple-900">
        {task.department_name} says the problem is fixed. You reported it, so we are asking you before we close it.
      </p>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <label className="text-sm font-semibold">I am reporter:</label>
        <select className="rounded border p-1" value={reportId} onChange={(e) => setReportId(e.target.value)}>
          {askable.map((r) => (
            <option key={r.id} value={r.id}>#{r.id} {r.reporter_name || 'anonymous'}</option>
          ))}
        </select>
        <input className="min-w-[200px] flex-1 rounded border p-2" placeholder="Optional comment" value={comment} onChange={(e) => setComment(e.target.value)} />
      </div>
      <div className="flex gap-3">
        <button onClick={() => send(true)} className="rounded-lg bg-green-600 px-6 py-3 text-xl font-bold text-white">Yes, it's fixed</button>
        <button onClick={() => send(false)} className="rounded-lg bg-red-600 px-6 py-3 text-xl font-bold text-white">No, still broken</button>
      </div>
      {err && <p className="mt-2 font-semibold text-red-700">{err}</p>}
    </div>
  )
}

export default function Track({ incidentId, reportId, onSelect }) {
  const { data: list } = usePolling(() => api.get('/incidents'), 5000)
  const [sel, setSel] = useState(incidentId)
  useEffect(() => setSel(incidentId), [incidentId])
  const { data: inc, reload } = usePolling(() => (sel ? api.get(`/incidents/${sel}`) : Promise.resolve(null)), 3000, [sel])
  const { data: allTasks } = usePolling(() => api.get('/tasks'), 5000)

  const pending = inc?.tasks.find((t) => t.status === 'PENDING_VERIFICATION')
  const deptOf = (taskId) => allTasks?.find((t) => t.id === taskId)?.department_name

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="flex items-center gap-3">
        <label className="font-semibold">Track incident</label>
        <select
          className="min-w-[300px] rounded border p-2"
          value={sel || ''}
          onChange={(e) => { setSel(Number(e.target.value)); onSelect?.(Number(e.target.value)) }}
        >
          <option value="">Select…</option>
          {(list || []).map((i) => (
            <option key={i.id} value={i.id}>#{i.id} {i.summary.slice(0, 60)}</option>
          ))}
        </select>
      </div>

      {!inc && <p className="text-slate-600">Pick an incident to see its status and timeline.</p>}
      {inc && (
        <>
          <div className="rounded-xl bg-white p-5 shadow">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-2xl font-extrabold">#{inc.id} {inc.summary}</h2>
              <span className={`rounded px-3 py-1 text-lg font-bold ${chip(inc.status)}`}>{inc.status}</span>
              <span className="rounded bg-slate-100 px-3 py-1 text-lg font-semibold">{inc.priority} priority</span>
              <span className="text-slate-600">{inc.report_count} report(s)</span>
            </div>
            {inc.tasks.map((t) => (
              <div key={t.id} className="mt-4 rounded-lg border p-3">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-lg font-bold">{t.department_name}</span>
                  <span className={`rounded px-2 py-1 font-semibold ${chip(t.status)}`}>{t.status.replace('_', ' ')}</span>
                  <SlaBadge task={t} />
                  {t.reopen_count > 0 && <span className="rounded bg-orange-100 px-2 py-1 font-semibold text-orange-800">Reopened ×{t.reopen_count}</span>}
                  {t.closure_confidence && <span className="text-sm text-slate-600">closed: {t.closure_confidence}</span>}
                </div>
                {t.status === 'BLOCKED' && (
                  <p className="mt-2 rounded bg-slate-100 p-2 font-semibold text-slate-700">
                    Waiting for {deptOf(t.depends_on_task_id) || 'another department'} to finish first.
                  </p>
                )}
              </div>
            ))}
            {inc.cluster && (
              <p className="mt-4 rounded bg-purple-50 p-3 text-purple-900">
                <b>Related incidents:</b> {inc.cluster.coordination_note}
              </p>
            )}
          </div>

          {pending && <VerifyPrompt task={pending} reports={inc.reports} defaultReportId={reportId} onDone={reload} />}

          <div className="rounded-xl bg-white p-5 shadow">
            <h3 className="mb-3 text-xl font-bold">Timeline</h3>
            <ol className="relative ml-3 border-l-4 border-slate-200">
              {inc.events.map((e) => (
                <li key={e.id} className="mb-4 ml-5">
                  <span className="absolute -left-[10px] mt-1 h-4 w-4 rounded-full border-2 border-white bg-slate-500" />
                  <div className="flex items-center gap-2">
                    <EventBadge type={e.type} />
                    <span className="text-xs text-slate-500">{fmtTs(e.ts)} · {e.actor}</span>
                  </div>
                  <div className="mt-1 text-slate-800">{e.reason}</div>
                </li>
              ))}
            </ol>
          </div>
        </>
      )}
    </div>
  )
}
