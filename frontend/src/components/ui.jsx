import Icon from './Icon'

export function Card({ className = '', children, ...rest }) {
  return <div className={`rounded-2xl border border-border bg-card shadow-sm ${className}`} {...rest}>{children}</div>
}

export function PageHeader({ eyebrow, title, sub, children }) {
  return (
    <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        {eyebrow && <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">{eyebrow}</p>}
        <h1 className="mt-1 text-4xl font-semibold leading-tight">{title}</h1>
        {sub && <p className="mt-2 max-w-2xl text-muted-foreground">{sub}</p>}
      </div>
      {children}
    </header>
  )
}

const TONES = {
  ok: 'bg-accent text-primary',
  warn: 'bg-warn text-warn-foreground',
  peach: 'bg-peach text-peach-foreground',
  danger: 'bg-danger text-danger-foreground',
  muted: 'bg-muted text-muted-foreground',
}

export function Chip({ tone = 'muted', dot = true, children, className = '' }) {
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold ${TONES[tone]} ${className}`}>
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
      {children}
    </span>
  )
}

export function IconTile({ name, className = '' }) {
  return (
    <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent text-primary ${className}`}>
      <Icon name={name} />
    </span>
  )
}

export function Button({ variant = 'primary', className = '', ...rest }) {
  const v = {
    primary: 'bg-primary text-primary-foreground hover:opacity-90',
    soft: 'bg-card text-foreground border border-border hover:bg-muted',
    dark: 'bg-foreground text-background hover:opacity-90',
    danger: 'bg-destructive text-primary-foreground hover:opacity-90',
    cream: 'bg-background text-foreground hover:opacity-90',
  }[variant]
  return <button className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition disabled:opacity-50 ${v} ${className}`} {...rest} />
}

export function SectionTitle({ children, right }) {
  return (
    <div className="mb-3 flex items-baseline justify-between">
      <h2 className="text-xl font-semibold">{children}</h2>
      {right}
    </div>
  )
}
