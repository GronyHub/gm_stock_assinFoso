'use client'
import { useState, useRef, useEffect } from 'react'

// Every "create new X" flow scattered across the app, gathered into one
// shortcut menu so starting one doesn't require first navigating to its tab.
export type ShortcutKey = 'sale' | 'bill' | 'item' | 'cabConfirm' | 'staffTime' | 'expense' | 'customer' | 'vendor'

const SHORTCUTS: { key: ShortcutKey; label: string; icon: string }[] = [
  { key: 'sale',       label: 'Sales',       icon: '🧾' },
  { key: 'bill',       label: 'Bills',       icon: '📄' },
  { key: 'item',       label: 'Item',        icon: '📦' },
  { key: 'cabConfirm', label: 'CAB Confirm', icon: '🏦' },
  { key: 'staffTime',  label: 'Staff Time',  icon: '🕒' },
  { key: 'expense',    label: 'Expenses',    icon: '💸' },
  { key: 'customer',   label: 'Customer',    icon: '🧑' },
  { key: 'vendor',     label: 'Vendor',      icon: '🏭' },
]

// This used to be its own floating "+" button (see git history --
// NewShortcutButton, before that the bottom Role Bar's own corner) -- now
// just one more icon in the content area's own bottom row (Biz/UK/C&H/
// Search, see item/page.tsx), matching that row's small-circle style and
// opening its menu upward from the same spot instead of floating on its own.
export default function AddShortcutButton({ onShortcut }: { onShortcut: (key: ShortcutKey) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div ref={ref} className="relative">
      {open && (
        <div className="absolute bottom-full right-0 mb-2 bg-white border border-gray-200 rounded-xl shadow-xl min-w-[180px] overflow-hidden z-10">
          {SHORTCUTS.map(s => (
            <button key={s.key} onClick={() => { setOpen(false); onShortcut(s.key) }}
              className="w-full text-left flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 border-t border-gray-100 first:border-t-0 transition">
              <span>{s.icon}</span>{s.label}
            </button>
          ))}
        </div>
      )}
      <button onClick={() => setOpen(o => !o)} title="New…" aria-label="New…"
        className={`w-9 h-9 rounded-full flex items-center justify-center text-lg font-bold border-2 transition
          ${open ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 opacity-70 hover:opacity-100'}`}>
        +
      </button>
    </div>
  )
}
