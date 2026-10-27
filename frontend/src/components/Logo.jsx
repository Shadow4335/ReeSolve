// ReeSolve mark + tagline (extracted from the sidebar so the login page reuses the exact same mark).
export default function Logo({ className = '' }) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary font-display text-lg font-semibold text-primary-foreground">R</span>
      <div>
        <div className="font-display text-xl font-semibold leading-none">ReeSolve</div>
        <div className="mt-1 text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">Your city, in sync</div>
      </div>
    </div>
  )
}
