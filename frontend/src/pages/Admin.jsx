import { useEffect, useRef, useState } from 'react'
import { MapContainer, TileLayer, CircleMarker, Polyline, Popup } from 'react-leaflet'
import { api } from '../api'
import { usePolling } from '../hooks'
import EventBadge, { fmtTs } from '../components/EventBadge'
import { Button, Card, PageHeader } from '../components/ui'
import { CLUSTER_COLOR, DEMO_CENTER, PRIORITY_COLOR } from '../constants'

function Stat({ label, value, tone = 'text-foreground' }) {
  return (
    <Card className="p-4">
      <div className={`font-display text-4xl font-semibold ${tone}`}>{value ?? '-'}</div>
      <div className="mt-1 text-sm text-muted-foreground">{label}</div>
    </Card>
  )
}

function Bar({ pct, color }) {
  return (
    <div className="h-3 w-full rounded-full bg-muted">
      <div className={`h-3 rounded-full ${color}`} style={{ width: `${pct ?? 0}%` }} />
    </div>
  )
}

function IncidentMap({ incidents }) {
  const byCluster = {}
  incidents.forEach((i) => i.cluster_id && (byCluster[i.cluster_id] ||= []).push(i))
  return (
    <MapContainer center={DEMO_CENTER} zoom={14} scrollWheelZoom={false} style={{ height: 440 }} className="rounded-xl">
      <TileLayer
        attribution="&copy; OpenStreetMap contributors"
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {Object.entries(byCluster).map(([id, members]) =>
        members.slice(1).map((m, k) => (
          <Polyline
            key={`${id}-${k}`}
            positions={[[members[0].lat, members[0].lng], [m.lat, m.lng]]}
            pathOptions={{ color: CLUSTER_COLOR, weight: 4, dashArray: '8 6' }}
          />
        )),
      )}
      {incidents.map((i) => (
        <CircleMarker
          key={i.id}
          center={[i.lat, i.lng]}
          radius={8 + Math.min(i.report_count, 8)}
          pathOptions={{
            color: '#0f172a',
            weight: i.status === 'RESOLVED' ? 1 : 3,
            fillColor: i.status === 'RESOLVED' ? '#94a3b8' : PRIORITY_COLOR[i.priority],
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
      <h3 className="mb-3 text-xl font-semibold">Live feed</h3>
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
  const advance = (h) => act(`+${h}h`, () => api.post('/admin/clock/advance', { hours: h }))
  const t = stats?.totals

  return (
    <div className="space-y-5">
      <PageHeader eyebrow="City admin" title="Operations" sub="Every decision the system makes, with the reason, as it happens." />
      <Card className="flex flex-wrap items-center gap-2 p-4">
        <span className="mr-2 font-semibold">Simulated clock</span>
        {[1, 24, 72].map((h) => (
          <Button key={h} variant="dark" disabled={busy} onClick={() => advance(h)}>+{h}h</Button>
        ))}
        <Button variant="soft" disabled={busy} onClick={() => act('Clock reset', () => api.post('/admin/clock/reset'))}>Reset</Button>
        <Button disabled={busy} onClick={() => act('Watchdog', () => api.post('/admin/tick'))}>Run watchdog</Button>
        <span className="mx-2 h-7 border-l border-border" />
        <Button variant="danger" disabled={busy} onClick={() => act('Reset demo', async () => { await api.post('/admin/reset'); window.__resetFeed?.() })}>Reset demo</Button>
        <Button variant="soft" disabled={busy} onClick={() => act('Seed', () => api.post('/admin/seed'))}>Load seed data</Button>
        <span className="text-sm text-muted-foreground">{msg}</span>
      </Card>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
        <Stat label="Incidents" value={t?.incidents} />
        <Stat label="Open tasks" value={t?.open_tasks} />
        <Stat label="Past SLA now" value={t?.currently_breached} tone="text-destructive" />
        <Stat label="Reopens" value={t?.reopens} tone="text-warn-foreground" />
        <Stat label="Low-confidence closes" value={t?.low_confidence_closures} tone="text-warn-foreground" />
        <Stat label="Avg resolution (h)" value={stats?.avg_resolution_hours} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card className="p-3"><IncidentMap incidents={incidents || []} /></Card>
          <Card className="p-5">
            <h3 className="mb-3 text-xl font-semibold">Department performance</h3>
            <div className="grid grid-cols-[170px_1fr_1fr] items-center gap-x-4 gap-y-3 text-sm">
              <span />
              <span className="font-semibold text-primary">SLA compliance %</span>
              <span className="font-semibold text-destructive">Reopen rate %</span>
              {(stats?.by_department || []).map((d) => (
                <div key={d.code} className="contents">
                  <span className="font-semibold">{d.name}<span className="ml-1 font-normal text-muted-foreground">({d.total_tasks})</span></span>
                  <div className="flex items-center gap-2"><Bar pct={d.sla_compliance_pct} color="bg-primary" /><span className="w-10 text-right">{d.sla_compliance_pct ?? '-'}</span></div>
                  <div className="flex items-center gap-2"><Bar pct={d.reopen_rate_pct} color="bg-destructive" /><span className="w-10 text-right">{d.reopen_rate_pct ?? '-'}</span></div>
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
