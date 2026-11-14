'use client'
import { useEffect, useState } from 'react'

type B = { barcode: string; created_by: string | null }
// The barcodes linked to one item (Item 360). Anyone can add one (type it, or scan it with a USB scanner into the box); only Joe and Grony unlink.
// The 📷 button at the bottom right also links a new barcode: scan it and pick this item.
export default function ItemBarcodes({ itemId, canUnlink }: { itemId: number; canUnlink: boolean }) {
  const [list, setList] = useState<B[]>([])
  const [code, setCode] = useState('')
  const [msg, setMsg] = useState('')
  const load = () => fetch(`/api/items/barcode?itemId=${itemId}`, { cache: 'no-store' }).then(r => r.ok ? r.json() : null).then(d => setList(d?.barcodes ?? [])).catch(() => {})
  useEffect(() => { void load() }, [itemId]) // eslint-disable-line react-hooks/exhaustive-deps
  async function add() {
    setMsg('')
    const r = await fetch('/api/items/barcode', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code, itemId }) })
    const d = await r.json().catch(() => ({}))
    if (!r.ok) { setMsg(d.error ?? 'Could not add it.'); return }
    setCode(''); void load()
  }
  async function remove(b: string) {
    if (!confirm(`Unlink barcode ${b} from this item?`)) return
    await fetch(`/api/items/barcode?code=${encodeURIComponent(b)}`, { method: 'DELETE' }); void load()
  }
  return (
    <div className="border-t border-gray-200 bg-white px-3 py-2">
      <p className="text-[12px] font-bold uppercase text-gray-500">Barcodes ({list.length})</p>
      <div className="mt-1 flex flex-wrap gap-1.5">
        {list.map(b => (
          <span key={b.barcode} className="inline-flex items-center gap-1 rounded-lg bg-gray-100 px-2 py-1 text-[12px] font-mono text-gray-800">{b.barcode}
            {canUnlink && <button type="button" onClick={() => void remove(b.barcode)} title="Unlink" className="font-bold text-red-600">×</button>}</span>))}
        {!list.length && <span className="text-[12px] text-gray-500">None yet: scan this item&apos;s barcode with the 📷 button, or add it below.</span>}
      </div>
      <div className="mt-1.5 flex gap-1.5">
        <input value={code} onChange={e => setCode(e.target.value.replace(/[^0-9A-Za-z-]/g, ''))} placeholder="Type or scan a barcode here" data-nomic className="min-w-0 flex-1 rounded-lg border border-gray-300 px-2 py-1 text-xs" />
        <button type="button" disabled={code.length < 4} onClick={() => void add()} className="rounded-lg bg-[#14213D] px-2.5 text-xs font-bold text-white disabled:opacity-40">Add</button>
      </div>
      {msg && <p className="mt-1 text-[12px] font-bold text-red-700">{msg}</p>}
    </div>
  )
}
