import { useEffect, useRef, useState } from 'react'
import { MapContainer, TileLayer, CircleMarker, Polyline, Popup } from 'react-leaflet'
import { api } from '../api'
import { usePolling } from '../hooks'
import EventBadge, { fmtTs } from '../components/EventBadge'
import { CLUSTER_COLOR, DEMO_CENTER, PRIORITY_COLOR } from '../constants'

function Stat({ label, value, tone = 'text-slate-900' }) {
  return (
    <div className="rounded-lg bg-white p-4 shadow">
      <div className={`text-3xl font-extrabold ${tone}`}>{value ?? '-'}</div>
      <div className="text-sm text-slate-600">{label}</div>
    </div>
  )
}

function Bar({ pct, color }) {
  return (
    <div className="h-4 w-full rounded bg-slate-200">
      <div className={`h-4 rounded ${color}`} style={{ width: `${pct ?? 0}%` }} />
    </div>
  )
}

function IncidentMap({ incidents }) {
  const byCluster = {}
  incidents.forEach((i) => i.cluster_id && (byCluster[i.cluster_id] ||= []).push(i))
  return (
    <MapContainer center={DEMO_CENTER} zoom={14} scrollWheelZoom={false} style={{ height: 440 }} className="rounded-lg shadow">
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
    <div className="h-[600px] overflow-y-auto rounded-lg bg-white p-3 shadow">
      <h3 className="mb-2 text-lg font-bold">Live feed</h3>
      {!events.length && <p className="text-slate-500">No events yet.</p>}
      <ul className="space-y-2">
        {events.map((e) => (
          <li key={e.id} className="border-b border-slate-100 pb-2 text-sm">
            <div className="flex items-center gap-2">
              <EventBadge type={e.type} />
              <span className="text-xs text-slate-500">{fmtTs(e.ts)} · {e.actor}</span>
            </div>
            <div className="mt-1 text-slate-800">{e.reason}</div>
          </li>
        ))}
      </ul>
    </div>
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

  const btn = 'rounded-lg px-4 py-2 text-lg font-bold text-white disabled:opacity-50'
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 rounded-lg bg-white p-4 shadow">
        <span className="text-lg font-bold">Simulated clock</span>
        {[1, 24, 72].map((h) => (
          <button key={h} disabled={busy} onClick={() => advance(h)} className={`${btn} bg-slate-800`}>
            +{h}h
          </button>
        ))}
        <button disabled={busy} onClick={() => act('Clock reset', () => api.post('/admin/clock/reset'))} className={`${btn} bg-slate-500`}>
          Reset
        </button>
        <button disabled={busy} onClick={() => act('Watchdog', () => api.post('/admin/tick'))} className={`${btn} bg-blue-700`}>
          Run watchdog
        </button>
        <span className="mx-2 h-8 border-l border-slate-300" />
        <button
          disabled={busy}
          onClick={() => act('Reset demo', async () => { await api.post('/admin/reset'); window.__resetFeed?.() })}
          className={`${btn} bg-red-700`}
        >
          Reset demo
        </button>
        <button disabled={busy} onClick={() => act('Seed', () => api.post('/admin/seed'))} className={`${btn} bg-green-700`}>
          Load seed data
        </button>
        <span className="text-sm text-slate-600">{msg}</span>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
        <Stat label="Incidents" value={t?.incidents} />
        <Stat label="Open tasks" value={t?.open_tasks} />
        <Stat label="Past SLA now" value={t?.currently_breached} tone="text-red-600" />
        <Stat label="Reopens" value={t?.reopens} tone="text-orange-600" />
        <Stat label="Low-confidence closes" value={t?.low_confidence_closures} tone="text-amber-600" />
        <Stat label="Avg resolution (h)" value={stats?.avg_resolution_hours} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <IncidentMap incidents={incidents || []} />
          <div className="rounded-lg bg-white p-4 shadow">
            <h3 className="mb-3 text-lg font-bold">Department performance</h3>
            <div className="grid grid-cols-[170px_1fr_1fr] items-center gap-x-4 gap-y-2 text-sm">
              <span />
              <span className="font-semibold text-green-700">SLA compliance %</span>
              <span className="font-semibold text-orange-700">Reopen rate %</span>
              {(stats?.by_department || []).map((d) => (
                <div key={d.code} className="contents">
                  <span className="font-semibold">{d.name}<span className="ml-1 text-slate-500">({d.total_tasks})</span></span>
                  <div className="flex items-center gap-2">
                    <Bar pct={d.sla_compliance_pct} color="bg-green-500" />
                    <span className="w-10 text-right">{d.sla_compliance_pct ?? '-'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Bar pct={d.reopen_rate_pct} color="bg-orange-500" />
                    <span className="w-10 text-right">{d.reopen_rate_pct ?? '-'}</span>
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-3 text-sm text-slate-700">
              Escalations:{' '}
              {Object.entries(stats?.escalations_by_level || {}).map(([k, v]) => (
                <span key={k} className="mr-3"><b>{v}</b> to {k}</span>
              ))}
            </p>
          </div>
        </div>
        <Feed />
      </div>
    </div>
  )
}
