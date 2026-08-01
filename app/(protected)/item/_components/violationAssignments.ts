// The 9 recurring data-integrity violation types that can be assigned to a
// staff member (with an optional deadline) -- moved out of the old
// standalone Assignments screen (see StaffClient.tsx) so each one's
// AssignWidget can live right on its own "home" page (Sales, Items, CAB,
// Staff Times) instead of one central admin list. `auto` marks the ones
// with a fixed date to measure against for auto-penalty enforcement --
// the rest have no natural "overdue" date, so no auto-penalty applies.
export const ASSIGNABLE_VIOLATIONS: { type: string; label: string; auto: boolean }[] = [
  { type: 'missing_days', label: 'Sales Receipts not entered', auto: true },
  { type: 'no_cash', label: 'Walk-in receipts missing cash counted', auto: true },
  { type: 'cost_gte_sell', label: 'Cost Price ≥ Selling Price', auto: true },
  { type: 'no_staff_times', label: 'Days with no staff times recorded', auto: true },
  { type: 'unchecked_cab', label: 'Weeks with no Cash at Bank confirmation', auto: true },
  { type: 'no_group', label: 'Items with no group assigned', auto: false },
  { type: 'duplicates', label: 'Possible duplicate item pairs', auto: false },
  { type: 'not_in_inventory', label: 'Item names not found in inventory', auto: false },
  { type: 'dup_receipts', label: 'Days with duplicate WIC/GMC receipts', auto: true },
]

export const ASSIGNABLE_STAFF = ['joe', 'bino', 'james', 'rawlings', 'grony']
