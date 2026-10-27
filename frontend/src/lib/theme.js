// Runtime access to theme colours for libraries that need real colour strings (Leaflet). Values come from the
// CSS variables defined in index.css, so no colour is hardcoded here.
export const cssVar = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim()

// Map markers: CRITICAL red, HIGH saffron, MEDIUM navy, LOW slate; fixed = green.
const PRIORITY_VAR = { CRITICAL: '--danger', HIGH: '--saffron', MEDIUM: '--navy-700', LOW: '--muted' }
export const priorityColor = (p) => cssVar(PRIORITY_VAR[p] || '--muted')
export const fixedColor = () => cssVar('--ok')
export const clusterColor = () => cssVar('--navy-900')
export const outlineColor = () => cssVar('--white')
