import type { ColumnDef } from './columnPrefs'

// Split out from BillsTab.tsx so item/page.tsx can also call useColumnPrefs
// with the same key/columns (to render the Columns picker button up in its
// own header row) without statically importing BillsTab.tsx itself, which
// is lazy-loaded via next/dynamic({ ssr: false }). Same reasoning as
// salesTabColumns.ts.
//
// Item stays sticky/always-visible (first column); these are the ones the
// picker can hide/reorder/rename. unitPrice is VCP (Vendor Cost Price --
// straight off this bill's own unit_price, the same value items.purchase_rate
// now syncs from -- see lib/vcpSync.ts). sharedExpenses/adjustedCost are
// computed, not stored (see BillsTab's groupedList); newSp is the one
// editable cell here, and writes straight to the item's live selling price.
export type ColKey = 'quantity' | 'unitPrice' | 'sharedExpenses' | 'adjustedCost' | 'itemTotal' | 'newSp'

export const COLUMNS: ColumnDef<ColKey>[] = [
  { key: 'quantity',       label: 'QTY' },
  { key: 'unitPrice',      label: 'VCP' },
  { key: 'sharedExpenses', label: 'Shared Exp' },
  { key: 'adjustedCost',   label: 'ACP' },
  { key: 'itemTotal',      label: 'TOTAL' },
  { key: 'newSp',          label: 'New SP' },
]
