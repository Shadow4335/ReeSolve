import { useEffect } from 'react'
import { navigate, useLocation } from '../router'
import { useAuth } from './AuthContext'

// Redirects signed-out visitors to /login?from=<where they wanted to go>. A no-op when VITE_REQUIRE_LOGIN=false.
export default function RequireAuth({ children }) {
  const { session, requireLogin } = useAuth()
  const loc = useLocation()
  const blocked = requireLogin && !session
  useEffect(() => {
    if (blocked) navigate(`/login?from=${encodeURIComponent(loc)}`, { replace: true })
  }, [blocked, loc])
  return blocked ? null : children
}
