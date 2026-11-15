'use client'
import { useCallback, useEffect, useState } from 'react'
import { usePolling } from '@/lib/usePolling'
import type { HubCtx } from './useHubState'

type Row = { staff_name: string; actual_in: string | null; actual_out: string | null; on_break: boolean }

// Phone only: the slim top bar. Left: whether the signed-in person is clocked in (sales depend on it; tap to open their times).
// Right: search (on every screen) and the bell with what is waiting for them. It reads the same /api/staff-times/worked-today
// list the staff bar uses. Computers have the sidebar and the staff bar instead.
export default function HubStatusStrip({ h }: { h: HubCtx }) {
  const { username, openPersonal, openShop, setGlobalSearchOpen, myDayBadge } = h
  const [row, setRow] = useState<Row | null | undefined>(undefined)
  const load = useCallback(() => {
    fetch('/api/staff-times/worked-today', { cache: 'no-store' })
      .then(r => (r.ok ? r.json() : null))
      .then(d => {
        const list: Row[] = Array.isArray(d?.staff) ? d.staff : []
        setRow(list.find(s => String(s.staff_name ?? '').toLowerCase() === username.toLowerCase()) ?? null)
      })
      .catch(() => {})
  }, [username])
  useEffect(() => { load() }, [load])
  usePolling(load, 300000)
  const state = row === undefined ? 'loading' : !row || !row.actual_in ? 'absent' : row.actual_out ? 'out' : row.on_break ? 'break' : 'in'
  const look = {
    loading: { cls: 'bg-gray-50 text-gray-500 border-gray-200', text: '…' },
    in: { cls: 'bg-green-50 text-green-800 border-green-200', text: `Clocked in${row?.actual_in ? ` at ${row.actual_in}` : ''}` },
    break: { cls: 'bg-amber-50 text-amber-900 border-amber-200', text: 'On break' },
    out: { cls: 'bg-gray-100 text-gray-700 border-gray-200', text: 'Clocked out for today' },
    absent: { cls: 'bg-red-50 text-red-800 border-red-200', text: 'Not clocked in today' },
  }[state]
  const waiting = Number(myDayBadge ?? 0)
  return (
    <div className={`flex w-full items-center gap-0.5 border-b pl-3 pr-1 text-xs sm:hidden ${look.cls}`}>
      <button type="button" onClick={() => openPersonal(username, 'times')} className="flex min-w-0 flex-1 items-center gap-2 py-2.5 text-left font-medium">
        <span className="truncate">{look.text}</span>
        <span className="shrink-0 underline">Times</span>
      </button>
      <button type="button" onClick={() => setGlobalSearchOpen(true)} aria-label="Search" className="flex h-11 w-11 shrink-0 items-center justify-center text-xl">🔍</button>
      <button type="button" onClick={() => openShop('todo')} aria-label={waiting ? `${waiting} waiting for you` : 'Waiting for you'} className="relative flex h-11 w-11 shrink-0 items-center justify-center text-xl">
        🔔
        {waiting > 0 && <span className="absolute right-1 top-1 min-w-[18px] rounded-full bg-red-600 px-1 text-center text-[11px] font-medium leading-[18px] text-white">{waiting > 99 ? '99+' : waiting}</span>}
      </button>
    </div>
  )
}
