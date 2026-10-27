import { useT } from '../../i18n'
import Logo from '../Logo'

// White header: brand + controls (role switcher, user, clock) on top, navigation with a saffron active underline below.
export default function SiteHeader({ nav = [], controls = null }) {
  const t = useT()
  return (
    <header className="border-b border-border bg-white">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-3 px-4 py-3 sm:px-6">
        <Logo />
        {controls && <div className="flex flex-wrap items-center gap-3">{controls}</div>}
      </div>
      {nav.length > 0 && (
        <nav aria-label={t('nav.main')} className="border-t border-border">
          <ul className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-2 sm:px-4">
            {nav.map((n) => (
              <li key={n.key}>
                <button
                  type="button" onClick={n.onClick} aria-current={n.active ? 'page' : undefined}
                  className={`whitespace-nowrap border-b-4 px-3 py-3 text-sm font-semibold ${n.active ? 'border-saffron text-navy-900' : 'border-transparent text-muted-foreground hover:text-navy-900'}`}
                >
                  {n.label}
                </button>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </header>
  )
}
