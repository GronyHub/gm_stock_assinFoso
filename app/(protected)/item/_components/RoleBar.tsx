'use client'
import { useState, useEffect } from 'react'
import { usePolling } from '@/lib/usePolling'

export type RoleKey = 'joe' | 'bino' | 'opener' | 'closer'

type Props = {
  openRole: RoleKey | null
  onSelectRole: (key: RoleKey) => void
  cashCount: number
  manageCount: number
  missingClosingReportsCount: number
  trailing?: React.ReactNode
}

// Persistent bottom bar -- one tab per role player (Joe/cash, Bino/manage,
// today's Opener, today's Closer) with a red badge for outstanding issues.
// Behaves like the top-level tabs: the active one gets the same blue
// highlight, and the bar itself never gets hidden -- its panel (RolePanel)
// replaces the content area above it instead of covering the bar in a modal.
export default function RoleBar({ openRole, onSelectRole, cashCount, manageCount, missingClosingReportsCount, trailing }: Props) {
  const [today, setToday] = useState<{ opener: string | null; openerConfirmed: boolean | null }>({ opener: null, openerConfirmed: null })

  function load() {
    fetch('/api/staff-times/today')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setToday({ opener: d.opener ?? null, openerConfirmed: d.openerConfirmed ?? null }) })
      .catch(() => {})
  }
  useEffect(() => { load() }, [])
  usePolling(load, 30000)

  const openerCount = today.opener && !today.openerConfirmed ? 1 : 0
  const closerCount = missingClosingReportsCount

  const TABS: { key: RoleKey; label: string; count: number }[] = [
    { key: 'joe', label: 'Joe', count: cashCount },
    { key: 'bino', label: 'Bino', count: manageCount },
    { key: 'opener', label: 'Opener', count: openerCount },
    { key: 'closer', label: 'Closer', count: closerCount },
  ]

  return (
    <div className="shrink-0 sticky bottom-0 z-30 flex items-stretch bg-white border-t border-gray-200">
      {TABS.map(t => {
        const active = openRole === t.key
        return (
          <button key={t.key} onClick={() => onSelectRole(t.key)}
            className={`flex-1 flex items-center justify-center gap-1 py-2.5 text-xs font-bold transition
              ${active ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-gray-50'}`}>
            {t.label}
            {t.count > 0 && (
              <span className={`text-[10px] font-bold rounded-full px-1.5 leading-tight ${active ? 'bg-white/25 text-white' : 'bg-red-600 text-white'}`}>
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
