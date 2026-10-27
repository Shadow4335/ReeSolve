import { useEffect, useState } from 'react'
import Icon from '../Icon'
import SkylineArt from './SkylineArt'

// Mock copy only (no API calls). Rotates every few seconds with a fade.
const LINES = [
  ['18', 'reports this month'],
  ['12', 'fixed and confirmed by residents'],
  ['✓', 'Fixed means confirmed fixed'],
]

export default function NeighborhoodPanel({ compact = false }) {
  const [i, setI] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setI((n) => (n + 1) % LINES.length), 3600)
    return () => clearInterval(id)
  }, [])
  const [big, small] = LINES[i]
  return (
    <div className={`relative overflow-hidden bg-accent ${compact ? 'h-48 rounded-2xl' : 'h-full min-h-[34rem] rounded-3xl'}`}>
      <div aria-hidden="true" className="animate-drift absolute -right-16 -top-16 h-64 w-64 rounded-full bg-[radial-gradient(circle_at_center,var(--card),transparent_70%)] opacity-70" />
      <div className={`relative z-10 ${compact ? 'p-5' : 'p-10'}`}>
        <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-primary">
          <Icon name="pin" className="h-3.5 w-3.5" /> Maplewood · Central ward
        </p>
        <div key={i} className={`animate-fade-in ${compact ? 'mt-2 flex items-baseline gap-2' : 'mt-3'}`} aria-live="off">
          <p className={`font-display font-semibold leading-none text-foreground ${compact ? 'text-3xl' : 'text-6xl'}`}>{big}</p>
          <p className={`text-foreground ${compact ? 'text-sm leading-tight' : 'mt-2 max-w-xs text-lg'}`}>{small}</p>
        </div>
      </div>
      <SkylineArt className={`absolute bottom-0 left-0 w-full ${compact ? 'h-[46%]' : 'h-[62%]'}`} />
    </div>
  )
}
