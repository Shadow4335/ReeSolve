import { useState } from 'react'
import Icon from '../Icon'

const box = 'h-14 w-full rounded-xl border bg-card px-4 pb-1 pt-5 text-base text-foreground outline-none transition-colors duration-200'

// Shared chrome: floating label (transform only), animated focus ring (opacity + scale), animated message.
function Shell({ id, label, floated, focused, error, hint, children }) {
  return (
    <div>
      <div className="relative">
        {children}
        <label
          htmlFor={id}
          className={`pointer-events-none absolute left-4 top-0 flex h-14 origin-left items-center transition-transform duration-200 motion-reduce:transition-none ${
            floated ? '-translate-y-[0.7rem] scale-[0.78] text-primary' : 'text-muted-foreground'
          } ${error ? '!text-destructive' : ''}`}
        >
          {label}
        </label>
        <span
          aria-hidden="true"
          className={`pointer-events-none absolute inset-0 rounded-xl border-2 transition duration-200 motion-reduce:transition-none ${
            error ? 'border-destructive' : 'border-primary'
          } ${focused ? 'scale-100 opacity-100' : 'scale-[0.985] opacity-0'}`}
        />
      </div>
      <p id={`${id}-msg`} aria-live="polite" className="min-h-0">
        {error ? (
          <span key={error} className="mt-1.5 block animate-msg-in text-sm text-destructive">{error}</span>
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
    <Shell id={id} label={label} floated={focused || value.length > 0} focused={focused} error={error} hint={hint}>
      <input
        id={id} name={id} type={type} value={value} autoComplete={autoComplete} inputMode={inputMode}
        aria-invalid={!!error} aria-describedby={`${id}-msg`}
        onChange={(e) => onChange(e.target.value)} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
        className={`${box} ${error ? 'border-destructive' : 'border-border'}`}
      />
    </Shell>
  )
}

export function FloatingSelect({ id, label, value, onChange, error, options, placeholder }) {
  const [focused, setFocused] = useState(false)
  return (
    <Shell id={id} label={label} floated focused={focused} error={error}>
      <select
        id={id} name={id} value={value} aria-invalid={!!error} aria-describedby={`${id}-msg`}
        onChange={(e) => onChange(e.target.value)} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
        className={`${box} appearance-none ${value ? '' : 'text-muted-foreground'} ${error ? 'border-destructive' : 'border-border'}`}
      >
        <option value="">{placeholder}</option>
        {options.map(([v, n]) => <option key={v} value={v}>{n}</option>)}
      </select>
      <Icon name="chevron" className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 rotate-90 text-muted-foreground" />
    </Shell>
  )
}
