// Shared with page.tsx (the "Columns" picker next to the New button) as
// well as LossTab.tsx itself -- kept in its own tiny module, separate from
// LossTab.tsx's own (dynamically-imported, ssr:false) bundle, so the picker
// doesn't force that whole heavy component to load just to read column
// labels/widths.
export type SortCol = 'item_name' | 'cf_group' | 'product_type' | 'lgAmt' | 'lgQty' | 'lossCount' | 'gainAmt' | 'wic' | 'gmc' | 'bl' | 'soh' | 'sp' | 'cp' | 'count_interval'

// Every column besides the always-visible sticky Item column, in display
// order -- the single source of truth for LossTab's colgroup, header, and
// each row's cells so a column's visibility/width can't drift out of sync
// between them.
export type ColKey = Exclude<SortCol, 'item_name'>
export const COLUMNS: { key: ColKey; label: string; width: number }[] = [
  { key: 'lgAmt', label: 'Loss Amt.', width: 56 },
  { key: 'lossCount', label: 'Loss No.', width: 52 },
  { key: 'gainAmt', label: 'Gain', width: 44 },
  { key: 'wic', label: 'WIC', width: 40 },
  { key: 'gmc', label: 'GMC', width: 40 },
  { key: 'bl', label: 'BL', width: 36 },
  { key: 'soh', label: 'SOH', width: 40 },
  { key: 'sp', label: 'SP', width: 44 },
  { key: 'cp', label: 'VCP', width: 44 },
  { key: 'cf_group', label: 'Group', width: 70 },
  { key: 'product_type', label: 'Type', width: 64 },
  // The only place this table's own row can confirm a "Count every N days"
  // edit actually took -- see ItemEditForm's cadence field in the item's
  // own edit sheet, which otherwise has nowhere on this page to show back.
  { key: 'count_interval', label: 'Count', width: 64 },
]
export const COL_BY_KEY = new Map(COLUMNS.map(c => [c.key, c]))
export const ALL_COL_KEYS = COLUMNS.map(c => c.key)
