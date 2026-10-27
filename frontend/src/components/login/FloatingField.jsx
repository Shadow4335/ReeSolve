import { useState } from 'react'
import Icon from '../Icon'

const box = 'h-14 w-full rounded border bg-white px-4 pb-1 pt-5 text-base text-ink transition-colors duration-150 focus:border-navy-700'

// Shared chrome: floating label (transform only) and an animated message. Focus shows the global saffron ring.
function Shell({ id, label, floated, error, hint, children }) {
  return (
    <div>
      <div className="relative">
        {children}
        <label
          htmlFor={id}
          className={`pointer-events-none absolute left-4 top-0 flex h-14 origin-left items-center transition-transform duration-150 ease-out motion-reduce:transition-none ${
            floated ? '-translate-y-[0.7rem] scale-[0.78] font-semibold text-navy-700' : 'text-muted-foreground'
          } ${error ? '!text-danger' : ''}`}
        >
          {label}
        </label>
      </div>
      <p id={`${id}-msg`} aria-live="polite" className="min-h-0">
        {error ? (
          <span key={error} className="mt-1.5 block animate-msg-in text-sm font-medium text-danger">{error}</span>
        ) : hint ? (
          <span className="mt-1.5 block text-xs text-muted-foreground">{hint}</span>
        ) : null}
      </p>
    </div>
  )
}

export function FloatingInput({ id, label, value, onChange, error, hint, type = 'text', autoComplete, inputMode }) {
  const [focused, setFocused] = useState(false)
  return (
    <Shell id={id} label={label} floated={focused || value.length > 0} error={error} hint={hint}>
      <input
        id={id} name={id} type={type} value={value} autoComplete={autoComplete} inputMode={inputMode}
        aria-invalid={!!error} aria-describedby={`${id}-msg`}
        onChange={(e) => onChange(e.target.value)} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
        className={`${box} ${error ? 'border-danger' : 'border-border'}`}
      />
    </Shell>
  )
}

export function FloatingSelect({ id, label, value, onChange, error, options, placeholder }) {
  return (
    <Shell id={id} label={label} floated error={error}>
      <select
        id={id} name={id} value={value} aria-invalid={!!error} aria-describedby={`${id}-msg`}
        onChange={(e) => onChange(e.target.value)}
        className={`${box} appearance-none ${value ? '' : 'text-muted-foreground'} ${error ? 'border-danger' : 'border-border'}`}
      >
        <option value="">{placeholder}</option>
        {options.map(([v, n]) => <option key={v} value={v}>{n}</option>)}
      </select>
      <Icon name="chevron" className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 rotate-90 text-muted-foreground" />
    </Shell>
  )
}
