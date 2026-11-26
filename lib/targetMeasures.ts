// The things a weekly target can count. Kept apart from lib/targets.ts (which reads the database) so the laws screen can use it in the browser.
// manager: counted for the manager only (not each staff member). needsTask: the law also names one recurring task.
export const TARGET_MEASURES: { key: string; label: string; unit: string; href?: string; manager?: boolean; needsTask?: boolean }[] = [
  { key: 'counts', label: 'Different items counted (Counts)', unit: 'items', href: '/item?view=counts' },
  { key: 'sales_count', label: 'Sales recorded (Live)', unit: 'sales' },
  { key: 'sales_value', label: 'Sales value recorded (₵)', unit: '₵' },
  { key: 'tasks_done', label: 'Checklist tasks done', unit: 'tasks', href: '/todo' },
  { key: 'customers_added', label: 'Customers registered', unit: 'customers', href: '/customers' },
  { key: 'bills_recorded', label: 'Bills recorded', unit: 'bills' },
  { key: 'expenses_recorded', label: 'Expenses recorded', unit: 'expenses' },
  { key: 'flags_fixed', label: 'Flags fixed in the week (all flags, for the manager)', unit: 'flags', manager: true },
  { key: 'task_done', label: 'One chosen recurring task done (times a week)', unit: 'times', needsTask: true },
  { key: 'ticks', label: 'Ticked by the person, confirmed by a supervisor (e.g. posted a video)', unit: 'ticks' },
  { key: 'jobs_done', label: 'Pending jobs finished', unit: 'jobs', href: '/pending-jobs' },
]
export const measureOf = (k: string | null | undefined) => TARGET_MEASURES.find(m => m.key === k)
