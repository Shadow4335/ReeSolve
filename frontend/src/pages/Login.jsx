// DEMO SIGN-IN (frontend only): see src/auth/AuthContext.jsx. Nothing here talks to the backend.
import { useEffect, useRef, useState } from 'react'
import Logo from '../components/Logo'
import NeighborhoodPanel from '../components/login/NeighborhoodPanel'
import RoleTabs from '../components/login/RoleTabs'
import SubmitButton from '../components/login/SubmitButton'
import { FloatingInput, FloatingSelect } from '../components/login/FloatingField'
import { DEMO_ADMIN_CODE } from '../auth/constants'
import { useAuth } from '../auth/AuthContext'
import { DEPARTMENTS } from '../lib/departments'
import { LANDING_PATH, canOpen } from '../lib/routes'
import { navigate, splitLocation, useLocation } from '../router'

const ROLES = [{ key: 'citizen', label: 'Resident' }, { key: 'department', label: 'Department staff' }, { key: 'admin', label: 'Admin' }]
const DEMOS = [
  { label: 'Try as resident', role: 'citizen', values: { name: 'Asha (demo resident)' } },
  { label: 'Try as Roads dept', role: 'department', values: { name: 'Roads desk (demo)', department: 'ROADS' } },
  { label: 'Try as admin', role: 'admin', values: { name: 'City admin (demo)', code: DEMO_ADMIN_CODE } },
]
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const stagger = (n) => ({ animationDelay: `${180 + n * 70}ms` })

function validate(role, v) {
  const e = {}
  if (!v.name.trim()) e.name = role === 'citizen' ? 'Tell us your name or email so we know who is signing in.' : 'Tell us your name so we know who is signing in.'
  if (role === 'department' && !v.department) e.department = 'Pick your department so we can show your queue.'
  if (role === 'admin' && !v.code.trim()) e.code = 'Enter the demo access code (it is shown just below the field).'
  return e
}

export default function Login() {
  const { session, requireLogin, signIn } = useAuth()
  const { params } = splitLocation(useLocation())
  const [tab, setTab] = useState('citizen')       // selected tab
  const [shown, setShown] = useState('citizen')   // fields currently displayed (swaps mid cross-fade)
  const [fading, setFading] = useState(false)
  const [values, setValues] = useState({ name: '', department: '', code: '' })
  const [errors, setErrors] = useState({})
  const [status, setStatus] = useState('idle')    // idle | loading | success
  const [shaking, setShaking] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const [height, setHeight] = useState('auto')
  const alive = useRef(true)
  const inner = useRef(null)

  // After sign-in return to the page they wanted (if their role may open it), else the role's landing page.
  const targetFor = (role) => {
    const from = params.get('from')
    return from && from.startsWith('/') && !from.startsWith('//') && canOpen(role, splitLocation(from).path) ? from : LANDING_PATH[role]
  }
  useEffect(() => { if (session || !requireLogin) navigate(targetFor(session?.role || 'citizen'), { replace: true }) }) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { alive.current = true; return () => { alive.current = false } }, [])
  useEffect(() => {
    const el = inner.current
    if (!el || typeof ResizeObserver === 'undefined') return undefined
    const ro = new ResizeObserver(() => setHeight(el.offsetHeight))
    ro.observe(el)
    setHeight(el.offsetHeight)
    return () => ro.disconnect()
  }, [])

  const set = (k) => (val) => { setValues((v) => ({ ...v, [k]: val })); setErrors((e) => ({ ...e, [k]: undefined })) }
  const shake = () => { setShaking(true); setTimeout(() => alive.current && setShaking(false), 380) }
  const focusId = (k) => setTimeout(() => document.getElementById(`login-${k}`)?.focus(), 30)

  const changeTab = (key) => {
    if (key === tab) return
    setTab(key); setErrors({}); setFading(true)
    setTimeout(() => { if (alive.current) { setShown(key); setFading(false) } }, 150)
  }

  async function run(role, v) {
    if (status !== 'idle') return
    const errs = validate(role, v)
    if (Object.keys(errs).length) { setErrors(errs); shake(); focusId(Object.keys(errs)[0]); return }
    setErrors({}); setStatus('loading')
    await sleep(700)
    if (!alive.current) return
    if (role === 'admin' && v.code.trim() !== DEMO_ADMIN_CODE) {
      setStatus('idle'); setErrors({ code: `That code doesn't match. For this demo, use ${DEMO_ADMIN_CODE}.` }); shake(); focusId('code')
      return
    }
    setStatus('success')
    await sleep(550)
    if (!alive.current) return
    setLeaving(true)
    await sleep(350)
    if (!alive.current) return
    signIn({ role, name: v.name.trim(), department: role === 'department' ? v.department : null })
    navigate(targetFor(role), { replace: true })
  }

  const demo = (d) => { changeTab(d.role); const next = { ...values, ...d.values }; setValues(next); run(d.role, next) }
  const onSubmit = (e) => { e.preventDefault(); run(tab, values) }

  return (
    <div className="relative min-h-screen overflow-hidden bg-background lg:grid lg:grid-cols-2">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden lg:right-1/2">
        <div className="animate-drift absolute -left-24 top-1/4 h-80 w-80 rounded-full bg-[radial-gradient(circle_at_center,var(--accent),transparent_70%)]" />
        <div className="animate-drift absolute -right-20 bottom-10 h-72 w-72 rounded-full bg-[radial-gradient(circle_at_center,var(--peach),transparent_70%)]" style={{ animationDelay: '-9s' }} />
      </div>

      <div className="relative z-10 flex min-h-screen flex-col px-5 py-6 sm:px-10 lg:py-8">
        <header className="animate-fade-in"><Logo /></header>
        <div className="mt-5 animate-rise lg:hidden" style={{ animationDelay: '120ms' }}><NeighborhoodPanel compact /></div>

        <main className="flex flex-1 items-center justify-center py-8">
          <div className={`w-full max-w-md ${shaking ? 'animate-shake' : ''} ${leaving ? 'animate-leave' : ''}`}>
            <div className="animate-rise rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8">
              <div className="animate-rise" style={stagger(0)}>
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Hello, neighbor</p>
                <h1 className="mt-1 text-3xl font-semibold leading-tight">Welcome back</h1>
                <p className="mt-2 text-muted-foreground">Sign in to see what's happening around your city today.</p>
              </div>

              <div className="mt-6 animate-rise" style={stagger(1)}><RoleTabs roles={ROLES} value={tab} onChange={changeTab} panelId="login-panel" /></div>

              <form onSubmit={onSubmit} noValidate aria-label="Sign in" className="mt-5">
                <div className="height-anim overflow-hidden transition-[height] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]" style={{ height }}>
                  <div ref={inner} id="login-panel" role="tabpanel" aria-labelledby={`tab-${tab}`}
                    className={`space-y-3 pb-1 transition-opacity duration-150 motion-reduce:transition-none ${fading ? 'opacity-0' : 'opacity-100'}`}>
                    <div className="animate-rise" style={stagger(2)}>
                      <FloatingInput id="login-name" label={shown === 'citizen' ? 'Your name or email' : 'Your name'} value={values.name}
                        onChange={set('name')} error={errors.name} autoComplete="name" />
                    </div>
                    {shown === 'department' && (
                      <div className="animate-fade-in">
                        <FloatingSelect id="login-department" label="Department" value={values.department} onChange={set('department')}
                          error={errors.department} placeholder="Choose your department" options={DEPARTMENTS} />
                      </div>
                    )}
                    {shown === 'admin' && (
                      <div className="animate-fade-in">
                        <FloatingInput id="login-code" label="Demo access code" type="password" value={values.code} onChange={set('code')}
                          error={errors.code} autoComplete="off" hint={`Demo code: ${DEMO_ADMIN_CODE}`} />
                      </div>
                    )}
                  </div>
                </div>
                <div className="mt-4 animate-rise" style={stagger(3)}><SubmitButton status={status}>Sign in</SubmitButton></div>
              </form>

              <div className="mt-6 animate-rise border-t border-border pt-5" style={stagger(4)}>
                <p className="text-sm text-muted-foreground">Just looking around? Try a demo account.</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {DEMOS.map((d) => (
                    <button key={d.label} type="button" disabled={status !== 'idle'} onClick={() => demo(d)}
                      className="rounded-full border border-border bg-background px-3.5 py-1.5 text-sm font-medium transition duration-200 hover:-translate-y-0.5 hover:bg-accent active:scale-[0.97] disabled:opacity-50 motion-reduce:transition-none motion-reduce:hover:translate-y-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
                      {d.label}
                    </button>
                  ))}
                </div>
                <p className="mt-3 text-xs text-muted-foreground">Demo sign-in only: nothing is sent anywhere. Admin demo code: <b>{DEMO_ADMIN_CODE}</b></p>
              </div>
            </div>
          </div>
        </main>
        <footer className="animate-fade-in text-center text-sm text-muted-foreground" style={{ animationDelay: '600ms' }}>For danger to life, call 112.</footer>
      </div>

      <aside className="hidden h-screen p-4 lg:sticky lg:top-0 lg:block"><NeighborhoodPanel /></aside>
    </div>
  )
}
