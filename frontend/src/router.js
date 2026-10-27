// Tiny History-API router (no dependency). Paths look like "/login?from=%2Freport".
import { useSyncExternalStore } from 'react'

const listeners = new Set()
const notify = () => listeners.forEach((l) => l())
if (typeof window !== 'undefined') window.addEventListener('popstate', notify)

const subscribe = (l) => {
  listeners.add(l)
  return () => listeners.delete(l)
}
const snapshot = () => window.location.pathname + window.location.search

export function navigate(to, { replace = false } = {}) {
  if (to === snapshot()) return
  window.history[replace ? 'replaceState' : 'pushState'](null, '', to)
  notify()
}

// Returns "/path?query" and re-renders on navigation.
export const useLocation = () => useSyncExternalStore(subscribe, snapshot)

export const splitLocation = (loc) => {
  const [path, query = ''] = loc.split('?')
  return { path, params: new URLSearchParams(query) }
}
