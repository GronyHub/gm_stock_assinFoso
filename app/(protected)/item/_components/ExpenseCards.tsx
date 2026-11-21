'use client'
import { fmtShortUtc } from '@/lib/fmtDate'
import { useProgressive } from '@/lib/useProgressive'

// The Expenses list on a phone: one card per expense (date and account, what it was for, the amount, the vendor) instead of a wide table.
// Tapping a card opens that expense's edit form (the same one the table uses). Long lists are drawn a page at a time as you scroll.
type Card = { id: number; expense_date: string; expense_account: string; description: string | null; vendor_name: string | null; amount: string | null; amount_hidden?: boolean; is_property: boolean; property_type: string | null }
type Item = { kind: 'head'; label: string; total: string } | { kind: 'row'; e: Card }

const money = (v: string | null) => {
  if (v == null) return '—'
  const n = parseFloat(v)
  return isNaN(n) ? '—' : n.toLocaleString('en-GH', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}
const total = (rows: Card[]) => rows.reduce((s, e) => s + (e.amount != null ? parseFloat(e.amount) || 0 : 0), 0).toLocaleString('en-GH', { minimumFractionDigits: 0, maximumFractionDigits: 0 })

export default function ExpenseCards({ rows, groups, highlightId, onOpen }: { rows: Card[]; groups?: { label: string; rows: Card[] }[]; highlightId: number | null; onOpen: (id: number) => void }) {
  const items: Item[] = groups
    ? groups.flatMap(g => [{ kind: 'head', label: g.label, total: total(g.rows) } as Item, ...g.rows.map(e => ({ kind: 'row', e }) as Item)])
    : rows.map(e => ({ kind: 'row', e }) as Item)
  const { shown, sentinel } = useProgressive(items, 40)
  if (items.length === 0) return <p className="py-10 text-center text-sm text-gray-400">No expenses</p>
  return (
    <div className="space-y-2 px-2 pb-24">
      {items.slice(0, shown).map((it, i) => it.kind === 'head' ? (
        <p key={`h${i}`} className="flex items-baseline justify-between px-1 pt-2 text-[12px] font-extrabold uppercase tracking-wide text-gray-600"><span className="min-w-0 truncate">{it.label}</span><span className="shrink-0 tabular-nums">₵{it.total}</span></p>
      ) : (
        <button key={it.e.id} id={`expense-${it.e.id}`} type="button" onClick={() => onOpen(it.e.id)}
          className={`block w-full rounded-xl border bg-white px-3 py-2.5 text-left shadow-sm active:bg-gray-50 ${highlightId === it.e.id ? 'border-blue-500 ring-2 ring-blue-300' : 'border-gray-200'}`}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-wide text-gray-500">{fmtShortUtc(it.e.expense_date)} · {it.e.expense_account}</p>
              <p className="mt-0.5 text-[14px] font-semibold leading-snug text-gray-900">{it.e.description || '—'}</p>
            </div>
            <p className="shrink-0 text-[15px] font-extrabold tabular-nums text-gray-900">{it.e.amount_hidden ? '•••' : `₵${money(it.e.amount)}`}</p>
          </div>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {it.e.vendor_name
              ? <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-700">{it.e.vendor_name}</span>
              : <span className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-700">No vendor</span>}
            {it.e.is_property && <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold text-indigo-700">Property{it.e.property_type ? ` · ${it.e.property_type}` : ''}</span>}
          </div>
        </button>
      ))}
      {shown < items.length && <div ref={sentinel} className="py-3 text-center text-[12px] text-gray-400">Loading more…</div>}
    </div>
  )
}
