import { useT } from '../../i18n'

// idle -> loading (spinner) -> success (green with a check). Colour and a short fade only; no bounce.
export default function SubmitButton({ status, children }) {
  const t = useT()
  const busy = status !== 'idle'
  return (
    <button
      type="submit" disabled={busy} aria-busy={status === 'loading'}
      className={`flex h-12 w-full items-center justify-center gap-2 rounded px-4 text-base font-semibold text-white transition-colors duration-200 hover:bg-navy-900 active:scale-[0.99] disabled:cursor-not-allowed motion-reduce:active:scale-100 ${
        status === 'success' ? '!bg-india-green' : 'bg-navy-700'
      }`}
    >
      {status === 'idle' && <span key="idle" className="animate-fade-in">{children}</span>}
      {status === 'loading' && (
        <span key="loading" className="flex animate-fade-in items-center gap-2">
          <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" opacity="0.3" />
            <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
          </svg>
          {t('login.signingIn')}
        </span>
      )}
      {status === 'success' && (
        <span key="success" className="flex animate-pop items-center gap-2">
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="m5 12 5 5 9-10" />
          </svg>
          {t('login.welcomeBtn')}
        </span>
      )}
    </button>
  )
}
