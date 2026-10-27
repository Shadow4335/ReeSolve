// The five departments (CONTEXT.md 4.1). Shared by the sidebar role switcher and the login page.
export const DEPARTMENTS = [
  ['ROADS', 'Roads & Infrastructure'],
  ['WATER', 'Water & Sewerage'],
  ['DRAIN', 'Drainage'],
  ['SANI', 'Sanitation'],
  ['ELEC', 'Electrical'],
]

export const deptName = (code) => DEPARTMENTS.find(([c]) => c === code)?.[1] ?? code
