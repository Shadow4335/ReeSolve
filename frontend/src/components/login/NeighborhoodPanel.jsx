import { useEffect, useState } from 'react'
import { useT } from '../../i18n'
import Icon from '../Icon'
import SkylineArt from './SkylineArt'

// Mock copy only (no API calls). Rotates every few seconds with a short fade.
const LINES = [['18', 'panel.month'], ['12', 'panel.fixed'], ['✓', 'panel.promise']]

export default function NeighborhoodPanel({ compact = false }) {
  const t = useT()
  const [i, setI] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setI((n) => (n + 1) % LINES.length), 3600)
    return () => clearInterval(id)
  }, [])
  const [big, key] = LINES[i]
  return (
    <div className={`relative overflow-hidden rounded-xl border border-border bg-navy-50 ${compact ? 'h-48' : 'h-full min-h-[34rem]'}`}>
      <div className={`relative z-10 ${compact ? 'p-5' : 'p-10'}`}>
        <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-navy-700">
          <Icon name="pin" className="h-3.5 w-3.5" /> New Delhi · Central district
        </p>
        <div key={i} className={`animate-fade-in ${compact ? 'mt-2 flex items-baseline gap-2' : 'mt-3'}`} aria-live="off">
          <p className={`font-bold leading-none text-navy-900 ${compact ? 'text-3xl' : 'text-6xl'}`}>{big}</p>
          <p className={`text-ink ${compact ? 'text-sm leading-tight' : 'mt-2 max-w-xs text-lg'}`}>{t(key)}</p>
        </div>
      </div>
      <SkylineArt className={`absolute bottom-0 left-0 w-full ${compact ? 'h-[46%]' : 'h-[62%]'}`} />
    </div>
  )
}
