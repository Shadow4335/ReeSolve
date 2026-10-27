// Normalise VITE_API_URL. A bare host such as "my-api.onrender.com" (no scheme) would be treated by the browser as
// a path relative to the frontend's own domain, so every call would silently hit the static site instead of the API.
// Accepts: "https://host", "https://host/", "host", "localhost:8000". Default: http://localhost:8000.
export function normalizeApiBase(raw) {
  const v = (raw || '').trim() || 'http://localhost:8000'
  const withScheme = /^https?:\/\//i.test(v) ? v : `${/^(localhost|127\.0\.0\.1)(:|\/|$)/i.test(v) ? 'http' : 'https'}://${v}`
  return withScheme.replace(/\/+$/, '')
}
