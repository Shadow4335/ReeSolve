import { useState } from 'react'
import { api } from '../api'
import { usePolling } from '../hooks'
import { CATEGORY_ICON } from '../components/Icon'
import SlaBadge from '../components/SlaBadge'
import { Button, Card, Chip, IconTile, PageHeader } from '../components/ui'
import { useT } from '../i18n'
import { addMine, fmtWhen, friendlyEvent, loadMine, requestId, saveMine, statusChip } from '../lib/friendly'

function VerifyPanel({ task, reports, reportId, onDone }) {
  const t = useT()
  const askable = reports.slice(0, 5)
  const [rid, setRid] = useState(askable.some((r) => r.id === reportId) ? reportId : askable[0]?.id)
  const [comment, setComment] = useState('')
  const [err, setErr] = useState('')
  const send = async (fixed) => {
    setErr('')
    try {
      await api.post(`/tasks/${task.id}/verify-response`, { report_id: Number(rid), fixed, comment: comment || null })
      setComment('')
      onDone()
    } catch (e) {
      setErr(e.message)
    }
  }
  return (
    <div className="mt-4 rounded border border-warn bg-warn-tint p-4 text-ink">
      <p className="font-semibold">The team says this is fixed. Is it?</p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button variant="success" onClick={() => send(true)}>{t('btn.yesFixed')}</Button>
        <Button variant="soft" onClick={() => send(false)}>{t('btn.noFixed')}</Button>
        <input className="min-w-[180px] flex-1 rounded-xl border border-border bg-card px-3 py-2 text-sm text-foreground" placeholder="Add a note (optional)" value={comment} onChange={(e) => setComment(e.target.value)} />
      </div>
      <label className="mt-3 flex items-center gap-2 text-xs">
        Answering as reporter:
        <select className="rounded-lg border border-border bg-card px-2 py-1 text-foreground" value={rid} onChange={(e) => setRid(e.target.value)}>
          {askable.map((r) => <option key={r.id} value={r.id}>#{r.id} {r.reporter_name || 'anonymous'}</option>)}
        </select>
      </label>
      {err && <p className="mt-2 text-sm font-semibold text-destructive">{err}</p>}
    </div>
  )
}

function RequestCard({ incidentId, reportId, onRemove }) {
  const t = useT()
  const { data: inc, error, reload } = usePolling(() => api.get(`/incidents/${incidentId}`), 3000, [incidentId])
  const { data: all } = usePolling(() => api.get('/tasks'), 6000)
  if (!inc && error) {
    // e.g. the demo database was reset and this incident no longer exists
    return (
      <Card className="p-6">
        <p className="font-semibold">{requestId(incidentId)} is no longer available.</p>
        <p className="mt-1 text-sm text-muted-foreground">It may have been removed when the demo data was reset.</p>
        <button className="mt-3 text-sm font-semibold text-navy-700 underline" onClick={onRemove}>Stop following</button>
      </Card>
    )
  }
  if (!inc) return <Card className="p-6 text-muted-foreground">Loading request…</Card>
  const task = inc.tasks[0]
  const chip = statusChip(task, inc)
  const deptOf = (id) => all?.find((x) => x.id === id)?.department_name
  const lines = inc.events.map((e) => ({ e, text: friendlyEvent(e, task?.department_name) })).filter((x) => x.text)
  return (
    <Card className="p-6">
      <div className="flex flex-wrap items-start gap-4">
        <IconTile name={CATEGORY_ICON[inc.category]} className="h-12 w-12" />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold tracking-wider text-muted-foreground">{requestId(inc.id)}</p>
          <h2 className="text-xl font-semibold">{inc.summary}</h2>
          <p className="text-sm text-muted-foreground">
            {task?.department_name} · Handled by {task?.escalation_level_label}
            {inc.report_count > 1 ? ` · ${inc.report_count} residents reported this` : ''}
          </p>
        </div>
        <Chip tone={chip.tone}>{t(chip.key)}</Chip>
      </div>

      {task && <div className="mt-3"><SlaBadge task={task} /></div>}
      {task?.status === 'BLOCKED' && (
        <p className="mt-3 rounded border border-paused bg-paused-tint p-3 text-sm font-medium text-ink">
          Waiting for {deptOf(task.depends_on_task_id) || 'another team'} to finish first. The clock is paused, so no one is penalised for waiting.
        </p>
      )}
      {task?.status === 'PENDING_VERIFICATION' && <VerifyPanel task={task} reports={inc.reports} reportId={reportId} onDone={reload} />}
      {task?.reopen_count > 0 && <p className="mt-3 text-sm text-muted-foreground">Reopened {task.reopen_count} time{task.reopen_count > 1 ? 's' : ''}: we don't accept a fix residents don't confirm.</p>}

      <ol className="relative ml-1.5 mt-6 border-l-2 border-border">
        {lines.map(({ e, text }) => (
          <li key={e.id} className="mb-4 ml-5">
            <span className="absolute -left-[7px] mt-1.5 h-3 w-3 rounded-full border-2 border-white bg-navy-700" />
            <p className="font-medium">{text}</p>
            <p className="text-xs text-muted-foreground">{fmtWhen(e.ts)}</p>
            <details className="text-xs text-muted-foreground">
              <summary className="cursor-pointer select-none hover:underline">Why?</summary>
              <p className="mt-1">{e.reason}</p>
            </details>
          </li>
        ))}
      </ol>
      {inc.cluster && <p className="rounded-xl bg-accent p-3 text-sm"><b>Related problems nearby:</b> {inc.cluster.coordination_note}</p>}
      <button className="mt-3 text-xs text-muted-foreground hover:underline" onClick={onRemove}>Stop following</button>
    </Card>
  )
}

export default function Track({ focusIncident, go }) {
  const t = useT()
  const [mine, setMine] = useState(() => loadMine())
  const { data: incidents } = usePolling(() => api.get('/incidents'), 5000)
  const remove = (id) => { const n = mine.filter((m) => m.incidentId !== id); saveMine(n); setMine(n) }
  const ordered = focusIncident ? [...mine].sort((a, b) => (b.incidentId === focusIncident) - (a.incidentId === focusIncident)) : mine

  return (
    <div>
      <PageHeader eyebrow={t('track.eyebrow')} title={t('track.title')} sub={t('track.sub')} />
      <div className="space-y-5">
        {!ordered.length && (
          <Card className="p-6">
            <p className="font-semibold">You aren't following any request yet.</p>
            <p className="mt-1 text-sm text-muted-foreground">Reports you submit appear here with a live, plain-language timeline.</p>
            <Button className="mt-4" onClick={() => go('report')}>{t('btn.report')}</Button>
          </Card>
        )}
        {ordered.map((m) => <RequestCard key={m.incidentId} incidentId={m.incidentId} reportId={m.reportId} onRemove={() => remove(m.incidentId)} />)}
      </div>

      <details className="mt-8 rounded-xl border border-dashed border-border p-4 text-sm">
        <summary className="cursor-pointer font-semibold">Demo tools: follow any incident as a resident</summary>
        <select
          className="mt-3 w-full max-w-md rounded-xl border border-border bg-card px-3 py-2"
          defaultValue=""
          onChange={(e) => { if (e.target.value) setMine(addMine(Number(e.target.value), null)) }}
        >
          <option value="">Choose an incident…</option>
          {(incidents || []).map((i) => <option key={i.id} value={i.id}>{requestId(i.id)} · {i.summary.slice(0, 60)}</option>)}
        </select>
      </details>
    </div>
  )
}
