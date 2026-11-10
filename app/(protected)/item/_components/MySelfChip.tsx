'use client'
import { useEffect, useState } from 'react'
import { parseTimeMins } from '@/lib/staffTimes'
import { MyAvatar } from '@/components/StaffAvatar'
import { PenaltyChip } from '@/components/PenaltyChip'

type Row = { staff_name: string; actual_in: string; actual_out: string | null; on_break: boolean; worked_seconds: number }
const fmt = (m: number) => { const x = Math.max(0, Math.round(m)), h = Math.floor(x / 60), r = x % 60; return h && r ? `${h}hr ${r}min` : h ? `${h}hr` : `${r}min` }

// The signed-in person's own staff button, at the top of the left sidebar: photo, status dot, NAME, penalty points, worked/total time.
// (It replaces their chip in the top staff bar on phones.) Tapping it opens their personal page, the same one the top-bar chip opened.
export default function MySelfChip({ name, username, sales = 0 }: { name: string; username?: string; sales?: number }) {
  const key = (username ?? name).toLowerCase()
  const [row, setRow] = useState<Row | null>(null)
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    let live = true
    const load = () => fetch('/api/staff-times/worked-today').then(r => r.ok ? r.json() : null).then(d => { if (live && Array.isArray(d?.staff)) setRow(d.staff.find((s: Row) => s.staff_name.toLowerCase() === key) ?? null) }).catch(() => {})
    void load(); const t = setInterval(load, 10 * 60 * 1000), k = setInterval(() => setNow(new Date()), 30000)
    return () => { live = false; clearInterval(t); clearInterval(k) }
  }, [key])
  const nowMins = now.getUTCHours() * 60 + now.getUTCMinutes()
  const inM = row ? parseTimeMins(row.actual_in) : null
  const outM = row?.actual_out ? parseTimeMins(row.actual_out) : null
  const total = row && inM != null ? (outM != null ? outM - inM : Math.max(0, nowMins - inM)) : null
  const here = !!row && !row.actual_out
  const open = () => { const d = { name: username ?? name, handled: false }; window.dispatchEvent(new CustomEvent('open-staff-member', { detail: d })); if (!d.handled) window.location.href = '/profile' }
  return (
    <button type="button" data-keep-embed onClick={open} title="You are signed in as this person. Tap for your times and tasks."
      className="flex w-full min-w-0 flex-col items-start gap-px rounded-lg bg-white/10 px-1 py-1 text-left hover:bg-white/20">
      <span className="flex w-full min-w-0 items-center gap-1">
        <span className={`shrink-0 rounded-full border-[3px] ${here ? 'border-green-500' : 'border-red-600'}`} title={here ? 'Clocked in' : 'Clocked out'}><MyAvatar size={20} /></span>
        <PenaltyChip />
      </span>
      <span className="w-full truncate text-[10px] font-extrabold leading-tight text-white">{name.charAt(0).toUpperCase() + name.slice(1)}</span>
      <span title="Sales you have recorded today" className="text-[10px] font-extrabold leading-tight text-green-300 tabular-nums">₵{sales.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
      {row && total != null && <span className="text-[8px] leading-tight text-blue-200">{fmt(row.worked_seconds / 60)}/{fmt(total)}</span>}
    </button>
  )
}
