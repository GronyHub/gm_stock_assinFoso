'use client'
import { useEffect, useRef, useState } from 'react'

type Item = { id: number; name: string; selling_price: number; soh: number }
type Proposal = { qty: number; price: number | null; buyer: { kind: string; value: string }; items: Item[] }
type Rec = { start: () => void; stop: () => void; onresult: ((e: any) => void) | null; onerror: ((e: any) => void) | null; onend: (() => void) | null; lang: string; interimResults: boolean; continuous: boolean } // eslint-disable-line @typescript-eslint/no-explicit-any

// Live Sale by voice. The staff member taps the microphone and says what they sold ("two passport photos for GM 123", "print five pages for man on motor").
// The phone turns it into text, the app finds the item, quantity, price and who it is for, and SHOWS them. Nothing is recorded until the staff
// member checks the card and taps "Record sale". If the phone cannot listen, the same card works by typing (or the keyboard's own microphone).
export default function VoiceSale({ onRecorded }: { onRecorded: (tap: unknown) => void }) {
  const [open, setOpen] = useState(false)
  const [listening, setListening] = useState(false)
  const [text, setText] = useState('')
  const [p, setP] = useState<Proposal | null>(null)
  const [itemId, setItemId] = useState<number | null>(null)
  const [qty, setQty] = useState('1')
  const [price, setPrice] = useState('')
  const [who, setWho] = useState('')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const rec = useRef<Rec | null>(null)
  const supported = typeof window !== 'undefined' && !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition) // eslint-disable-line @typescript-eslint/no-explicit-any

  useEffect(() => () => { try { rec.current?.stop() } catch { /* ignore */ } }, [])

  async function parse(t: string) {
    setMsg(''); setBusy(true)
    const r = await fetch('/api/sales/voice-parse', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: t }) })
    const d = await r.json().catch(() => ({}))
    setBusy(false)
    if (!r.ok) { setMsg(d.error ?? 'Could not read that. Try again.'); return }
    setP(d); setItemId(d.items?.[0]?.id ?? null); setQty(String(d.qty))
    setPrice(d.price != null ? String(d.price) : '')
    setWho(d.buyer.kind === 'gm' ? `GM${d.buyer.value}` : d.buyer.value)
    if (!d.items?.length) setMsg('I could not find that item. Say it again, or type the item name.')
  }

  function listen() {
    setMsg(''); setOpen(true)
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition // eslint-disable-line @typescript-eslint/no-explicit-any
    if (!SR) { setMsg('This phone cannot listen in the browser. Type what you sold, or use the keyboard microphone.'); return }
    const r: Rec = new SR()
    r.lang = 'en-GB'; r.interimResults = false; r.continuous = false
    r.onresult = e => { const t = String(e.results?.[0]?.[0]?.transcript ?? '').trim(); if (t) { setText(t); void parse(t) } }
    r.onerror = e => { setListening(false); setMsg(e?.error === 'not-allowed' ? 'Allow the microphone for this site, then try again.' : 'I did not hear you. Tap the microphone and try again.') }
    r.onend = () => setListening(false)
    rec.current = r; setListening(true); try { r.start() } catch { setListening(false) }
  }

  function close() { try { rec.current?.stop() } catch { /* ignore */ } setOpen(false); setListening(false); setText(''); setP(null); setMsg(''); setWho(''); setPrice('') }

  async function record() {
    if (!itemId) return
    const w = who.trim()
    if (!w) { setMsg('Say who this sale is for: a GM number, a phone number or a label such as "Man on motor".'); return }
    const qn = Math.floor(Number(qty))
    if (!Number.isFinite(qn) || qn < 1) { setMsg('Quantity must be 1 or more.'); return }
    const gm = /^(?:gm)?\s*(\d{1,6})$/i.exec(w)
    setBusy(true); setMsg('')
    const r = await fetch('/api/sales/live-tap', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
      itemId, quantity: qn, customPrice: price ? Number(price) : undefined, requireWho: true,
      customerIdCode: gm ? `GM${gm[1]}` : undefined, customerPhone: /^0\d{9}$/.test(w) ? w : undefined,
      customerLabel: !gm && !/^0\d{9}$/.test(w) ? w : undefined,
    }) })
    const d = await r.json().catch(() => ({}))
    setBusy(false)
    if (!r.ok || !d.tap) { setMsg(d.error ?? 'The sale was not recorded.'); return }
    onRecorded(d.tap); close()
  }

  const pick = p?.items.find(i => i.id === itemId)
  return (<>
    <button type="button" onClick={listen} title="Record a sale with your voice" aria-label="Record a sale with your voice"
      className="fixed bottom-28 right-4 z-40 flex h-11 items-center gap-1.5 rounded-full bg-red-600 px-3.5 text-sm font-extrabold text-white shadow-lg active:bg-red-700 print:hidden"><span className="text-lg">🎤</span>Voice sale</button>
    {open && (
      <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/50 sm:items-center print:hidden" onClick={close}>
        <div onClick={e => e.stopPropagation()} className="max-h-[92vh] w-full max-w-md space-y-2 overflow-y-auto rounded-t-3xl bg-white p-4 pb-6 sm:rounded-3xl">
          <div className="flex items-center justify-between">
            <p className="text-base font-extrabold text-[#14213D]">🎤 Say what you sold</p>
            <button type="button" onClick={close} className="rounded-lg bg-gray-100 px-2.5 py-1 text-xs font-bold text-gray-700">✕</button>
          </div>
          <p className="text-xs text-gray-600">For example: “two passport photos for GM 123”, “print five pages for man on motor”. Check the card below before you record it.</p>
          <div className="flex gap-2">
            <button type="button" onClick={listen} disabled={listening || !supported} className={`flex-1 rounded-xl py-2.5 text-sm font-bold text-white ${listening ? 'animate-pulse bg-red-600' : 'bg-[#14213D]'} disabled:opacity-60`}>{listening ? 'Listening…' : supported ? 'Tap and speak' : 'Mic not available'}</button>
          </div>
          <div className="flex gap-2">
            <input value={text} onChange={e => setText(e.target.value)} placeholder="or type it here" className="min-w-0 flex-1 rounded-xl border-2 border-gray-300 p-2 text-sm" />
            <button type="button" disabled={busy || text.trim().length < 2} onClick={() => void parse(text)} className="rounded-xl bg-gray-800 px-3 text-sm font-bold text-white disabled:opacity-40">Read</button>
          </div>
          {p && (
            <div className="space-y-2 rounded-2xl bg-gray-50 p-2">
              <p className="text-xs font-bold uppercase text-gray-500">Item</p>
              {p.items.length === 0 && <p className="text-sm text-red-700">No matching item.</p>}
              {p.items.map(i => (
                <label key={i.id} className={`flex cursor-pointer items-center gap-2 rounded-xl border-2 p-2 text-sm ${itemId === i.id ? 'border-green-500 bg-green-50' : 'border-gray-200 bg-white'}`}>
                  <input type="radio" name="voiceitem" checked={itemId === i.id} onChange={() => { setItemId(i.id); if (!p.price) setPrice('') }} />
                  <span className="min-w-0 flex-1 font-semibold text-gray-900">{i.name}</span><span className="shrink-0 text-xs text-gray-600">₵{i.selling_price}</span>
                </label>))}
              <div className="grid grid-cols-2 gap-2">
                <label className="text-xs font-bold text-gray-600">Quantity<input inputMode="numeric" value={qty} onChange={e => setQty(e.target.value.replace(/\D/g, ''))} className="mt-0.5 w-full rounded-lg border-2 border-gray-300 p-2 text-base" /></label>
                <label className="text-xs font-bold text-gray-600">Price each (₵)<input inputMode="decimal" value={price} placeholder={pick ? String(pick.selling_price) : ''} onChange={e => setPrice(e.target.value)} className="mt-0.5 w-full rounded-lg border-2 border-gray-300 p-2 text-base" /></label>
              </div>
              <label className="block text-xs font-bold text-gray-600">Who is it for? (GM number, phone or a label)<input value={who} onChange={e => setWho(e.target.value)} placeholder="e.g. GM123 or Man on motor" className="mt-0.5 w-full rounded-lg border-2 border-gray-300 p-2 text-base" /></label>
            </div>)}
          {msg && <p className="text-sm font-bold text-red-700">{msg}</p>}
          {p && <button type="button" disabled={busy || !itemId} onClick={() => void record()} className="w-full rounded-xl bg-green-600 py-3 text-base font-bold text-white disabled:opacity-40">Record sale</button>}
        </div>
      </div>)}
  </>)
}
