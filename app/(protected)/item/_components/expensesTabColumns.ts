import type { ColumnDef } from './columnPrefs'

// Split out from ExpensesTab.tsx so item/page.tsx can also call
// useColumnPrefs with the same columns (to render the Columns picker
// button up in its own header row) without statically importing
// ExpensesTab.tsx itself, which is lazy-loaded via next/dynamic. Same
// reasoning as salesTabColumns.ts/billsTabColumns.ts.
//
// Account/Date/Amount are deliberately NOT in here -- Date and Account are
// frozen columns in ExpenseTable (always rendered first, sticky while
// scrolling right, own dedicated <td>s), same as Sales/Bills keep their
// own pinned columns out of their ColKey unions; Amount is a third fixed
// column (always shown right after Account) that this list's own former
// "Amount" entry duplicated -- toggling it added/removed a second, redundant
// amount column instead of controlling the one actually shown, which is
// exactly the "picker doesn't match the table" report. Group has no such
// reason to be frozen -- it's a normal column here.
//
// force-hidden while grouped by that field. Property columns are shown
// only when viewing properties.
export type ColKey = 'group' | 'is_property' | 'expense_type' | 'vendor' | 'source' | 'by' | 'is_related_expense' | 'related_property' | 'related_reasons' | 'property_status' | 'property_type' | 'availability' | 'working' | 'location' | 'reason'

export const COLUMNS: ColumnDef<ColKey>[] = [
  { key: 'group',        label: 'Group' },
  { key: 'is_property',  label: 'Is Property?' },
  { key: 'expense_type', label: 'Expense Type' },
  { key: 'vendor',       label: 'Vendor' },
  { key: 'source',       label: 'Source' },
  { key: 'by',           label: 'By' },
  { key: 'is_related_expense', label: 'Related to Property?' },
  { key: 'related_property', label: 'Related Property' },
  { key: 'related_reasons', label: 'Relationship' },
  { key: 'property_status', label: 'Property Status' },
  { key: 'property_type', label: 'Type' },
  { key: 'availability', label: 'Available?' },
  { key: 'working',      label: 'Condition' },
  { key: 'location',     label: 'Location' },
  { key: 'reason',       label: 'Reason' },
]
