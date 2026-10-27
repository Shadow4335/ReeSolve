import { useCallback, useEffect, useState } from 'react'

// Poll an async function every `ms`; returns { data, error, reload }.
export function usePolling(fn, ms, deps = []) {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [tick, setTick] = useState(0)
  const reload = useCallback(() => setTick((t) => t + 1), [])
  useEffect(() => {
    let alive = true
    const run = () =>
      fn()
        .then((d) => alive && (setData(d), setError(null)))
        .catch((e) => alive && setError(e))
    run()
    const id = setInterval(run, ms)
    return () => {
      alive = false
      clearInterval(id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ms, tick, ...deps])
  return { data, error, reload }
}
