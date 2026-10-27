// DEMO SIGN-IN (frontend only): see src/auth/AuthContext.jsx. Nothing here talks to the backend.
import { useEffect, useRef, useState } from 'react'
import Layout from '../components/layout/Layout'
import NeighborhoodPanel from '../components/login/NeighborhoodPanel'
import RoleTabs from '../components/login/RoleTabs'
import SubmitButton from '../components/login/SubmitButton'
import { FloatingInput, FloatingSelect } from '../components/login/FloatingField'
import { DEMO_ADMIN_CODE } from '../auth/constants'
import { useAuth } from '../auth/AuthContext'
import { useT } from '../i18n'
import { DEPARTMENTS } from '../lib/departments'
import { LANDING_PATH, canOpen } from '../lib/routes'
import { navigate, splitLocation, useLocation } from '../router'

const ROLE_KEYS = [['citizen', 'login.resident'], ['department', 'login.staff'], ['admin', 'login.admin']]
const DEMOS = [
  { key: 'login.tryResident', role: 'citizen', values: { name: 'Anjali Sharma (demo resident)' } },
  { key: 'login.tryRoads', role: 'department', values: { name: 'Roads desk (demo)', department: 'ROADS' } },
  { key: 'login.tryAdmin', role: 'admin', values: { name: 'City admin (demo)', code: DEMO_ADMIN_CODE } },
]
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const stagger = (n) => ({ animationDelay: `${60 + n * 60}ms` })

function validate(role, v, t) {
  const e = {}
  if (!v.name.trim()) e.name = t(role === 'citizen' ? 'login.errNameEmail' : 'login.errName')
  if (role === 'department' && !v.department) e.department = t('login.errDept')
  if (role === 'admin' && !v.code.trim()) e.code = t('login.errCode')
  return e
}

export default function Login() {
  const t = useT()
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

  async function run(role, v, isDemo = false) {
    if (status !== 'idle') return
    const errs = validate(role, v, t)
    if (Object.keys(errs).length) { setErrors(errs); shake(); focusId(Object.keys(errs)[0]); return }
    setErrors({}); setStatus('loading')
    await sleep(700)
    if (!alive.current) return
    if (role === 'admin' && v.code.trim() !== DEMO_ADMIN_CODE) {
      setStatus('idle'); setErrors({ code: t('login.codeError', { code: DEMO_ADMIN_CODE }) }); shake(); focusId('code')
      return
    }
    setStatus('success')
    await sleep(550)
    if (!alive.current) return
    setLeaving(true)
    await sleep(350)
    if (!alive.current) return
    signIn({ role, name: v.name.trim(), department: role === 'department' ? v.department : null, demo: isDemo })
    navigate(targetFor(role), { replace: true })
  }

  const demo = (d) => { changeTab(d.role); const next = { ...values, ...d.values }; setValues(next); run(d.role, next, true) }
  const onSubmit = (e) => { e.preventDefault(); run(tab, values) }

  const roles = ROLE_KEYS.map(([key, labelKey]) => ({ key, label: t(labelKey) }))

  return (
    <Layout bare>
      <div className="lg:grid lg:grid-cols-2">
        <div className="px-4 py-8 sm:px-8 lg:py-12">
          <div className="mx-auto mb-6 max-w-md animate-rise lg:hidden" style={stagger(0)}><NeighborhoodPanel compact /></div>
          <div className={`mx-auto w-full max-w-md ${shaking ? 'animate-shake' : ''} ${leaving ? 'animate-leave' : ''}`}>
            <div className="animate-rise rounded-xl border border-border bg-card p-6 shadow-sm sm:p-8">
              <div className="animate-rise" style={stagger(0)}>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t('login.hello')}</p>
                <h1 className="mt-1 text-3xl font-bold leading-tight">{t('login.welcome')}</h1>
                <span aria-hidden="true" className="mt-3 block h-1 w-12 bg-saffron" />
                <p className="mt-3 text-muted-foreground">{t('login.sub')}</p>
              </div>

              <div className="mt-6 animate-rise" style={stagger(1)}><RoleTabs roles={roles} value={tab} onChange={changeTab} panelId="login-panel" label={t('login.tabs')} /></div>

              <form onSubmit={onSubmit} noValidate aria-label={t('btn.signIn')} className="mt-5">
                <div className="height-anim overflow-hidden transition-[height] duration-200 ease-out" style={{ height }}>
                  <div ref={inner} id="login-panel" role="tabpanel" aria-labelledby={`tab-${tab}`}
                    className={`space-y-3 pb-1 transition-opacity duration-150 motion-reduce:transition-none ${fading ? 'opacity-0' : 'opacity-100'}`}>
                    <div className="animate-rise" style={stagger(2)}>
                      <FloatingInput id="login-name" label={t(shown === 'citizen' ? 'login.nameEmail' : 'login.name')} value={values.name}
                        onChange={set('name')} error={errors.name} autoComplete="name" />
                    </div>
                    {shown === 'department' && (
                      <div className="animate-fade-in">
                        <FloatingSelect id="login-department" label={t('login.department')} value={values.department} onChange={set('department')}
                          error={errors.department} placeholder={t('login.chooseDept')} options={DEPARTMENTS} />
                      </div>
                    )}
                    {shown === 'admin' && (
                      <div className="animate-fade-in">
                        <FloatingInput id="login-code" label={t('login.code')} type="password" value={values.code} onChange={set('code')}
                          error={errors.code} autoComplete="off" hint={t('login.codeHint', { code: DEMO_ADMIN_CODE })} />
                      </div>
                    )}
                  </div>
                </div>
                <div className="mt-4 animate-rise" style={stagger(3)}><SubmitButton status={status}>{t('btn.signIn')}</SubmitButton></div>
              </form>

              <div className="mt-6 animate-rise border-t border-border pt-5" style={stagger(4)}>
                <p className="text-sm text-muted-foreground">{t('login.demoIntro')}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {DEMOS.map((d) => (
                    <button key={d.key} type="button" disabled={status !== 'idle'} onClick={() => demo(d)}
                      className="rounded border border-navy-700 bg-white px-3 py-1.5 text-sm font-semibold text-navy-700 transition-colors duration-150 hover:bg-navy-50 disabled:opacity-50">
                      {t(d.key)}
                    </button>
                  ))}
                </div>
                <p className="mt-3 text-xs text-muted-foreground">{t('login.demoNote')} <b className="text-ink">{DEMO_ADMIN_CODE}</b></p>
              </div>
            </div>
          </div>
        </div>
        <aside className="hidden p-4 lg:block"><NeighborhoodPanel /></aside>
      </div>
    </Layout>
  )
}
