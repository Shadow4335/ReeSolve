import { useT } from '../i18n'

// Neutral placeholder mark (NOT a state emblem): a navy shield with a small city skyline and a saffron sun.
export function LogoMark({ className = 'h-10 w-10' }) {
  return (
    <svg viewBox="0 0 40 44" className={className} aria-hidden="true" focusable="false">
      <path d="M20 1.5 37 7v14.5c0 9.7-6.7 17.2-17 21-10.3-3.8-17-11.3-17-21V7z" className="fill-navy-700 stroke-navy-900" strokeWidth="1.5" />
      <circle cx="28" cy="13" r="3.2" className="fill-saffron" />
      <rect x="9" y="22" width="5" height="11" className="fill-white" />
      <rect x="16" y="17" width="6" height="16" className="fill-white" />
      <rect x="24" y="24" width="6" height="9" className="fill-white" />
      <rect x="8" y="33" width="24" height="1.8" className="fill-saffron" />
    </svg>
  )
}

// ReeSolve brand: placeholder mark + name + tagline.
export default function Logo({ light = false, className = '' }) {
  const t = useT()
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <LogoMark />
      <div>
        <div className={`text-xl font-bold leading-none ${light ? 'text-white' : 'text-navy-900'}`}>ReeSolve</div>
        <div className={`mt-1 text-xs font-medium ${light ? 'text-navy-50' : 'text-muted-foreground'}`}>{t('brand.tagline')}</div>
      </div>
    </div>
  )
}
