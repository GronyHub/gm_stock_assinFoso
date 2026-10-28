'use client'
import { useEffect, useRef, useState } from 'react'

type Hit = { id: number; customer_id_code: string; display_name: string; company_name: string | null; phone: string | null }

// The GM box. Digits = a customer ID (e.g. 123) or a 10-digit phone number starting
// with 0, passed up as `value` exactly as before. Letters search saved customers by
// name: pick one and the box holds that customer's ID.
export default function CustomerBox({ value, onChange, onName, onLabel, label, onRegister, disabled, placeholder, className, onEnter }: {
  value: string; onChange: (digits: string) => void; onName?: (name: string) => void;
  // Optional: lets staff type a description ("Girl in yellow shirt") that only names who did the work.
  // `label` is the parent's current label; an empty string clears the box of a label.
  onLabel?: (label: string | null) => void; label?: string; onRegister?: (phone: string, done: (customerCode: string) => void) => void; disabled?: boolean; placeholder?: string; className?: string; onEnter?: () => void
}) {
  const [text, setText] = useState(value)
  const [hits, setHits] = useState<Hit[]>([])
  const [newName, setNewName] = useState('')
  const [recent, setRecent] = useState<string[]>([])
  const [typed, setTyped] = useState('')
  const labelShown = useRef(false)
  const [unknownPhone, setUnknownPhone] = useState(false)
  const [pos, setPos] = useState<{ left: number; top?: number; bottom?: number; width: number } | null>(null)
  // Place the drop-down under the box, or above it when there is not enough room below (e.g. in the MI basket
  // at the bottom of the screen, or with the phone keyboard open).
  function place(estimatedHeight: number) {
    const b = inputRef.current?.getBoundingClientRect()
    if (!b) return
    const vh = window.visualViewport?.height ?? window.innerHeight
    const left = Math.max(8, Math.min(b.left, window.innerWidth - 248))
    const width = Math.max(b.width, 240)
    if (b.bottom + estimatedHeight + 8 > vh && b.top > estimatedHeight) setPos({ left, bottom: window.innerHeight - b.top + 4, width })
    else setPos({ left, top: b.bottom + 2, width })
  }
  const emitted = useRef(value)
  const inputRef = useRef<HTMLInputElement>(null)
  const seq = useRef(0)

  // The parent cleared or replaced the value (e.g. after a sale): follow it.
  useEffect(() => {
    if (value !== emitted.current) { emitted.current = value; setText(value); setHits([]); setUnknownPhone(false); setNewName(''); onName?.('') }
  }, [value])

  // The parent cleared the label (after a sale): clear the box too.
  useEffect(() => {
    if (label === '' && labelShown.current) { labelShown.current = false; setText(''); setTyped('') }
  }, [label])

  function type(v: string) {
    setText(v)
    if (labelShown.current) { labelShown.current = false; onLabel?.(null) }
    setTyped(v.trim()); setRecent([])
    if (/^\d*$/.test(v)) {
      emitted.current = v; onChange(v); setHits([]); setUnknownPhone(false); setNewName(''); onName?.('')
      // A full phone number: is it a saved customer? If not, offer a name box.
      if (/^0\d{9}$/.test(v)) {
        const my = ++seq.current
        void (async () => {
          try {
            const r = await fetch(`/api/customers/search?phone=${v}`)
            const d = await r.json()
            if (my !== seq.current || !Array.isArray(d)) return
            place(d.length ? 230 : 200)
            if (d.length) setHits(d); else setUnknownPhone(true)
          } catch { /* ignore */ }
        })()
      }
      // Part of an ID or phone number: list saved customers it could be.
      if (v && !/^0\d{9}$/.test(v)) {
        const my = ++seq.current
        setTimeout(async () => {
          if (my !== seq.current) return
          try {
            const r = await fetch(`/api/customers/search?num=${v}`)
            const d = await r.json()
            if (my === seq.current && Array.isArray(d)) {
              place(230)
              setHits(d)
            }
          } catch { /* ignore */ }
        }, 200)
      }
      return
    }
    emitted.current = ''; onChange(''); setUnknownPhone(false)
    const q = v.trim()
    if (q.length < 2) { setHits([]); return }
    const my = ++seq.current
    if (onLabel) fetch(`/api/sales/labels?q=${encodeURIComponent(q)}`).then(r => r.json()).then(d => { if (my === seq.current && Array.isArray(d)) setRecent(d) }).catch(() => {})
    setTimeout(async () => {
      if (my !== seq.current) return
      try {
        const r = await fetch(`/api/customers/search?q=${encodeURIComponent(q)}`)
        const d = await r.json()
        if (my === seq.current && Array.isArray(d)) {
          place(230)
          setHits(d)
        }
      } catch { /* ignore */ }
    }, 250)
  }
  function pickLabel(l: string) {
    labelShown.current = true; emitted.current = ''
    setText(`${l} (label)`); setHits([]); setRecent([]); setTyped('')
    onChange(''); onLabel?.(l)
  }
  function pick(h: Hit) {
    const digits = h.customer_id_code.replace(/\D/g, '')
    emitted.current = digits
    setText(`${h.display_name} (${h.customer_id_code})`)
    onChange(digits); setHits([])
  }

  return (
    <>
      <input ref={inputRef} type="text" value={text} disabled={disabled} placeholder={placeholder} className={className}
        autoComplete="off" onChange={e => type(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') { setHits([]); onEnter?.() } }}
        onBlur={() => setTimeout(() => { setHits([]); setTyped('') }, 150)}
        onClick={e => e.stopPropagation()} />
      {unknownPhone && pos && (
        <div style={{ position: 'fixed', left: pos.left, top: pos.top, bottom: pos.bottom, width: pos.width }}
          className="z-[200] space-y-1 rounded-lg border border-amber-300 bg-white p-2 shadow-lg" onClick={e => e.stopPropagation()}>
          <p className="text-[10px] font-semibold text-amber-800">New number. Type their name and they are saved as a new customer (leave empty to just send):</p>
          <input value={newName} onChange={e => { setNewName(e.target.value); onName?.(e.target.value) }} placeholder="Customer name" autoFocus
            onKeyDown={e => { if (e.key === 'Enter') { setUnknownPhone(false); onEnter?.() } }}
            className="w-full rounded border border-gray-300 px-2 py-1 text-xs text-gray-900 outline-none" />
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => setUnknownPhone(false)} className="text-[10px] font-semibold text-blue-700">Done</button>
            {onRegister && (
              <button type="button" onClick={() => {
                setUnknownPhone(false)
                onRegister(text, code => { const digits = code.replace(/\D/g, ''); emitted.current = digits; setText(digits); onChange(digits); setNewName(''); onName?.('') })
              }} className="text-[10px] font-bold text-green-700">Full registration (location, email, services…)</button>
            )}
          </div>
        </div>
      )}
      {(hits.length > 0 || (!!onLabel && typed.length >= 2 && !/^\d/.test(typed))) && pos && (
        <div style={{ position: 'fixed', left: pos.left, top: pos.top, bottom: pos.bottom, width: pos.width }}
          className="z-[200] max-h-56 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg" onClick={e => e.stopPropagation()}>
          {hits.map(h => (
            <button key={h.id} type="button" onMouseDown={e => e.preventDefault()} onClick={() => pick(h)}
              className="block w-full border-b border-gray-100 px-3 py-2 text-left last:border-0 hover:bg-blue-50">
              <span className="block text-xs font-semibold text-gray-900">{h.display_name}</span>
              <span className="block text-[10px] text-gray-500">{h.customer_id_code}{h.phone ? ` · ${h.phone}` : ''}{h.company_name ? ` · ${h.company_name}` : ''}</span>
            </button>
          ))}
          {onLabel && typed.length >= 2 && (
            <div className="border-t border-gray-200 bg-gray-50">
              {recent.filter(l => l.toLowerCase() !== typed.toLowerCase()).map(l => (
                <button key={l} type="button" onMouseDown={e => e.preventDefault()} onClick={() => pickLabel(l)}
                  className="block w-full px-3 py-1.5 text-left text-xs text-gray-700 hover:bg-blue-50">Label: <b>{l}</b></button>
              ))}
              <button type="button" onMouseDown={e => e.preventDefault()} onClick={() => pickLabel(typed)}
                className="block w-full px-3 py-2 text-left text-xs font-semibold text-gray-800 hover:bg-blue-50">
                Use &ldquo;{typed}&rdquo; as a label <span className="font-normal text-gray-500">(not a customer)</span>
              </button>
            </div>
          )}
        </div>
      )}
    </>
  )
}
