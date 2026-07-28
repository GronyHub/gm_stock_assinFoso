'use client'
import { useState, useEffect, useRef } from 'react'

const inputCls = 'w-full bg-gray-100 border border-gray-200 rounded-lg px-2.5 py-2 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-blue-400'
const labelCls = 'text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5 block'

// Shared by Customers and Vendors (New + Edit) -- a pick-from-list combobox
// rather than free text, so a location gets picked from what's already in
// use (by either customers or vendors, /api/locations pools both) or added
// as a genuinely new one instead of a free-typed near-duplicate variant.
// "+ Add" is never disabled -- clicking it with nothing typed is a no-op,
// same as tapping empty space, rather than a greyed-out dead end.
export default function LocationField({ value, onChange, label = 'Location (optional)' }: { value: string; onChange: (v: string) => void; label?: string }) {
  const [options, setOptions] = useState<string[]>([])
  const [open, setOpen] = useState(false)
  const boxRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch('/api/locations')
      .then(r => r.json())
      .then(d => setOptions(Array.isArray(d) ? d : []))
      .catch(() => {})
  }, [])

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  const matches = value.trim()
    ? options.filter(l => l.toLowerCase().includes(value.trim().toLowerCase()))
    : options

  function pick(l: string) {
    onChange(l)
    setOpen(false)
  }
  function addNew() {
    const name = value.trim()
    if (!name) return
    setOptions(prev => prev.includes(name) ? prev : [...prev, name].sort())
    onChange(name)
    setOpen(false)
  }

  return (
    <div className="relative" ref={boxRef}>
      <label className={labelCls}>{label}</label>
      <input value={value}
        onChange={e => { onChange(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        placeholder="Search or add a location" className={inputCls} />
      {open && (
        <div className="absolute z-20 left-0 right-0 mt-0.5 bg-white border border-gray-200 rounded-lg shadow-lg max-h-40 overflow-y-auto">
          {/* Always the first option -- picking or adding a location
              shouldn't require guessing whether it's already on the list. */}
          <button type="button" onClick={addNew}
            className="w-full text-left px-2.5 py-2 text-sm font-semibold text-blue-600 hover:bg-blue-50 border-b border-gray-100">
            {value.trim() ? `+ Add "${value.trim()}" as a new location` : '+ Add new location'}
          </button>
          {matches.map(l => (
            <button key={l} type="button" onClick={() => pick(l)}
              className="w-full text-left px-2.5 py-2 text-sm text-gray-800 hover:bg-blue-50 border-b border-gray-100 last:border-0">
              {l}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
