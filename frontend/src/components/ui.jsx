import Icon from './Icon'

export function Card({ className = '', children, ...rest }) {
  return <div className={`rounded-xl border border-border bg-card shadow-sm ${className}`} {...rest}>{children}</div>
}

export function PageHeader({ eyebrow, title, sub, children }) {
  return (
    <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        {eyebrow && <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{eyebrow}</p>}
        <h1 className="mt-1 text-3xl font-bold leading-tight">{title}</h1>
        <span aria-hidden="true" className="mt-3 block h-1 w-12 bg-saffron" />
        {sub && <p className="mt-3 max-w-2xl text-muted-foreground">{sub}</p>}
      </div>
      {children}
    </header>
  )
}

// Status chips: tint background, ink text, coloured dot. Same meaning everywhere (ok / warn / danger / paused).
const TONES = {
  ok: ['bg-ok-tint', 'bg-ok'],
  warn: ['bg-warn-tint', 'bg-warn'],
  danger: ['bg-danger-tint', 'bg-danger'],
  paused: ['bg-paused-tint', 'bg-paused'],
  muted: ['bg-paused-tint', 'bg-paused'],
  info: ['bg-navy-50', 'bg-navy-700'],
}

export function Chip({ tone = 'muted', dot = true, children, className = '' }) {
  const [bg, dotColor] = TONES[tone] || TONES.muted
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded border border-border px-2.5 py-1 text-xs font-semibold text-ink ${bg} ${className}`}>
      {dot && <span className={`h-2 w-2 rounded-full ${dotColor}`} />}
      {children}
    </span>
  )
}

export function IconTile({ name, className = '' }) {
  return (
    <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded bg-navy-50 text-navy-700 ${className}`}>
      <Icon name={name} />
    </span>
  )
}

export function Button({ variant = 'primary', className = '', ...rest }) {
  const v = {
    primary: 'bg-navy-700 text-white hover:bg-navy-900',
    soft: 'border border-navy-700 bg-white text-navy-700 hover:bg-navy-50',
    dark: 'bg-navy-900 text-white hover:bg-navy-700',
    success: 'bg-india-green text-white hover:opacity-90',
    danger: 'bg-danger text-white hover:opacity-90',
    cream: 'bg-white text-navy-900 hover:bg-navy-50',
  }[variant]
  return <button className={`inline-flex items-center justify-center gap-2 rounded px-4 py-2.5 text-sm font-semibold transition-colors duration-150 disabled:opacity-50 ${v} ${className}`} {...rest} />
}

export function SectionTitle({ children, right }) {
  return (
    <div className="mb-3 flex items-baseline justify-between gap-3">
      <h2 className="text-xl font-semibold">{children}</h2>
      {right}
    </div>
  )
}

// Legend for the four SLA states, using the same status colours as everywhere else.
export function StatusKey({ t }) {
  const items = [['ok', 'status.onTrack'], ['warn', 'status.warning'], ['danger', 'status.breached'], ['paused', 'status.paused']]
  return (
    <div role="group" aria-label={t('status.key')} className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
      <span className="font-semibold uppercase tracking-wider">{t('status.key')}</span>
      {items.map(([tone, key]) => <Chip key={key} tone={tone}>{t(key)}</Chip>)}
    </div>
  )
}
