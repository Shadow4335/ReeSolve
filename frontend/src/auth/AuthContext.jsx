// DEMO SIGN-IN ONLY (frontend). No API calls, no passwords sent anywhere, no real security: it just picks the
// role + department the app already supports (Resident / Department: X / Admin) and remembers it in localStorage.
// `demo: true` marks sessions started from a "Try as..." chip; only those get the demo time-travel control.
// The backend stays auth-free. Set VITE_REQUIRE_LOGIN=false to bypass the guard entirely.
import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import { DEPARTMENTS } from '../lib/departments'
import { AUTH_STORAGE_KEY, GUEST_SESSION } from './constants'

export const REQUIRE_LOGIN = import.meta.env.VITE_REQUIRE_LOGIN !== 'false'
const ROLES = ['citizen', 'department', 'admin']

function readStored() {
  try {
    const s = JSON.parse(localStorage.getItem(AUTH_STORAGE_KEY))
    const okDept = s?.role !== 'department' || DEPARTMENTS.some(([c]) => c === s.department)
    if (s && ROLES.includes(s.role) && typeof s.name === 'string' && s.name.trim() && okDept) return s
  } catch { /* unreadable or blocked storage: treat as signed out */ }
  return null
}

const persist = (session) => {
  try {
    if (session) localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session))
    else localStorage.removeItem(AUTH_STORAGE_KEY)
  } catch { /* private mode */ }
}

// "citizen" | "dept:ROADS" | "admin": the key the header role switcher uses.
export const roleKeyOf = (s) => (s.role === 'department' ? `dept:${s.department}` : s.role)

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(() => (REQUIRE_LOGIN ? readStored() : GUEST_SESSION))

  const signIn = useCallback((next) => {
    persist(next)
    setSession(next)
  }, [])

  const signOut = useCallback(() => {
    persist(null)
    setSession(REQUIRE_LOGIN ? null : GUEST_SESSION)
  }, [])

  // The header role switcher updates the session instead of fighting it.
  const setRoleKey = useCallback((key) => {
    setSession((cur) => {
      const name = cur?.name || GUEST_SESSION.name
      const demo = !!cur?.demo // the demo flag survives role-switching; main accounts never get it
      const next = key.startsWith('dept:') ? { role: 'department', name, department: key.slice(5), demo }
        : { role: key === 'admin' ? 'admin' : 'citizen', name, department: null, demo }
      if (REQUIRE_LOGIN) persist(next)
      return next
    })
  }, [])

  const value = useMemo(() => ({ session, requireLogin: REQUIRE_LOGIN, signIn, signOut, setRoleKey }), [session, signIn, signOut, setRoleKey])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
