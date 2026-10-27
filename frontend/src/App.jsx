import { useEffect, useState } from 'react'
import { api } from './api'
import Icon from './components/Icon'
import Overview from './pages/Overview'
import Report from './pages/Report'
import Projects from './pages/Projects'
import Track from './pages/Track'
import Department from './pages/Department'
import Admin from './pages/Admin'
import { addMine } from './lib/friendly'

const DEPARTMENTS = [
  ['ROADS', 'Roads & Infrastructure'], ['WATER', 'Water & Sewerage'], ['DRAIN', 'Drainage'], ['SANI', 'Sanitation'], ['ELEC', 'Electrical'],
]

const MENUS = {
  citizen: [['overview', 'Overview', 'grid'], ['report', 'Report a problem', 'plus'], ['projects', 'City projects', 'folder'], ['requests', 'My requests', 'clipboard']],
  dept: [['queue', 'Task queue', 'clipboard']],
  admin: [['admin', 'Operations', 'grid']],
}

function SimClock() {
  const [now, setNow] = useState(null)
  useEffect(() => {
    const tick = () => api.get('/admin/clock').then((c) => setNow(c.now)).catch(() => setNow(null))
    tick()
    const id = setInterval(tick, 3000)
    return () => clearInterval(id)
  }, [])
  return (
    <div className="rounded-xl bg-muted px-3 py-2 text-xs text-muted-foreground">
      <div className="font-semibold uppercase tracking-wider">Simulated time</div>
      <div className="mt-0.5 font-mono text-sm text-foreground">{now ? now.replace('T', ' ').slice(0, 16) : '--'}</div>
    </div>
  )
}

export default function App() {
  const [role, setRole] = useState('citizen') // citizen | dept:<CODE> | admin
  const [page, setPage] = useState('overview')
  const [reportCategory, setReportCategory] = useState(null)
  const [focus, setFocus] = useState({ incidentId: null })
  const kind = role === 'citizen' ? 'citizen' : role === 'admin' ? 'admin' : 'dept'

  const changeRole = (r) => {
    setRole(r)
    setPage(r === 'admin' ? 'admin' : r.startsWith('dept:') ? 'queue' : 'overview')
  }
  const go = (p, opts = {}) => {
    if (p === 'report') setReportCategory(opts.category || null)
    setPage(p)
  }
  const followRequest = (incidentId, reportId) => {
    addMine(incidentId, reportId)
    setFocus({ incidentId })
    setPage('requests')
  }

  return (
    <div className="min-h-screen md:flex">
      <aside className="shrink-0 border-b border-border bg-sidebar p-4 md:sticky md:top-0 md:flex md:h-screen md:w-60 md:flex-col md:border-b-0 md:border-r">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary font-display text-lg font-semibold text-primary-foreground">R</span>
          <div>
            <div className="font-display text-xl font-semibold leading-none">ReeSolve</div>
            <div className="mt-1 text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">Your city, in sync</div>
          </div>
        </div>

        <label className="mt-5 block text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Viewing as</label>
        <select value={role} onChange={(e) => changeRole(e.target.value)} className="mt-1 w-full rounded-xl border border-border bg-card px-3 py-2 text-sm font-medium">
          <option value="citizen">Resident</option>
          {DEPARTMENTS.map(([c, n]) => <option key={c} value={`dept:${c}`}>Department: {n}</option>)}
          <option value="admin">City admin</option>
        </select>

        <p className="mt-5 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Menu</p>
        <nav className="mt-2 flex gap-1 overflow-x-auto md:flex-col">
          {MENUS[kind].map(([key, label, icon]) => (
            <button
              key={key}
              onClick={() => go(key)}
              className={`flex items-center gap-3 whitespace-nowrap rounded-xl px-3 py-2.5 text-sm font-medium ${page === key ? 'bg-sidebar-accent' : 'hover:bg-muted'}`}
            >
              <Icon name={icon} className="h-4 w-4" />
              {label}
            </button>
          ))}
        </nav>

        <div className="mt-4 space-y-3 md:mt-auto">
          <SimClock />
          <div className="rounded-xl border border-peach bg-peach p-3 text-peach-foreground">
            <div className="flex items-center gap-2 text-sm font-semibold"><Icon name="phone" className="h-4 w-4" /> Need urgent help?</div>
            <p className="mt-1 text-xs">For danger to life, call 112.</p>
          </div>
        </div>
      </aside>

      <main className="min-w-0 flex-1 p-6 md:p-10">
        <div className="mx-auto max-w-5xl">
          {page === 'overview' && <Overview go={go} />}
          {page === 'report' && <Report category={reportCategory} onFollow={followRequest} />}
          {page === 'projects' && <Projects go={go} />}
          {page === 'requests' && <Track focusIncident={focus.incidentId} go={go} />}
          {page === 'queue' && <Department code={role.replace('dept:', '')} />}
          {page === 'admin' && <Admin />}
        </div>
      </main>
    </div>
  )
}
