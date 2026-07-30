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

// Floating action button, bottom-left -- mirrors the Home button's own
// floating circle on the bottom-right. Used to live inside the Role Bar
// (the bottom strip with Tasks/Opener/Closer), but that bar is gone now
// that all three moved into their own top-level tab's left pane -- this is
// the one thing in it worth keeping as its own control.
export default function NewShortcutButton({ onShortcut }: { onShortcut: (key: ShortcutKey) => void }) {
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
    // bottom-36, not bottom-20 -- the pre-existing Daily shortcut already
    // sits at bottom-20 left-4, so this stacks directly above it instead of
    // the two colliding on top of each other.
    <div ref={ref} className="fixed bottom-36 left-4 z-40">
      {open && (
        <div className="absolute bottom-full left-0 mb-1 bg-white border border-gray-200 rounded-xl shadow-xl min-w-[180px] overflow-hidden">
          {SHORTCUTS.map(s => (
            <button key={s.key} onClick={() => { setOpen(false); onShortcut(s.key) }}
              className="w-full text-left flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 border-t border-gray-100 first:border-t-0 transition">
              <span>{s.icon}</span>{s.label}
            </button>
          ))}
        </div>
      )}
      <button onClick={() => setOpen(o => !o)} aria-label="New…" title="New…"
        className={`w-12 h-12 rounded-full shadow-lg flex items-center justify-center text-2xl font-bold transition
          ${open ? 'bg-blue-600 text-white' : 'bg-white text-gray-500 border border-gray-200 hover:bg-gray-50'}`}>
        +
      </button>
    </div>
  )
}
