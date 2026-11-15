'use client'
import { useCallback, useEffect, useState } from 'react'
import { usePolling } from '@/lib/usePolling'
import type { HubCtx } from './useHubState'

type Row = { staff_name: string; actual_in: string | null; actual_out: string | null; on_break: boolean }

// Phone only: one slim line under the header that always says whether the signed-in person is clocked in, because sales
// depend on it. Tap it to open their times. It reads the same /api/staff-times/worked-today list the staff bar uses.
export default function HubStatusStrip({ h }: { h: HubCtx }) {
  const { username, openPersonal } = h
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
  if (row === undefined) return null
  const state = !row || !row.actual_in ? 'absent' : row.actual_out ? 'out' : row.on_break ? 'break' : 'in'
  const look = {
    in: { cls: 'bg-green-50 text-green-800 border-green-200', text: `Clocked in${row?.actual_in ? ` at ${row.actual_in}` : ''}` },
    break: { cls: 'bg-amber-50 text-amber-900 border-amber-200', text: 'On break' },
    out: { cls: 'bg-gray-100 text-gray-700 border-gray-200', text: 'Clocked out for today' },
    absent: { cls: 'bg-red-50 text-red-800 border-red-200', text: 'Not clocked in today' },
  }[state]
  return (
    <button type="button" onClick={() => openPersonal(username, 'times')}
      className={`flex w-full items-center justify-between gap-2 border-b px-3 py-1 text-left text-xs font-semibold sm:hidden ${look.cls}`}>
      <span className="truncate">{look.text}</span>
      <span className="shrink-0 underline">Times</span>
    </button>
  )
}
