// Real route table: page key <-> URL path, and which pages each role may open.
export const PAGE_PATH = {
  overview: '/', report: '/report', projects: '/projects', requests: '/requests', queue: '/queue', admin: '/admin',
}
export const PATH_PAGE = Object.fromEntries(Object.entries(PAGE_PATH).map(([k, v]) => [v, k]))

export const ALLOWED_PAGES = {
  citizen: ['overview', 'report', 'projects', 'requests'],
  department: ['queue'],
  admin: ['admin'],
}

// Where each role lands after signing in (or switching role).
export const LANDING_PATH = { citizen: '/', department: PAGE_PATH.queue, admin: PAGE_PATH.admin }

export const canOpen = (role, path) => ALLOWED_PAGES[role]?.includes(PATH_PAGE[path]) ?? false
