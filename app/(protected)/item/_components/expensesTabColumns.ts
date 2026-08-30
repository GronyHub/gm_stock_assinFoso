import type { ColumnDef } from './columnPrefs'

// Split out from ExpensesTab.tsx so item/page.tsx can also call
// useColumnPrefs with the same columns (to render the Columns picker
// button up in its own header row) without statically importing
// ExpensesTab.tsx itself, which is lazy-loaded via next/dynamic. Same
// reasoning as salesTabColumns.ts/billsTabColumns.ts.
//
// force-hidden while grouped by that field. Property columns are shown
// only when viewing properties.
export type ColKey = 'date' | 'account' | 'group' | 'is_property' | 'amount' | 'expense_type' | 'vendor' | 'source' | 'by' | 'is_related_expense' | 'related_property' | 'related_reasons' | 'property_status' | 'property_type' | 'availability' | 'working' | 'location' | 'reason'

export const COLUMNS: ColumnDef<ColKey>[] = [
  { key: 'account',      label: 'Account' },
  { key: 'group',        label: 'Group' },
  { key: 'is_property',  label: 'Is Property?' },
  { key: 'amount',       label: 'Amount' },
  { key: 'expense_type', label: 'Expense Type' },
  { key: 'date',         label: 'Date' },
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
