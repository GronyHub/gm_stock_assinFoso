// The things a weekly target can count. Kept apart from lib/targets.ts (which reads the database) so the laws screen can use it in the browser.
export const TARGET_MEASURES: { key: string; label: string; unit: string; href?: string }[] = [
  { key: 'counts', label: 'Different items counted (Counts)', unit: 'items', href: '/item?view=counts' },
  { key: 'sales_count', label: 'Sales recorded (Live)', unit: 'sales' },
  { key: 'sales_value', label: 'Sales value recorded (₵)', unit: '₵' },
  { key: 'tasks_done', label: 'Checklist tasks done', unit: 'tasks', href: '/todo' },
  { key: 'customers_added', label: 'Customers registered', unit: 'customers', href: '/customers' },
  { key: 'bills_recorded', label: 'Bills recorded', unit: 'bills' },
  { key: 'expenses_recorded', label: 'Expenses recorded', unit: 'expenses' },
  { key: 'ticks', label: 'Ticked by the person, confirmed by a supervisor (e.g. posted a video)', unit: 'ticks' },
  { key: 'jobs_done', label: 'Pending jobs finished', unit: 'jobs', href: '/pending-jobs' },
]
export const measureOf = (k: string | null | undefined) => TARGET_MEASURES.find(m => m.key === k)
