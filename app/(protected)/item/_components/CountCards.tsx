'use client'
import { useProgressive } from '@/lib/useProgressive'

// The Count records on a phone: one card per count, with the quantity large, who counted and when, and the loss or gain it showed. Edit opens in the card.
export type CountCardRow = {
  id: number; item_id: number | null; item_name: string; count_date: string; quantity_counted: string; notes: string | null
  counted_by: string | null; source: string | null; cf_group: string | null
  expected?: number | string | null; loss_qty?: number | string | null; loss_amt?: number | string | null; kind?: 'loss' | 'gain' | null
}

const cedi = (v: number | string | null | undefined) => `₵${Number(v ?? 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`
const num = (v: number | string | null | undefined) => Number(v ?? 0).toLocaleString(undefined, { maximumFractionDigits: 2 })
const abs = (v: number | string | null | undefined) => Math.abs(Number(v ?? 0)).toLocaleString(undefined, { maximumFractionDigits: 2 })

export default function CountCards({ rows, fmtDate, highlightId, editingId, editQty, editNotes, saving, canDelete, setEditQty, setEditNotes, onEdit, onCancel, onSave, onDelete, onOpenItem }: {
  rows: CountCardRow[]; fmtDate: (d: string) => string; highlightId: number | null; editingId: number | null; editQty: string; editNotes: string; saving: boolean; canDelete: boolean
  setEditQty: (v: string) => void; setEditNotes: (v: string) => void; onEdit: (r: CountCardRow) => void; onCancel: () => void; onSave: () => void; onDelete: (r: CountCardRow) => void; onOpenItem: (id: number) => void
}) {
  const { shown, sentinel } = useProgressive(rows, 40)
  const field = 'w-full rounded-xl border border-gray-300 bg-gray-50 px-3 py-2.5 text-[16px] text-gray-900 outline-none focus:border-blue-500'
  return (
    <div className="space-y-2 pb-24">
      {rows.slice(0, shown).map(r => {
        const editing = editingId === r.id
        return (
          <div key={r.id} id={`count-${r.id}`} className={`rounded-xl border bg-white px-3 py-2.5 shadow-sm ${highlightId === r.id ? 'border-yellow-400 bg-yellow-50' : 'border-gray-200'}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                {r.item_id
                  ? <button type="button" onClick={() => onOpenItem(r.item_id!)} className="block text-left text-[15px] font-semibold leading-snug text-blue-700">{r.item_name}</button>
                  : <p className="text-[15px] font-semibold leading-snug text-gray-900">{r.item_name}</p>}
                <p className="text-[12px] text-gray-500">{fmtDate(r.count_date)}{r.cf_group ? ` · ${r.cf_group}` : ''}</p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400">Counted</p>
                <p className="text-[22px] font-extrabold leading-none tabular-nums text-gray-900">{num(r.quantity_counted)}</p>
              </div>
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px] font-semibold">
              {r.counted_by && <span className="rounded-full bg-gray-100 px-2 py-0.5 capitalize text-gray-700">{r.counted_by}</span>}
              {r.source && <span className="rounded-full bg-gray-100 px-2 py-0.5 text-gray-500">{r.source}</span>}
              {r.kind && r.expected != null && <span className="rounded-full bg-gray-100 px-2 py-0.5 text-gray-600">Expected {num(r.expected)}</span>}
              {r.kind === 'loss' && <span className="rounded-full bg-red-100 px-2 py-0.5 text-red-700">Loss {abs(r.loss_qty)} · {cedi(Math.abs(Number(r.loss_amt ?? 0)))}</span>}
              {r.kind === 'gain' && <span className="rounded-full bg-green-100 px-2 py-0.5 text-green-700">Gain {abs(r.loss_qty)} · {cedi(Math.abs(Number(r.loss_amt ?? 0)))}</span>}
            </div>
            {r.notes && <p className="mt-1 text-[12px] italic text-gray-600">{r.notes}</p>}
            {editing ? (
              <div className="mt-2 space-y-2 border-t border-gray-100 pt-2">
                <div><p className="mb-1 text-[12px] font-semibold text-gray-500">Quantity counted</p><input type="number" inputMode="decimal" min="0" step="any" value={editQty} onChange={e => setEditQty(e.target.value)} className={field} /></div>
                <div><p className="mb-1 text-[12px] font-semibold text-gray-500">Notes</p><input value={editNotes} onChange={e => setEditNotes(e.target.value)} placeholder="Optional" className={field} /></div>
                <div className="flex gap-2">
                  <button type="button" onClick={onSave} disabled={saving} className="min-h-[44px] flex-1 rounded-xl bg-green-600 text-[15px] font-bold text-white disabled:opacity-40">{saving ? 'Saving…' : 'Save'}</button>
                  <button type="button" onClick={onCancel} className="min-h-[44px] flex-1 rounded-xl bg-gray-100 text-[15px] font-bold text-gray-700">Cancel</button>
                </div>
              </div>
            ) : (
              <div className="mt-2 flex gap-2">
                <button type="button" onClick={() => onEdit(r)} className="min-h-[38px] rounded-xl bg-blue-50 px-4 text-[13px] font-bold text-blue-700">Edit</button>
                {canDelete && <button type="button" onClick={() => onDelete(r)} className="min-h-[38px] rounded-xl bg-red-50 px-4 text-[13px] font-bold text-red-700">Delete</button>}
              </div>
            )}
          </div>
        )
      })}
      {shown < rows.length && <div ref={sentinel} className="py-3 text-center text-[12px] text-gray-400">Loading more…</div>}
    </div>
  )
}
