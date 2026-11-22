'use client'
import { useProgressive } from '@/lib/useProgressive'

// The Customers list on a phone: one card per customer. Tapping a card opens that customer's details and edit form (full screen).
type Cust = {
  id: number; customer_id_code: string | null; display_name: string; phone: string | null; email: string | null; location: string | null; service_goods: string | null
  status: string | null; is_internal: boolean; receipt_count: number; invoice_outstanding: string
}

const cedi = (v: string | null | undefined) => {
  const n = parseFloat(v ?? '0')
  return isNaN(n) ? '—' : `₵${n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
}

export default function CustomerCards({ customers, selectedId, showIncomplete, onOpen }: { customers: Cust[]; selectedId: number | null; showIncomplete: boolean; onOpen: (c: Cust) => void }) {
  const { shown, sentinel } = useProgressive(customers, 40)
  if (customers.length === 0) return <p className="py-10 text-center text-sm text-gray-400">No customers found.</p>
  return (
    <div className="space-y-2 pb-24">
      {customers.slice(0, shown).map(c => {
        const incomplete = !c.phone || !c.email || !c.location || !c.service_goods
        const owes = parseFloat(c.invoice_outstanding) > 0
        return (
          <button key={c.id} type="button" onClick={() => onOpen(c)}
            className={`block w-full rounded-xl border bg-white px-3 py-2.5 text-left shadow-sm active:bg-gray-50 ${selectedId === c.id ? 'border-blue-500 ring-2 ring-blue-300' : 'border-gray-200'}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-wide text-blue-600">{c.customer_id_code ?? '—'}{c.location ? <span className="text-gray-500"> · {c.location}</span> : null}</p>
                <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[15px] font-semibold leading-snug text-gray-900">
                  <span className="min-w-0 break-words">{c.display_name}</span>
                  {c.is_internal && <span className="rounded-full bg-purple-100 px-1.5 py-0.5 text-[10px] font-bold text-purple-700">INT</span>}
                  {incomplete && showIncomplete && <span title="Incomplete profile" aria-label="Incomplete profile">⚠️</span>}
                </p>
                <p className="text-[13px] text-gray-600">{c.phone ?? <span className="text-gray-400">No phone</span>}</p>
              </div>
              {owes && <p className="shrink-0 text-[14px] font-extrabold tabular-nums text-red-600">{cedi(c.invoice_outstanding)}</p>}
            </div>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${c.status === 'Active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{c.status ?? 'Unknown'}</span>
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-700">{c.receipt_count} receipt{c.receipt_count === 1 ? '' : 's'}</span>
              {owes && <span className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-700">Owes</span>}
            </div>
          </button>
        )
      })}
      {shown < customers.length && <div ref={sentinel} className="py-3 text-center text-[12px] text-gray-400">Loading more…</div>}
    </div>
  )
}
