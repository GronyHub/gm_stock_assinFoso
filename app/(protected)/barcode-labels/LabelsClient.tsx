'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import JsBarcode from 'jsbarcode'

type It = { id: number; name: string; price: number }
type Label = It & { code: string }

function Bars({ code }: { code: string }) {
  const ref = useRef<SVGSVGElement>(null)
  useEffect(() => { if (ref.current) { try { JsBarcode(ref.current, code, { format: 'CODE128', width: 1.6, height: 38, displayValue: true, fontSize: 11, margin: 0 }) } catch { /* ignore */ } } }, [code])
  return <svg ref={ref} className="mx-auto" />
}

// Barcode labels for items that have none. Choose items, press "Make labels": each gets its own code (GM + its number), saved against the item, and a sheet
// is shown ready to print and cut. Scanning a printed label finds the item.
export default function LabelsClient() {
  const [items, setItems] = useState<It[]>([])
  const [q, setQ] = useState('')
  const [pick, setPick] = useState<Set<number>>(new Set())
  const [labels, setLabels] = useState<Label[] | null>(null)
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => { fetch('/api/items/barcode/labels').then(r => r.json()).then(d => { if (Array.isArray(d?.items)) setItems(d.items); else setMsg(d?.error ?? '') }).catch(() => {}) }, [])
  const shown = useMemo(() => items.filter(i => i.name.toLowerCase().includes(q.toLowerCase())), [items, q])
  const toggle = (id: number) => setPick(p => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n })
  async function make() {
    setBusy(true); setMsg('')
    const r = await fetch('/api/items/barcode/labels', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ itemIds: Array.from(pick) }) })
    const d = await r.json().catch(() => ({}))
    setBusy(false)
    if (!r.ok) { setMsg(d.error ?? 'Could not make the labels.'); return }
    setLabels(d.labels)
  }
  if (labels) return (
    <div className="mx-auto max-w-3xl p-3">
      <div className="mb-2 flex items-center gap-2 print:hidden">
        <button type="button" onClick={() => window.print()} className="rounded-xl bg-[#14213D] px-4 py-2 text-sm font-bold text-white">Print the labels</button>
        <button type="button" onClick={() => { setLabels(null); setPick(new Set()); location.reload() }} className="rounded-xl bg-gray-100 px-4 py-2 text-sm font-bold text-gray-700">Done</button>
        <p className="text-xs text-gray-600">{labels.length} labels. Print on plain or sticker paper, cut and stick on the item or its shelf.</p>
      </div>
      <div className="grid grid-cols-3 gap-2 print:gap-1">
        {labels.map(l => (
          <div key={l.code} className="break-inside-avoid rounded border border-gray-300 p-2 text-center">
            <p className="truncate text-[12px] font-bold leading-tight text-gray-900">{l.name}</p>
            <Bars code={l.code} />
            <p className="text-[12px] font-semibold text-gray-700">₵{l.price}</p>
          </div>))}
      </div>
    </div>
  )
  return (
    <div className="mx-auto max-w-3xl space-y-2 p-3">
      <h1 className="text-xl font-extrabold text-[#14213D]">Barcode labels</h1>
      <p className="text-sm text-gray-700">These items have no barcode yet. Tick the ones you want labels for. Items that already have a barcode printed on their pack can instead be scanned once with the 📷 button, which links that barcode to the item.</p>
      <div className="flex gap-2">
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search items" className="min-w-0 flex-1 rounded-xl border-2 border-gray-300 p-2 text-sm" />
        <button type="button" onClick={() => setPick(new Set(shown.slice(0, 200).map(i => i.id)))} className="rounded-xl bg-gray-100 px-3 text-xs font-bold text-gray-700">Tick shown</button>
        <button type="button" onClick={() => setPick(new Set())} className="rounded-xl bg-gray-100 px-3 text-xs font-bold text-gray-700">Clear</button>
      </div>
      <ul className="max-h-[60vh] divide-y overflow-y-auto rounded-xl border border-gray-200 bg-white">
        {shown.slice(0, 400).map(i => (
          <li key={i.id}><label className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm"><input type="checkbox" checked={pick.has(i.id)} onChange={() => toggle(i.id)} className="h-4 w-4" /><span className="min-w-0 flex-1 truncate">{i.name}</span><span className="shrink-0 text-xs text-gray-500">₵{i.price}</span></label></li>))}
        {!shown.length && <li className="p-3 text-sm text-gray-500">No items without a barcode.</li>}
      </ul>
      {msg && <p className="text-sm font-bold text-red-700">{msg}</p>}
      <button type="button" disabled={!pick.size || busy} onClick={() => void make()} className="w-full rounded-xl bg-green-600 py-3 text-base font-bold text-white disabled:opacity-40">Make {pick.size || ''} label{pick.size === 1 ? '' : 's'}</button>
    </div>
  )
}
