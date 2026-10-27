import { useEffect, useState } from 'react'
import { api } from '../api'
import { useT } from '../i18n'
import { Button } from './ui'

// Shared simulated-clock controls. The clock badge listens for CLOCK_EVENT so it refreshes immediately after a jump.
export const CLOCK_EVENT = 'reesolve:clock'
export const MAX_HOURS = 8760 // one year
export const notifyClock = () => window.dispatchEvent(new Event(CLOCK_EVENT))

// Custom "fast-forward N hours" input. Validates 0 < hours <= MAX_HOURS inline.
export function CustomHours({ onAdvance, disabled, id = 'custom-hours' }) {
  const t = useT()
  const [val, setVal] = useState('')
  const [err, setErr] = useState('')
  const submit = (e) => {
    e.preventDefault()
    const h = Number(val)
    if (!(h > 0 && h <= MAX_HOURS)) return setErr(t('demo.invalid', { max: MAX_HOURS }))
    setErr('')
    setVal('')
    onAdvance(h)
  }
  return (
    <form onSubmit={submit} noValidate className="flex flex-wrap items-center gap-2">
      <label htmlFor={id} className="sr-only">{t('demo.hours')}</label>
      <input
        id={id} type="number" inputMode="decimal" min="0" step="any" value={val} placeholder={t('demo.hours')}
        aria-invalid={!!err} aria-describedby={`${id}-msg`}
        onChange={(e) => { setVal(e.target.value); setErr('') }}
        className={`w-24 rounded border bg-white px-2 py-2 text-sm text-ink ${err ? 'border-danger' : 'border-border'}`}
      />
      <Button type="submit" variant="soft" disabled={disabled}>{t('demo.go')}</Button>
      <span id={`${id}-msg`} aria-live="polite" className="text-xs font-medium text-danger">{err}</span>
    </form>
  )
}

// Header control shown ONLY for demo accounts (signed in through a "Try as..." chip).
export function DemoTimeControl() {
  const t = useT()
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null) // { text, bad }
  useEffect(() => {
    if (!msg) return undefined
    const id = setTimeout(() => setMsg(null), 4000)
    return () => clearTimeout(id)
  }, [msg])

  const run = async (path, body, okText) => {
    setBusy(true)
    try {
      await api.post(path, body)
      setMsg({ text: okText })
      notifyClock()
    } catch (e) {
      setMsg({ text: e.message, bad: true })
    } finally {
      setBusy(false)
    }
  }
  const advance = (h) => run('/admin/clock/advance', { hours: h }, t('demo.done', { h }))
  const mini = 'rounded bg-navy-900 px-2 py-1.5 text-xs font-semibold text-white hover:bg-navy-700 disabled:opacity-50'

  return (
    <div role="group" aria-label={t('demo.title')} className="flex w-full flex-wrap items-center gap-2 rounded border border-dashed border-navy-700 bg-white px-2.5 py-1.5 sm:w-auto">
      <span className="text-xs font-semibold text-navy-900">{t('demo.title')}</span>
      {[1, 24, 72].map((h) => <button key={h} type="button" disabled={busy} onClick={() => advance(h)} className={mini}>+{h}h</button>)}
      <CustomHours onAdvance={advance} disabled={busy} id="demo-custom-hours" />
      <button type="button" disabled={busy} onClick={() => run('/admin/clock/reset', {}, t('demo.resetDone'))}
        className="rounded border border-navy-700 bg-white px-2 py-1.5 text-xs font-semibold text-navy-700 hover:bg-navy-50 disabled:opacity-50">{t('demo.reset')}</button>
      {msg && <span role="status" className={`text-xs font-medium ${msg.bad ? 'text-danger' : 'text-ink'}`}>{msg.text}</span>}
    </div>
  )
}
