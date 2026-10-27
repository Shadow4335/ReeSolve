import { useEffect, useState } from 'react'
import { api } from './api'
import Report from './pages/Report'
import Track from './pages/Track'
import Department from './pages/Department'
import Admin from './pages/Admin'

const DEPARTMENTS = ['ROADS', 'WATER', 'DRAIN', 'SANI', 'ELEC']

function ClockBadge() {
  const [now, setNow] = useState(null)
  useEffect(() => {
    const tick = () => api.get('/admin/clock').then((c) => setNow(c.now)).catch(() => setNow(null))
    tick()
    const id = setInterval(tick, 3000)
    return () => clearInterval(id)
  }, [])
  return (
    <span className="rounded bg-slate-800 px-3 py-1 font-mono text-sm text-slate-100">
      {now ? `Sim clock: ${now.replace('T', ' ').slice(0, 16)}` : 'Sim clock: --'}
    </span>
  )
}

export default function App() {
  const [role, setRole] = useState('citizen') // citizen | dept:<CODE> | admin
  const [page, setPage] = useState('report')
  const [track, setTrack] = useState({ incidentId: null, reportId: null })

  const changeRole = (r) => {
    setRole(r)
    setPage(r === 'admin' ? 'admin' : r.startsWith('dept:') ? 'department' : 'report')
  }

  const citizenTabs = [['report', 'Report'], ['track', 'Track']]

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="flex flex-wrap items-center gap-4 bg-slate-900 px-6 py-3 text-white">
        <h1 className="text-xl font-bold">ReeSolve</h1>
        <select
          className="rounded bg-slate-700 px-2 py-1"
          value={role}
          onChange={(e) => changeRole(e.target.value)}
        >
          <option value="citizen">Citizen</option>
          {DEPARTMENTS.map((d) => (
            <option key={d} value={`dept:${d}`}>Department: {d}</option>
          ))}
          <option value="admin">Admin</option>
        </select>
        {role === 'citizen' && citizenTabs.map(([k, label]) => (
          <button key={k} onClick={() => setPage(k)} className={page === k ? 'font-bold underline' : ''}>
            {label}
          </button>
        ))}
        <div className="ml-auto"><ClockBadge /></div>
      </header>
      <main className="p-6">
        {page === 'report' && <Report onSubmitted={(incidentId, reportId) => { setTrack({ incidentId, reportId }); setPage('track') }} />}
        {page === 'track' && <Track incidentId={track.incidentId} reportId={track.reportId} onSelect={(id) => setTrack({ incidentId: id, reportId: null })} />}
        {page === 'department' && <Department code={role.replace('dept:', '')} />}
        {page === 'admin' && <Admin />}
      </main>
    </div>
  )
}
