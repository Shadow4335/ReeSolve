// Text-size preference (A- / A / A+): scales the root font size and persists in localStorage.
import { useCallback, useState } from 'react'

const KEY = 'reesolve.textSize'
export const TEXT_SIZES = { small: 14, normal: 16, large: 18 }

function read() {
  try {
    const v = localStorage.getItem(KEY)
    return v && v in TEXT_SIZES ? v : 'normal'
  } catch { return 'normal' }
}
const apply = (size) => { document.documentElement.style.fontSize = `${TEXT_SIZES[size]}px` }
apply(read()) // runs at import so the first paint already has the saved size

export function useTextSize() {
  const [size, setSize] = useState(read)
  const set = useCallback((s) => {
    try { localStorage.setItem(KEY, s) } catch { /* private mode */ }
    apply(s)
    setSize(s)
  }, [])
  return { size, setSize: set }
}
