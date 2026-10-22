'use client'
import { useEffect, useRef, useState } from 'react'

type Hit = { id: number; customer_id_code: string; display_name: string; company_name: string | null; phone: string | null }

// The GM box. Digits = a customer ID (e.g. 123) or a 10-digit phone number starting
// with 0, passed up as `value` exactly as before. Letters search saved customers by
// name: pick one and the box holds that customer's ID.
export default function CustomerBox({ value, onChange, onName, disabled, placeholder, className, onEnter }: {
  value: string; onChange: (digits: string) => void; onName?: (name: string) => void; disabled?: boolean; placeholder?: string; className?: string; onEnter?: () => void
}) {
  const [text, setText] = useState(value)
  const [hits, setHits] = useState<Hit[]>([])
  const [newName, setNewName] = useState('')
  const [unknownPhone, setUnknownPhone] = useState(false)
  const [pos, setPos] = useState<{ left: number; top: number; width: number } | null>(null)
  const emitted = useRef(value)
  const inputRef = useRef<HTMLInputElement>(null)
  const seq = useRef(0)

  // The parent cleared or replaced the value (e.g. after a sale): follow it.
  useEffect(() => {
    if (value !== emitted.current) { emitted.current = value; setText(value); setHits([]); setUnknownPhone(false); setNewName(''); onName?.('') }
  }, [value])

  function type(v: string) {
    setText(v)
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
            const b = inputRef.current?.getBoundingClientRect()
            if (b) setPos({ left: Math.max(8, Math.min(b.left, window.innerWidth - 248)), top: b.bottom + 2, width: Math.max(b.width, 240) })
            if (d.length) setHits(d); else setUnknownPhone(true)
          } catch { /* ignore */ }
        })()
      }
      return
    }
    emitted.current = ''; onChange(''); setUnknownPhone(false)
    const q = v.trim()
    if (q.length < 2) { setHits([]); return }
    const my = ++seq.current
    setTimeout(async () => {
      if (my !== seq.current) return
      try {
        const r = await fetch(`/api/customers/search?q=${encodeURIComponent(q)}`)
        const d = await r.json()
        if (my === seq.current && Array.isArray(d)) {
          setHits(d)
          const b = inputRef.current?.getBoundingClientRect()
          if (b) setPos({ left: Math.max(8, Math.min(b.left, window.innerWidth - 248)), top: b.bottom + 2, width: Math.max(b.width, 240) })
        }
      } catch { /* ignore */ }
    }, 250)
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
        onBlur={() => setTimeout(() => setHits([]), 150)}
        onClick={e => e.stopPropagation()} />
      {unknownPhone && pos && (
        <div style={{ position: 'fixed', left: pos.left, top: pos.top, width: pos.width }}
          className="z-[200] space-y-1 rounded-lg border border-amber-300 bg-white p-2 shadow-lg" onClick={e => e.stopPropagation()}>
          <p className="text-[10px] font-semibold text-amber-800">New number, not a saved customer. Type their name (optional):</p>
          <input value={newName} onChange={e => { setNewName(e.target.value); onName?.(e.target.value) }} placeholder="Customer name" autoFocus
            onKeyDown={e => { if (e.key === 'Enter') { setUnknownPhone(false); onEnter?.() } }}
            className="w-full rounded border border-gray-300 px-2 py-1 text-xs text-gray-900 outline-none" />
          <button type="button" onClick={() => setUnknownPhone(false)} className="text-[10px] font-semibold text-blue-700">Done</button>
        </div>
      )}
      {hits.length > 0 && pos && (
        <div style={{ position: 'fixed', left: pos.left, top: pos.top, width: pos.width }}
          className="z-[200] max-h-56 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg" onClick={e => e.stopPropagation()}>
          {hits.map(h => (
            <button key={h.id} type="button" onMouseDown={e => e.preventDefault()} onClick={() => pick(h)}
              className="block w-full border-b border-gray-100 px-3 py-2 text-left last:border-0 hover:bg-blue-50">
              <span className="block text-xs font-semibold text-gray-900">{h.display_name}</span>
              <span className="block text-[10px] text-gray-500">{h.customer_id_code}{h.phone ? ` · ${h.phone}` : ''}{h.company_name ? ` · ${h.company_name}` : ''}</span>
            </button>
          ))}
        </div>
      )}
    </>
  )
}
