'use client'
import { useEffect, useRef, useState } from 'react'
import { eligible } from '@/lib/dictate'

export type ScannedItem = { id: number; name: string; selling_price: number; soh: number }
type Cand = { id: number; name: string; selling_price: number }

// Scan a barcode instead of searching for the item. Three ways in, all giving the same result:
//  - the 📷 button (the phone's camera),
//  - a USB or Bluetooth barcode scanner (it types the digits and presses Enter: picked up anywhere no box is being typed in),
//  - typing the number.
// A barcode the app knows opens its item. A new barcode asks you once to pick its item (search, tap) and remembers it from then on.
export default function ScanButton({ onItem, className = '' }: { onItem: (it: ScannedItem) => void; className?: string }) {
  const [open, setOpen] = useState(false)
  const [code, setCode] = useState('')
  const [typed, setTyped] = useState('')
  const [msg, setMsg] = useState('')
  const [link, setLink] = useState<string | null>(null)   // a barcode waiting to be linked to an item
  const [q, setQ] = useState('')
  const [cands, setCands] = useState<Cand[]>([])
  const [busy, setBusy] = useState(false)
  const video = useRef<HTMLVideoElement>(null)
  const stopCam = useRef<() => void>(() => {})

  async function lookup(c: string) {
    setBusy(true); setMsg('')
    const r = await fetch(`/api/items/barcode?code=${encodeURIComponent(c)}`, { cache: 'no-store' })
    const d = await r.json().catch(() => ({}))
    setBusy(false)
    if (!r.ok) { setMsg(d.error ?? 'Could not look that up.'); return }
    if (d.item) { close(); onItem(d.item as ScannedItem) } else { setLink(c); setQ(''); setCands([]) }
  }

  // USB / Bluetooth scanner: digits arrive in a fast burst and end with Enter. Ignored while a box is being typed in.
  useEffect(() => {
    let buf = '', last = 0
    const key = (e: KeyboardEvent) => {
      if (eligible(document.activeElement) || e.ctrlKey || e.metaKey || e.altKey) return
      const now = Date.now()
      if (now - last > 80) buf = ''
      last = now
      if (e.key === 'Enter') { if (buf.length >= 6) { const c = buf; buf = ''; setOpen(true); void lookup(c) } buf = ''; return }
      if (e.key.length === 1 && /[0-9A-Za-z-]/.test(e.key)) buf += e.key
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // The camera: the phone's own barcode reader when it has one, otherwise a small reader library.
  useEffect(() => {
    if (!open || link) return
    let alive = true, stream: MediaStream | null = null, timer: ReturnType<typeof setInterval> | null = null
    ;(async () => {
      try {
        const BD = (window as unknown as { BarcodeDetector?: new (o: object) => { detect: (v: HTMLVideoElement) => Promise<{ rawValue: string }[]> } }).BarcodeDetector
        if (BD) {
          stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
          const v = video.current; if (!v || !alive) return
          v.srcObject = stream; await v.play()
          const det = new BD({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'itf', 'qr_code'] })
          timer = setInterval(async () => {
            try { const r = await det.detect(v); if (r[0]?.rawValue && alive) { alive = false; setCode(r[0].rawValue); void lookup(r[0].rawValue) } } catch { /* keep looking */ }
          }, 350)
        } else {
          const { BrowserMultiFormatReader } = await import('@zxing/browser')
          const reader = new BrowserMultiFormatReader()
          const v = video.current; if (!v) return
          const ctl = await reader.decodeFromVideoDevice(undefined, v, res => { if (res && alive) { alive = false; setCode(res.getText()); void lookup(res.getText()) } })
          stopCam.current = () => ctl.stop()
        }
      } catch { if (alive) setMsg('The camera could not start. Allow camera access for this site, or type the number below.') }
    })()
    return () => { alive = false; if (timer) clearInterval(timer); stream?.getTracks().forEach(t => t.stop()); try { stopCam.current() } catch { /* ignore */ } }
  }, [open, link]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!link || q.trim().length < 2) { setCands([]); return }
    const t = setTimeout(() => fetch(`/api/items/search?q=${encodeURIComponent(q.trim())}`).then(r => r.ok ? r.json() : []).then(d => setCands(Array.isArray(d) ? d.slice(0, 8) : [])).catch(() => {}), 250)
    return () => clearTimeout(t)
  }, [q, link])

  function close() { setOpen(false); setLink(null); setCode(''); setTyped(''); setMsg(''); setQ(''); setCands([]) }
  async function attach(c: Cand) {
    if (!link) return
    setBusy(true)
    const r = await fetch('/api/items/barcode', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: link, itemId: c.id }) })
    const d = await r.json().catch(() => ({}))
    setBusy(false)
    if (!r.ok) { setMsg(d.error ?? 'Could not link it.'); return }
    const it = { id: c.id, name: c.name, selling_price: c.selling_price, soh: 0 }
    close(); onItem(it)
  }

  return (<>
    <button type="button" onPointerDown={e => e.preventDefault()} onClick={() => { setOpen(true); setLink(null); setMsg('') }} title="Scan a barcode" aria-label="Scan a barcode"
      className={`fixed z-40 flex h-11 w-11 items-center justify-center rounded-full bg-gray-800 text-lg text-white shadow-lg hover:bg-gray-900 print:hidden ${className}`}>📷</button>
    {open && (
      <div className="fixed inset-0 z-[95] flex items-end justify-center bg-black/60 sm:items-center print:hidden" onClick={close}>
        <div onClick={e => e.stopPropagation()} className="max-h-[92vh] w-full max-w-md space-y-2 overflow-y-auto rounded-t-3xl bg-white p-4 pb-6 sm:rounded-3xl">
          <div className="flex items-center justify-between"><p className="text-base font-extrabold text-[#14213D]">📷 Scan a barcode</p>
            <button type="button" onClick={close} className="rounded-lg bg-gray-100 px-2.5 py-1 text-xs font-bold text-gray-700">✕</button></div>
          {!link ? (<>
            <video ref={video} muted playsInline className="aspect-video w-full rounded-xl bg-black object-cover" />
            <p className="text-xs text-gray-600">Hold the barcode in front of the camera. A USB or Bluetooth scanner works too: just scan, no need to open this.</p>
            <div className="flex gap-2">
              <input value={typed} onChange={e => setTyped(e.target.value.replace(/[^0-9A-Za-z-]/g, ''))} inputMode="numeric" placeholder="or type the number" data-nomic className="min-w-0 flex-1 rounded-xl border-2 border-gray-300 p-2 text-sm" />
              <button type="button" disabled={busy || typed.length < 4} onClick={() => void lookup(typed)} className="rounded-xl bg-[#14213D] px-3 text-sm font-bold text-white disabled:opacity-40">Find</button>
            </div>
            {code && <p className="text-xs text-gray-500">Read: {code}</p>}
          </>) : (<>
            <p className="rounded-xl bg-amber-50 p-2 text-sm font-bold text-amber-900">This barcode ({link}) is new. Find the item it belongs to. You only do this once.</p>
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search the item name" autoFocus data-nomic className="w-full rounded-xl border-2 border-gray-300 p-2 text-sm" />
            <ul className="space-y-1">{cands.map(c => <li key={c.id}><button type="button" disabled={busy} onClick={() => void attach(c)} className="flex w-full items-center justify-between gap-2 rounded-xl border-2 border-gray-200 p-2 text-left text-sm hover:border-green-500"><span className="font-semibold text-gray-900">{c.name}</span><span className="shrink-0 text-xs text-gray-600">₵{c.selling_price}</span></button></li>)}</ul>
            <button type="button" onClick={() => setLink(null)} className="w-full rounded-xl bg-gray-100 py-2 text-xs font-bold text-gray-700">Scan a different barcode</button>
          </>)}
          {msg && <p className="text-sm font-bold text-red-700">{msg}</p>}
        </div>
      </div>)}
  </>)
}
