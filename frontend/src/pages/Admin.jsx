import { useEffect, useRef, useState } from 'react'
import { MapContainer, TileLayer, CircleMarker, Polyline, Popup } from 'react-leaflet'
import { api } from '../api'
import { usePolling } from '../hooks'
import EventBadge, { fmtTs } from '../components/EventBadge'
import { CustomHours, notifyClock } from '../components/FastForward'
import FitIncidents from '../components/FitIncidents'
import { Button, Card, PageHeader, StatusKey } from '../components/ui'
import { DEMO_CENTER } from '../constants'
import { useT } from '../i18n'
import { clusterColor, fixedColor, priorityColor } from '../lib/theme'

function Stat({ label, value, tone = 'text-navy-900' }) {
  return (
    <Card className="p-4">
      <div className={`text-4xl font-bold ${tone}`}>{value ?? '-'}</div>
      <div className="mt-1 text-sm text-muted-foreground">{label}</div>
    </Card>
  )
}

function Bar({ pct, color }) {
  return (
    <div className="h-3 w-full rounded-sm bg-navy-50">
      <div className={`h-3 rounded-sm ${color}`} style={{ width: `${pct ?? 0}%` }} />
    </div>
  )
}

function IncidentMap({ incidents }) {
  const byCluster = {}
  incidents.forEach((i) => i.cluster_id && (byCluster[i.cluster_id] ||= []).push(i))
  return (
    <MapContainer center={DEMO_CENTER} zoom={14} scrollWheelZoom={false} style={{ height: 440 }} className="rounded">
      <TileLayer
        attribution="&copy; OpenStreetMap contributors"
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FitIncidents incidents={incidents} />
      {Object.entries(byCluster).map(([id, members]) =>
        members.slice(1).map((m, k) => (
          <Polyline
            key={`${id}-${k}`}
            positions={[[members[0].lat, members[0].lng], [m.lat, m.lng]]}
            pathOptions={{ color: clusterColor(), weight: 3, dashArray: '8 6' }}
          />
        )),
      )}
      {incidents.map((i) => (
        <CircleMarker
          key={i.id}
          center={[i.lat, i.lng]}
          radius={8 + Math.min(i.report_count, 8)}
          pathOptions={{
            color: clusterColor(),
            weight: i.status === 'RESOLVED' ? 1 : 2,
            fillColor: i.status === 'RESOLVED' ? fixedColor() : priorityColor(i.priority),
            fillOpacity: 0.85,
          }}
        >
          <Popup>
            <b>#{i.id} {i.summary}</b>
            <br />
            {i.category.replace('_', ' ')} · {i.priority} · {i.status}
            <br />
            {i.report_count} report(s)
            {i.cluster_id ? ` · cluster #${i.cluster_id}` : ''}
          </Popup>
        </CircleMarker>
      ))}
    </MapContainer>
  )
}

function Feed() {
  const t = useT()
  const [events, setEvents] = useState([])
  const lastId = useRef(0)
  useEffect(() => {
    let alive = true
    const poll = async () => {
      try {
        // limit returns the FIRST n events by id, so the initial load fetches all and keeps the newest 40
        const first = !lastId.current
        let fresh = await api.get(`/events?since_id=${lastId.current}&limit=1000`)
        if (first) fresh = fresh.slice(-40)
        if (!alive || !fresh.length) return
        lastId.current = fresh[fresh.length - 1].id
        setEvents((old) => [...fresh.reverse(), ...old].slice(0, 150))
      } catch {
        /* keep polling */
      }
    }
    poll()
    const id = setInterval(poll, 3000)
    window.__resetFeed = () => {
      lastId.current = 0
      setEvents([])
    }
    return () => {
      alive = false
      clearInterval(id)
    }
  }, [])
  return (
    <Card className="h-[640px] overflow-y-auto p-4">
      <h3 className="mb-3 text-xl font-semibold">{t('admin.feed')}</h3>
      {!events.length && <p className="text-muted-foreground">No events yet.</p>}
      <ul className="space-y-2">
        {events.map((e) => (
          <li key={e.id} className="border-b border-border pb-2 text-sm">
            <div className="flex items-center gap-2">
              <EventBadge type={e.type} />
              <span className="text-xs text-muted-foreground">{fmtTs(e.ts)} · {e.actor}</span>
            </div>
            <div className="mt-1">{e.reason}</div>
          </li>
        ))}
      </ul>
    </Card>
  )
}

export default function Admin() {
  const t = useT()
  const { data: incidents } = usePolling(() => api.get('/incidents'), 3000)
  const { data: stats, reload: reloadStats } = usePolling(() => api.get('/admin/stats'), 3000)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  const act = async (label, fn) => {
    setBusy(true)
    setMsg('')
    try {
      await fn()
      setMsg(label + ' done')
    } catch (e) {
      setMsg(`${label} failed: ${e.message}`)
    } finally {
      setBusy(false)
      reloadStats()
    }
  }
  const advance = (h) => act(`+${h}h`, async () => { await api.post('/admin/clock/advance', { hours: h }); notifyClock() })
  const totals = stats?.totals

  return (
    <div className="space-y-5">
      <PageHeader eyebrow={t('admin.eyebrow')} title={t('admin.title')} sub={t('admin.sub')} />
      <Card className="flex flex-wrap items-center gap-2 p-4">
        <span className="mr-2 font-semibold">Simulated clock</span>
        {[1, 24, 72].map((h) => (
          <Button key={h} variant="dark" disabled={busy} onClick={() => advance(h)}>+{h}h</Button>
        ))}
        <CustomHours onAdvance={advance} disabled={busy} id="admin-custom-hours" />
        <Button variant="soft" disabled={busy} onClick={() => act('Clock reset', async () => { await api.post('/admin/clock/reset'); notifyClock() })}>Reset</Button>
        <Button disabled={busy} onClick={() => act('Watchdog', () => api.post('/admin/tick'))}>Run watchdog</Button>
        <span className="mx-2 h-7 border-l border-border" />
        <Button variant="danger" disabled={busy} onClick={() => act('Reset demo', async () => { await api.post('/admin/reset'); window.__resetFeed?.() })}>Reset demo</Button>
        <Button variant="soft" disabled={busy} onClick={() => act('Seed', () => api.post('/admin/seed'))}>Load seed data</Button>
        <span className="text-sm text-muted-foreground">{msg}</span>
      </Card>

      <StatusKey t={t} />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
        <Stat label="Incidents" value={totals?.incidents} />
        <Stat label="Open tasks" value={totals?.open_tasks} />
        <Stat label="Past SLA now" value={totals?.currently_breached} tone="text-danger" />
        <Stat label="Reopens" value={totals?.reopens} tone="text-danger" />
        <Stat label="Low-confidence closes" value={totals?.low_confidence_closures} tone="text-warn" />
        <Stat label="Avg resolution (h)" value={stats?.avg_resolution_hours} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="min-w-0 space-y-4 lg:col-span-2">
          <Card className="p-3"><IncidentMap incidents={incidents || []} /></Card>
          <Card className="p-5">
            <h3 className="mb-3 text-xl font-semibold">{t('admin.perf')}</h3>
            <div className="grid items-center gap-x-4 gap-y-4 text-sm sm:grid-cols-[170px_1fr_1fr] sm:gap-y-3">
              <span className="hidden sm:block" />
              <span className="hidden font-semibold text-ink sm:block">SLA compliance %</span>
              <span className="hidden font-semibold text-ink sm:block">Reopen rate %</span>
              {(stats?.by_department || []).map((d) => (
                <div key={d.code} className="grid gap-1.5 sm:contents">
                  <span className="font-semibold">{d.name}<span className="ml-1 font-normal text-muted-foreground">({d.total_tasks})</span></span>
                  <div className="flex items-center gap-2"><span className="w-20 shrink-0 text-xs text-muted-foreground sm:hidden">SLA %</span><Bar pct={d.sla_compliance_pct} color="bg-ok" /><span className="w-10 shrink-0 text-right">{d.sla_compliance_pct ?? '-'}</span></div>
                  <div className="flex items-center gap-2"><span className="w-20 shrink-0 text-xs text-muted-foreground sm:hidden">Reopen %</span><Bar pct={d.reopen_rate_pct} color="bg-danger" /><span className="w-10 shrink-0 text-right">{d.reopen_rate_pct ?? '-'}</span></div>
                </div>
              ))}
            </div>
            <p className="mt-4 text-sm">
              Escalations:{' '}
              {Object.entries(stats?.escalations_by_level || {}).map(([k, v]) => (
                <span key={k} className="mr-3"><b>{v}</b> to {k}</span>
              ))}
            </p>
          </Card>
        </div>
        <Feed />
      </div>
    </div>
  )
}
