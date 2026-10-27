import { useRef } from 'react'

// Proper tablist: roving tabindex, arrow keys / Home / End, sliding saffron underline (transform only).
export default function RoleTabs({ roles, value, onChange, panelId, label }) {
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
    <div role="tablist" aria-label={label} onKeyDown={onKeyDown} className="relative grid grid-cols-3 border-b border-border">
      <span
        aria-hidden="true"
        className="slide-pill absolute bottom-0 left-0 h-1 w-1/3 bg-saffron transition-transform duration-200 ease-out"
        style={{ transform: `translateX(${index * 100}%)` }}
      />
      {roles.map((r, i) => (
        <button
          key={r.key} ref={(el) => (refs.current[i] = el)} type="button" role="tab" id={`tab-${r.key}`}
          aria-selected={i === index} aria-controls={panelId} tabIndex={i === index ? 0 : -1}
          onClick={() => onChange(r.key)}
          className={`px-2 py-3 text-sm font-semibold transition-colors duration-150 ${i === index ? 'text-navy-900' : 'text-muted-foreground hover:text-navy-900'}`}
        >
          {r.label}
        </button>
      ))}
    </div>
  )
}
