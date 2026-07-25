'use client'
import { useState, useEffect, useRef } from 'react'
import { usePolling } from '@/lib/usePolling'

export type RoleKey = 'joe' | 'opener' | 'closer'

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

type Props = {
  openRole: RoleKey | null
  onSelectRole: (key: RoleKey) => void
  onShortcut: (key: ShortcutKey) => void
  cashCount: number
  dailyCount: number
  missingClosingReportsCount: number
  trailing?: React.ReactNode
}

// Persistent bottom bar -- one tab per role player (Joe/cash -- which now
// also carries the former Bino/manage flags, today's Opener, today's Closer)
// with a red badge for outstanding issues. Behaves like the top-level tabs:
// the active one gets the same blue highlight, and the bar itself never gets
// hidden -- its panel (RolePanel) replaces the content area above it instead
// of covering the bar in a modal.
export default function RoleBar({ openRole, onSelectRole, onShortcut, cashCount, dailyCount, missingClosingReportsCount, trailing }: Props) {
  const [today, setToday] = useState<{ opener: string | null; openerConfirmed: boolean | null }>({ opener: null, openerConfirmed: null })
  const [shortcutOpen, setShortcutOpen] = useState(false)
  const shortcutRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (shortcutRef.current && !shortcutRef.current.contains(e.target as Node)) setShortcutOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  function load() {
    fetch('/api/staff-times/today')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setToday({ opener: d.opener ?? null, openerConfirmed: d.openerConfirmed ?? null }) })
      .catch(() => {})
  }
  useEffect(() => { load() }, [])
  usePolling(load, 30000)

  // The morning stock count is the opener's job -- its outstanding count
  // rides on this badge alongside the separate "hasn't confirmed clock-in
  // yet" flag, same as Joe/Bino/Closer's badges sum up everything on their
  // own panel.
  const openerCount = (today.opener && !today.openerConfirmed ? 1 : 0) + dailyCount
  const closerCount = missingClosingReportsCount

  const TABS: { key: RoleKey; label: string; count: number }[] = [
    { key: 'joe', label: 'Joe', count: cashCount },
    { key: 'opener', label: 'Opener', count: openerCount },
    { key: 'closer', label: 'Closer', count: closerCount },
  ]

  return (
    <div className="shrink-0 sticky bottom-0 z-30 flex items-stretch divide-x divide-gray-200 bg-white border-t border-gray-200">
      {/* "+" shortcut menu -- every "create new X" flow in the app, one tap
          away instead of first navigating to that flow's own tab. */}
      <div className="relative shrink-0" ref={shortcutRef}>
        {shortcutOpen && (
          <div className="absolute bottom-full left-0 mb-1 bg-white border border-gray-200 rounded-xl shadow-xl min-w-[180px] overflow-hidden z-10">
            {SHORTCUTS.map(s => (
              <button key={s.key} onClick={() => { setShortcutOpen(false); onShortcut(s.key) }}
                className="w-full text-left flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 border-t border-gray-100 first:border-t-0 transition">
                <span>{s.icon}</span>{s.label}
              </button>
            ))}
          </div>
        )}
        <button onClick={() => setShortcutOpen(o => !o)} title="New…"
          className={`flex items-center justify-center px-4 py-4 text-2xl font-bold transition
            ${shortcutOpen ? 'bg-blue-600 text-white' : 'text-gray-500 hover:bg-gray-50'}`}>
          +
        </button>
      </div>
      {TABS.map(t => {
        const active = openRole === t.key
        return (
          <button key={t.key} onClick={() => onSelectRole(t.key)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-4 text-sm font-bold transition
              ${active ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-gray-50'}`}>
            {t.label}
            {t.count > 0 && (
              <span className={`text-[11px] font-bold rounded-full px-1.5 leading-tight ${active ? 'bg-white/25 text-white' : 'bg-red-600 text-white'}`}>
                {t.count > 99 ? '99+' : t.count}
              </span>
            )}
          </button>
        )
      })}
      {trailing}
    </div>
  )
}
