import type { ColumnDef } from './columnPrefs'

// Split out from SalesTab.tsx so item/page.tsx can also call useColumnPrefs
// with the same key/columns (to render the Columns picker button up in its
// own header row) without statically importing SalesTab.tsx itself, which
// is lazy-loaded via next/dynamic({ ssr: false }).
//
// Item stays sticky/always-visible (first column); these five are the only
// ones the picker can hide/reorder/rename. CC/WNW only ever get filled in
// on a receipt's own bar row (blank on its item lines); QTY/SP/TOTAL are
// the reverse -- blank on the bar, filled on each line. Widths are
// percentages of the table -- table-layout:fixed scales them proportionally
// when fewer columns are shown, so every column stays visible at once with
// no horizontal scrolling, instead of drag-resizable pixel widths like
// every other table in the app.
export type ColKey = 'cc' | 'wnw' | 'qty' | 'sp' | 'total'

export const SALES_COLUMNS: ColumnDef<ColKey>[] = [
  { key: 'cc',    label: 'CC',    width: 13 },
  { key: 'wnw',   label: 'WNW',   width: 13 },
  { key: 'qty',   label: 'QTY',   width: 10 },
  { key: 'sp',    label: 'SP',    width: 10 },
  { key: 'total', label: 'TOTAL', width: 14 },
]
