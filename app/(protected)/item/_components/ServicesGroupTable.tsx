'use client'
import { useRouter } from 'next/navigation'
import { useColumnPrefs, ColumnsPickerButton, ResizableTh, type ColumnDef } from './columnPrefs'

type ServiceItem = {
  id: number
  item_name: string
  selling_rate: string | null
  purchase_rate: string | null
  product_type: string
  calculated_soh: number
}

type ColKey = 'type' | 'soh' | 'sp' | 'cp'
const COLUMNS: ColumnDef<ColKey>[] = [
  { key: 'type', label: 'Type' },
  { key: 'soh',  label: 'SOH' },
  { key: 'sp',   label: 'SP' },
  { key: 'cp',   label: 'CP' },
]
const COL_DEFAULTS: Record<string, number> = { item: 220, type: 70, soh: 60, sp: 80, cp: 80 }

const TD = 'px-3 py-2'

function fmtMoney(v: string | null) {
  return v ? `₵${parseFloat(v).toLocaleString('en-GH')}` : '—'
}

// Same resizable/hideable "professional table" every other real list in
// this app already uses (Bills, Expenses, UK/C&H submenus, ...) -- a
// group's items used to be plain stacked cards, the one list left that
// couldn't have its columns resized, reordered, or hidden.
export default function ServicesGroupTable({ items }: { items: ServiceItem[] }) {
  const router = useRouter()
  const colPrefs = useColumnPrefs<ColKey>('servicesGroupTable', COLUMNS)
  const visibleKeys = colPrefs.colOrder.filter(k => colPrefs.visibleCols.has(k))

  function headerCellFor(key: ColKey, isLast: boolean) {
    const label = colPrefs.columnLabels[key] ?? COLUMNS.find(c => c.key === key)!.label
    const align: 'left' | 'right' = key === 'type' ? 'left' : 'right'
    return (
      <ResizableTh key={key} align={align} noDivider={isLast}
        onResize={d => colPrefs.resizeWidth(key, d, COL_DEFAULTS[key])}
        onReset={() => colPrefs.resetWidth(key)}>
        {label}
      </ResizableTh>
    )
  }
  function bodyCellFor(key: ColKey, it: ServiceItem) {
    if (key === 'type') return <td key={key} className={`${TD} text-gray-500 truncate`}>{it.product_type === 'service' ? 'Service' : 'Goods'}</td>
    if (key === 'soh') return <td key={key} className={`${TD} text-right text-gray-700`}>{it.product_type === 'service' ? '—' : it.calculated_soh}</td>
    if (key === 'sp') return <td key={key} className={`${TD} text-right font-bold text-blue-600`}>{fmtMoney(it.selling_rate)}</td>
    return <td key={key} className={`${TD} text-right font-bold text-green-600`}>{fmtMoney(it.purchase_rate)}</td>
  }

  const tableWidth = colPrefs.getWidth('item', COL_DEFAULTS.item)
    + visibleKeys.reduce((s, k) => s + colPrefs.getWidth(k, COL_DEFAULTS[k] ?? 80), 0)

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-end">
        <ColumnsPickerButton prefs={colPrefs} />
      </div>
      <div className="bg-white border border-gray-200 rounded-xl overflow-x-auto">
        <table className="border-collapse text-xs" style={{ tableLayout: 'fixed', width: tableWidth }}>
          <colgroup>
            <col style={{ width: colPrefs.getWidth('item', COL_DEFAULTS.item) }} />
            {visibleKeys.map(k => <col key={k} style={{ width: colPrefs.getWidth(k, COL_DEFAULTS[k] ?? 80) }} />)}
          </colgroup>
          <thead className="sticky top-0 z-10">
            <tr className="bg-gray-50">
              <ResizableTh onResize={d => colPrefs.resizeWidth('item', d, COL_DEFAULTS.item)} onReset={() => colPrefs.resetWidth('item')}>Item</ResizableTh>
              {visibleKeys.map((key, i) => headerCellFor(key, i === visibleKeys.length - 1))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {items.map((it, i) => (
              <tr key={it.id} onClick={() => router.push(`/item?tab=loss&view=item360&jumpItemId=${it.id}`)}
                className={`cursor-pointer transition-colors ${i % 2 === 1 ? 'bg-gray-50' : 'bg-white'} hover:bg-blue-50/60`}>
                <td className={`${TD} font-semibold text-gray-900 truncate`}>{it.item_name}</td>
                {visibleKeys.map(k => bodyCellFor(k, it))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
