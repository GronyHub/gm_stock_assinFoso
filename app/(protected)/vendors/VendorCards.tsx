'use client'
import { useProgressive } from '@/lib/useProgressive'

// The Vendors list on a phone: one card per vendor, with what has been billed and what is still owed. Tapping a card opens the vendor's details.
type Vend = {
  id: number; display_name: string; company_name: string | null; phone: string | null; location: string | null; status: string | null; is_internal: boolean
  bill_count: number; bill_total: string; outstanding: string
}

const cedi = (v: string | null | undefined) => {
  const n = parseFloat(v ?? '0')
  return isNaN(n) ? '—' : `₵${n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
}

export default function VendorCards({ vendors, selectedId, onOpen }: { vendors: Vend[]; selectedId: number | null; onOpen: (v: Vend) => void }) {
  const { shown, sentinel } = useProgressive(vendors, 40)
  if (vendors.length === 0) return <p className="py-10 text-center text-sm text-gray-400">No vendors found.</p>
  return (
    <div className="space-y-2 pb-24">
      {vendors.slice(0, shown).map(v => {
        const owed = parseFloat(v.outstanding) > 0
        return (
          <button key={v.id} type="button" onClick={() => onOpen(v)}
            className={`block w-full rounded-xl border bg-white px-3 py-2.5 text-left shadow-sm active:bg-gray-50 ${selectedId === v.id ? 'border-blue-500 ring-2 ring-blue-300' : 'border-gray-200'}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-1.5 text-[15px] font-semibold leading-snug text-gray-900">
                  <span className="min-w-0 break-words">{v.display_name}</span>
                  {v.is_internal && <span className="rounded-full bg-purple-100 px-1.5 py-0.5 text-[10px] font-bold text-purple-700">INT</span>}
                </p>
                {v.company_name && v.company_name !== v.display_name && <p className="text-[12px] text-gray-500">{v.company_name}</p>}
                <p className="text-[13px] text-gray-600">{v.phone ?? <span className="text-gray-400">No contact number</span>}{v.location ? ` · ${v.location}` : ''}</p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400">Owed</p>
                <p className={`text-[15px] font-extrabold tabular-nums ${owed ? 'text-red-600' : 'text-gray-900'}`}>{cedi(v.outstanding)}</p>
              </div>
            </div>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-700">{v.bill_count} bill{v.bill_count === 1 ? '' : 's'} · {cedi(v.bill_total)}</span>
              {v.status && v.status !== 'Active' && <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-500">{v.status}</span>}
            </div>
          </button>
        )
      })}
      {shown < vendors.length && <div ref={sentinel} className="py-3 text-center text-[12px] text-gray-400">Loading more…</div>}
    </div>
  )
}
