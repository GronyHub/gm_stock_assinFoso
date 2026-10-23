'use client'
import { useState } from 'react'
import CustomerBox from './CustomerBox'

export type BasketLine = { itemId: number; name: string; qty: string; price: string }

// MI (multiple items): the basket for one customer's sale. Items are added from the Live Sale cards,
// listed here with their quantity and price, and issued together as one receipt.
export default function MIBasket({ lines, onQty, onPrice, onRemove, customer, onCustomer, onName, onRegister, date, onDate, onComplete, onClear, busy, error }: {
  lines: BasketLine[]; onQty: (id: number, v: string) => void; onPrice: (id: number, v: string) => void; onRemove: (id: number) => void
  customer: string; onCustomer: (digits: string) => void; onName: (n: string) => void
  onRegister: (phone: string, done: (code: string) => void) => void
  date: string; onDate: (d: string) => void; onComplete: () => void; onClear: () => void; busy: boolean; error: string
}) {
  const [open, setOpen] = useState(true)
  const total = lines.reduce((s, l) => s + (Number(l.qty) || 0) * (Number(l.price) || 0), 0)
  const today = new Date().toISOString().slice(0, 10)
  return (
    <div className="fixed inset-x-0 bottom-0 z-[90] border-t-2 border-blue-600 bg-white shadow-2xl">
      <button type="button" onClick={() => setOpen(o => !o)} className="flex w-full items-center justify-between bg-blue-600 px-3 py-2 text-left text-sm font-bold text-white">
        <span>MI · {lines.length} item{lines.length === 1 ? '' : 's'}</span>
        <span>₵{total.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {open ? '▼' : '▲'}</span>
      </button>
      {open && (
        <div className="max-h-[62vh] space-y-2 overflow-y-auto p-3">
          {lines.length === 0 && <p className="text-xs text-gray-500">Tap ✓ on the item cards to add them here. Add as many as the customer is buying.</p>}
          {lines.map(l => (
            <div key={l.itemId} className="flex items-center gap-1.5 rounded-lg bg-gray-50 p-1.5">
              <p className="min-w-0 flex-1 truncate text-xs font-semibold text-gray-900">{l.name}</p>
              <input type="number" min={1} inputMode="numeric" value={l.qty} onChange={e => onQty(l.itemId, e.target.value)} className="w-12 rounded border border-gray-300 px-1 py-1 text-xs" aria-label="Quantity" />
              <span className="text-[10px] text-gray-400">×₵</span>
              <input type="number" min={0} step="any" inputMode="decimal" value={l.price} onChange={e => onPrice(l.itemId, e.target.value)} className="w-16 rounded border border-gray-300 px-1 py-1 text-xs" aria-label="Price" />
              <span className="w-14 text-right text-xs font-bold text-gray-800">₵{((Number(l.qty) || 0) * (Number(l.price) || 0)).toLocaleString('en-GB', { maximumFractionDigits: 2 })}</span>
              <button type="button" onClick={() => onRemove(l.itemId)} className="px-1 text-lg leading-none text-red-500" aria-label="Remove">&times;</button>
            </div>
          ))}
          <div className="grid grid-cols-2 gap-2 pt-1">
            <div>
              <p className="mb-0.5 text-[10px] font-semibold uppercase text-gray-400">Customer (GM ID, phone or name)</p>
              <div className="rounded-lg border border-gray-300 px-2 py-1.5">
                <CustomerBox value={customer} onChange={onCustomer} onName={onName} onRegister={onRegister} disabled={busy}
                  placeholder="GM / phone / name" className="w-full text-sm font-semibold text-gray-900 outline-none" />
              </div>
            </div>
            <div>
              <p className="mb-0.5 text-[10px] font-semibold uppercase text-gray-400">Sale date</p>
              <input type="date" value={date} max={today} onChange={e => onDate(e.target.value || today)} className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm" />
            </div>
          </div>
          {error && <p className="text-xs font-semibold text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button type="button" disabled={busy || lines.length === 0} onClick={onComplete}
              className="flex-1 rounded-xl bg-green-600 py-3 text-sm font-bold text-white disabled:opacity-40">{busy ? 'Recording…' : customer ? 'Record sale and issue receipt' : 'Record sale (no customer, no receipt)'}</button>
            <button type="button" disabled={busy || lines.length === 0} onClick={onClear} className="rounded-xl bg-gray-100 px-4 py-3 text-sm font-semibold text-gray-600 disabled:opacity-40">Clear</button>
          </div>
        </div>
      )}
    </div>
  )
}
