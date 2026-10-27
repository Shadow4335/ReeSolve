import { useEffect, useState } from 'react'
import { flushSync } from 'react-dom'
import { api } from './api'
import Layout from './components/layout/Layout'
import Overview from './pages/Overview'
import Report from './pages/Report'
import Projects from './pages/Projects'
import Track from './pages/Track'
import Department from './pages/Department'
import Admin from './pages/Admin'
import Login from './pages/Login'
import { AuthProvider, roleKeyOf, useAuth } from './auth/AuthContext'
import RequireAuth from './auth/RequireAuth'
import { I18nProvider, useT } from './i18n'
import { DEPARTMENTS, deptName } from './lib/departments'
import { addMine } from './lib/friendly'
import { LANDING_PATH, PAGE_PATH, PATH_PAGE, canOpen } from './lib/routes'
import { navigate, splitLocation, useLocation } from './router'

const MENUS = {
  citizen: [['overview', 'nav.overview'], ['report', 'nav.report'], ['projects', 'nav.projects'], ['requests', 'nav.requests']],
  department: [['queue', 'nav.queue']],
  admin: [['admin', 'nav.operations']],
}

function SimClock() {
  const t = useT()
  const [now, setNow] = useState(null)
  useEffect(() => {
    const tick = () => api.get('/admin/clock').then((c) => setNow(c.now)).catch(() => setNow(null))
    tick()
    const id = setInterval(tick, 3000)
    return () => clearInterval(id)
  }, [])
  return (
    <div className="rounded border border-border bg-navy-50 px-2.5 py-1.5 text-xs">
      <span className="font-semibold text-muted-foreground">{t('clock.label')}</span>{' '}
      <span className="font-mono tabular-nums text-ink">{now ? now.replace('T', ' ').slice(0, 16) : '--'}</span>
    </div>
  )
}

function UserBlock({ session, requireLogin, onSignOut }) {
  const t = useT()
  const roleLabel = session.role === 'department' ? t('role.staff', { name: deptName(session.department) }) : session.role === 'admin' ? t('role.admin') : t('role.resident')
  return (
    <div className="flex items-center gap-2 rounded border border-border bg-white py-1 pl-1 pr-2">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-navy-50 text-sm font-bold text-navy-700">{session.name.trim()[0]?.toUpperCase() || '?'}</span>
      <div className="min-w-0 leading-tight">
        <div className="max-w-[9rem] truncate text-sm font-semibold">{session.name}</div>
        <div className="max-w-[9rem] truncate text-xs text-muted-foreground">{roleLabel}</div>
      </div>
      {requireLogin && (
        <button onClick={onSignOut} className="ml-1 rounded border border-navy-700 bg-white px-2 py-1 text-xs font-semibold text-navy-700 hover:bg-navy-50">
          {t('auth.signOut')}
        </button>
      )}
    </div>
  )
}

function Frame({ path }) {
  const t = useT()
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
    setTimeout(() => { flushSync(() => signOut()); navigate('/login', { replace: true }) }, 220)
  }

  const nav = MENUS[role].map(([key, labelKey]) => ({ key, label: t(labelKey), active: page === key, onClick: () => go(key) }))
  const controls = (
    <>
      <label className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
        {t('role.viewingAs')}
        <select id="role-switch" value={roleKeyOf(session)} onChange={(e) => changeRole(e.target.value)} className="rounded border border-border bg-white px-2 py-1.5 text-sm font-medium text-ink">
          <option value="citizen">{t('role.resident')}</option>
          {DEPARTMENTS.map(([c, n]) => <option key={c} value={`dept:${c}`}>{t('role.department', { name: n })}</option>)}
          <option value="admin">{t('role.admin')}</option>
        </select>
      </label>
      <UserBlock session={session} requireLogin={requireLogin} onSignOut={softSignOut} />
      <SimClock />
    </>
  )

  return (
    <div className={`transition-opacity duration-200 ${leaving ? 'opacity-0' : ''}`}>
      <Layout nav={nav} controls={controls} quickLinks={nav}>
        <div key={page} className="animate-page-in">
          {page === 'overview' && <Overview go={go} />}
          {page === 'report' && <Report category={reportCategory} onFollow={followRequest} />}
          {page === 'projects' && <Projects go={go} />}
          {page === 'requests' && <Track focusIncident={focus.incidentId} go={go} />}
          {page === 'queue' && <Department code={session.department} />}
          {page === 'admin' && <Admin />}
        </div>
      </Layout>
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
    <I18nProvider>
      <AuthProvider>
        <Routes />
      </AuthProvider>
    </I18nProvider>
  )
}
