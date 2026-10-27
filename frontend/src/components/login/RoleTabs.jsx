import { useRef } from 'react'

// Proper tablist: roving tabindex, arrow keys / Home / End, sliding pill (transform only).
export default function RoleTabs({ roles, value, onChange, panelId }) {
  const refs = useRef([])
  const index = roles.findIndex((r) => r.key === value)

  const onKeyDown = (e) => {
    const last = roles.length - 1
    const next = { ArrowRight: (index + 1) % roles.length, ArrowLeft: (index + last) % roles.length, Home: 0, End: last }[e.key]
    if (next === undefined) return
    e.preventDefault()
    onChange(roles[next].key)
    refs.current[next]?.focus()
  }

  return (
    <div role="tablist" aria-label="Sign in as" onKeyDown={onKeyDown} className="relative grid grid-cols-3 rounded-xl bg-muted p-1">
      <span
        aria-hidden="true"
        className="slide-pill absolute inset-y-1 left-1 w-[calc((100%-0.5rem)/3)] rounded-lg bg-card shadow-sm transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]"
        style={{ transform: `translateX(${index * 100}%)` }}
      />
      {roles.map((r, i) => (
        <button
          key={r.key} ref={(el) => (refs.current[i] = el)} type="button" role="tab" id={`tab-${r.key}`}
          aria-selected={i === index} aria-controls={panelId} tabIndex={i === index ? 0 : -1}
          onClick={() => onChange(r.key)}
          className={`relative z-10 rounded-lg px-2 py-2.5 text-sm font-semibold transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary ${
            i === index ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          {r.label}
        </button>
      ))}
    </div>
  )
}
