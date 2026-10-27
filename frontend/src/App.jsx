import { useEffect, useState } from 'react'
import { flushSync } from 'react-dom'
import { api } from './api'
import Icon from './components/Icon'
import Logo from './components/Logo'
import Overview from './pages/Overview'
import Report from './pages/Report'
import Projects from './pages/Projects'
import Track from './pages/Track'
import Department from './pages/Department'
import Admin from './pages/Admin'
import Login from './pages/Login'
import { AuthProvider, roleKeyOf, useAuth } from './auth/AuthContext'
import RequireAuth from './auth/RequireAuth'
import { DEPARTMENTS, deptName } from './lib/departments'
import { addMine } from './lib/friendly'
import { LANDING_PATH, PAGE_PATH, PATH_PAGE, canOpen } from './lib/routes'
import { navigate, splitLocation, useLocation } from './router'

const MENUS = {
  citizen: [['overview', 'Overview', 'grid'], ['report', 'Report a problem', 'plus'], ['projects', 'City projects', 'folder'], ['requests', 'My requests', 'clipboard']],
  department: [['queue', 'Task queue', 'clipboard']],
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

function UserBlock({ session, requireLogin, onSignOut }) {
  const roleLabel = session.role === 'department' ? `${deptName(session.department)} staff` : session.role === 'admin' ? 'City admin' : 'Resident'
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent font-semibold text-primary">{session.name.trim()[0]?.toUpperCase() || '?'}</span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold">{session.name}</div>
          <div className="truncate text-xs text-muted-foreground">{roleLabel}</div>
        </div>
      </div>
      {requireLogin && (
        <button onClick={onSignOut} className="mt-3 w-full rounded-lg border border-border px-3 py-1.5 text-sm font-medium hover:bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
          Sign out
        </button>
      )}
    </div>
  )
}

function Frame({ path }) {
  const { session, requireLogin, signOut, setRoleKey } = useAuth()
  const [reportCategory, setReportCategory] = useState(null)
  const [focus, setFocus] = useState({ incidentId: null })
  const [leaving, setLeaving] = useState(false)
  const role = session?.role || 'citizen'
  const page = PATH_PAGE[path]

  // Unknown URL, or a page this role cannot open: go to the role's landing page.
  useEffect(() => { if (!canOpen(role, path)) navigate(LANDING_PATH[role], { replace: true }) }, [role, path])
  if (!session) return null

  const go = (p, opts = {}) => {
    if (p === 'report') setReportCategory(opts.category || null)
    navigate(PAGE_PATH[p])
  }
  const changeRole = (key) => {
    setRoleKey(key)
    navigate(LANDING_PATH[key.startsWith('dept:') ? 'department' : key === 'admin' ? 'admin' : 'citizen'])
  }
  const followRequest = (incidentId, reportId) => {
    addMine(incidentId, reportId)
    setFocus({ incidentId })
    navigate(PAGE_PATH.requests)
  }
  const softSignOut = () => {
    setLeaving(true)
    // Clear the session synchronously first so /login never renders while still signed in (no bogus ?from=).
    setTimeout(() => { flushSync(() => signOut()); navigate('/login', { replace: true }) }, 260)
  }

  return (
    <div className={`min-h-screen animate-page-in transition-opacity duration-300 md:flex ${leaving ? 'opacity-0' : ''}`}>
      <aside className="shrink-0 border-b border-border bg-sidebar p-4 md:sticky md:top-0 md:flex md:h-screen md:w-60 md:flex-col md:overflow-y-auto md:border-b-0 md:border-r">
        <Logo />

        <label htmlFor="role-switch" className="mt-5 block text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Viewing as</label>
        <select id="role-switch" value={roleKeyOf(session)} onChange={(e) => changeRole(e.target.value)} className="mt-1 w-full rounded-xl border border-border bg-card px-3 py-2 text-sm font-medium">
          <option value="citizen">Resident</option>
          {DEPARTMENTS.map(([c, n]) => <option key={c} value={`dept:${c}`}>Department: {n}</option>)}
          <option value="admin">City admin</option>
        </select>

        <p className="mt-5 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Menu</p>
        <nav className="mt-2 flex gap-1 overflow-x-auto md:flex-col">
          {MENUS[role].map(([key, label, icon]) => (
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
          <UserBlock session={session} requireLogin={requireLogin} onSignOut={softSignOut} />
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
          {page === 'queue' && <Department code={session.department} />}
          {page === 'admin' && <Admin />}
        </div>
      </main>
    </div>
  )
}

function Routes() {
  const { path } = splitLocation(useLocation())
  if (path === '/login') return <Login />
  return <RequireAuth><Frame path={path} /></RequireAuth>
}

export default function App() {
  return (
    <AuthProvider>
      <Routes />
    </AuthProvider>
  )
}
