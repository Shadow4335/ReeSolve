// idle -> loading (spinner) -> success (check pops in). Hover lift + press scale; both off under reduced motion.
export default function SubmitButton({ status, children }) {
  const busy = status !== 'idle'
  return (
    <button
      type="submit" disabled={busy} aria-busy={status === 'loading'}
      className="relative flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-base font-semibold text-primary-foreground shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 active:scale-[0.98] disabled:cursor-not-allowed disabled:hover:translate-y-0 motion-reduce:transition-none motion-reduce:hover:translate-y-0 motion-reduce:active:scale-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
    >
      {status === 'idle' && <span key="idle" className="animate-fade-in">{children}</span>}
      {status === 'loading' && (
        <span key="loading" className="flex animate-fade-in items-center gap-2">
          <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" opacity="0.25" />
            <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
          </svg>
          Signing you in…
        </span>
      )}
      {status === 'success' && (
        <span key="success" className="flex animate-pop items-center gap-2">
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="m5 12 5 5 9-10" />
          </svg>
          Welcome!
        </span>
      )}
    </button>
  )
}
