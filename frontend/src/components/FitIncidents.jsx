import { useEffect, useRef } from 'react'
import { useMap } from 'react-leaflet'

// Fit the map to all incidents the first time they load (so every pin is visible at any screen width).
// Later polls never re-fit, so a user's panning and zooming is left alone; an empty list re-arms it (e.g. after a reset).
export default function FitIncidents({ incidents }) {
  const map = useMap()
  const done = useRef(false)
  const frame = useRef(0)
  useEffect(() => () => cancelAnimationFrame(frame.current), []) // cancel only on unmount, not on every poll
  useEffect(() => {
    if (!incidents.length) { done.current = false; return }
    if (done.current) return
    done.current = true
    // Wait a frame so the container has its final size, then fit (otherwise the zoom is chosen for a smaller box).
    frame.current = requestAnimationFrame(() => {
      map.invalidateSize()
      map.fitBounds(incidents.map((i) => [i.lat, i.lng]), { padding: [32, 32], maxZoom: 15, animate: false })
    })
  }, [incidents, map])
  return null
}
