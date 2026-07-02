'use client'
import { useState, useEffect, useMemo, Fragment, Suspense, useCallback } from 'react'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { fmtDate } from '@/lib/fmtDate'
import { usePolling } from '@/lib/usePolling'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell,
} from 'recharts'

const STAFF = ['joe', 'bino', 'james', 'rawlings']

function nowAsHHMM() {
  const d = new Date()
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function hhmmTo12h(hhmm: string): string {
  const [hStr, mStr] = hhmm.split(':')
  let h = parseInt(hStr, 10)
  const m = mStr
  const suffix = h >= 12 ? 'pm' : 'am'
  if (h === 0) h = 12
  else if (h > 12) h -= 12
  return `${h}:${m}${suffix}`
}

function nowAs12h(): string {
  return hhmmTo12h(nowAsHHMM())
}

const SHORT_MON = ['Ja','Fe','Mr','Ap','My','Ju','Jl','Au','Se','Oc','No','De']
const SHORT_DAY = ['Su','Mo','Tu','We','Th','Fr','Sa']
function fmtShortDate(raw: string): string {
  const d = new Date(raw.length === 10 ? raw + 'T00:00:00' : raw)
  if (isNaN(d.getTime())) return raw
  const yr = String(d.getFullYear()).slice(-2)
  return `${d.getDate()} ${SHORT_MON[d.getMonth()]} ${yr}-${SHORT_DAY[d.getDay()]}`
}

const FULL_MON = ['January','February','March','April','May','June','July','August','September','October','November','December']
function monthKeyLabel(monthKey: string): string {
  const [y, m] = monthKey.split('-').map(Number)
  return `${FULL_MON[m - 1]} ${y}`
}

function monthKeyShort(monthKey: string): string {
  const [y, m] = monthKey.split('-').map(Number)
  return `${SHORT_MON[m - 1]} ${String(y).slice(-2)}`
}

function monthsBetween(from: string, to: string): number {
  const a = new Date(from + 'T00:00:00'), b = new Date(to + 'T00:00:00')
  return Math.max(0, (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth()))
}

const STAFF_CHART_COLORS: Record<string, string> = {
  joe: '#3b82f6', bino: '#a855f7', james: '#22c55e', rawlings: '#f97316',
}

function to12hToHHMM(t: string | null | undefined): string {
  if (!t) return ''
  const m = t.trim().match(/^(\d{1,2}):(\d{2})(am|pm)$/i)
  if (!m) return ''
  let h = parseInt(m[1], 10)
  const min = m[2]
  const suffix = m[3].toLowerCase()
  if (suffix === 'pm' && h !== 12) h += 12
  if (suffix === 'am' && h === 12) h = 0
  return `${String(h).padStart(2, '0')}:${min}`
}

const inputCls = 'w-full bg-gray-100 border border-gray-200 rounded-xl px-3 py-2.5 text-base text-gray-900 placeholder-gray-400 outline-none focus:ring-2 focus:ring-blue-400'
const labelCls = 'text-xs text-gray-400 font-medium mb-1 block'

const STAFF_COLORS: Record<string, string> = {
  Joe: 'bg-blue-100 text-blue-700',
  Bino: 'bg-purple-100 text-purple-700',
  James: 'bg-green-100 text-green-700',
  Rawlings: 'bg-orange-100 text-orange-700',
}

const SEVERITY_COLORS: Record<string, string> = {
  minor: 'bg-yellow-100 text-yellow-700',
  moderate: 'bg-orange-100 text-orange-700',
  serious: 'bg-red-100 text-red-600',
}

const TABS = ['Times', 'Payslips', 'Violations', 'Role', 'Rota', 'Analytics', 'Assignments'] as const
type Tab = (typeof TABS)[number]

const TAB_ICONS: Record<Tab, React.ReactNode> = {
  Times: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
    </svg>
  ),
  Payslips: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <rect x="3" y="4" width="18" height="16" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="8" y1="14" x2="16" y2="14"/><line x1="8" y1="17" x2="13" y2="17"/>
    </svg>
  ),
  Violations: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
    </svg>
  ),
  Role: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
    </svg>
  ),
  Rota: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
    </svg>
  ),
  Analytics: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
    </svg>
  ),
  Assignments: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
    </svg>
  ),
}

function Badge({ n }: { n: number }) {
  if (!n) return null
  return <span className="ml-1 bg-red-100 text-red-600 text-[10px] font-bold px-1.5 py-0.5 rounded-full">{n}</span>
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseTimeMins(t: string | null) {
  if (!t) return null
  const m = t.match(/^(\d+):(\d+)(am|pm)$/i)
  if (!m) return null
  let h = parseInt(m[1]), min = parseInt(m[2])
  const ap = m[3].toLowerCase()
  if (ap === 'pm' && h !== 12) h += 12
  if (ap === 'am' && h === 12) h = 0
  return h * 60 + min
}
function minsTo12h(mins: number) {
  let h = Math.floor(mins / 60) % 24, m = Math.round(mins % 60)
  const ap = h >= 12 ? 'pm' : 'am'
  h = h % 12 || 12
  return `${h}:${String(m).padStart(2, '0')}${ap}`
}
function minsToHrs(mins: number) {
  return `${Math.floor(mins / 60)}h ${Math.round(mins % 60)}m`
}

// ── Types ─────────────────────────────────────────────────────────────────────

type RecentRow = { id?: number; staff_name: string; work_date: string; actual_in: string | null; actual_out: string | null; entered_by: string | null }
type TodayRow = { staff_name: string; actual_in: string | null; actual_out: string | null }
type Mine = { actual_in: string | null; actual_out: string | null } | null

type Payslip = {
  id: number; staff_name: string; pay_month: string; payment_period: string | null
  hours_worked: string | null; pay_for_hours: string | null; overtime_hours: string | null
  pay_for_overtime: string | null; longevity_days: string | null; pay_for_longevity: string | null
  duty_allowance: string | null; data_allowance: string | null; ssnit: string | null
  childcare_allowance: string | null; total_salary: string | null
}

type Violation = {
  id: number; staff_name: string; violation: string; details: string | null
  severity: string; points: number; recorded_by: string | null; created_at: string
}

type AppUser = { id: number; username: string; display_name: string; email: string | null; role: string }

// ── TIMES TAB ─────────────────────────────────────────────────────────────────

function groupByDate(rows: RecentRow[]) {
  const map = new Map<string, Record<string, { in: string | null; out: string | null }>>()
  for (const r of rows) {
    if (!map.has(r.work_date)) map.set(r.work_date, {})
    map.get(r.work_date)![r.staff_name] = { in: r.actual_in, out: r.actual_out }
  }
  return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]))
}

function TimesTab({ username, role }: { username: string; role: string }) {
  const isAdmin = role === 'owner' || role === 'admin' || username === 'rawlings' || username === 'grony' || username === 'joe'

  const [today, setToday] = useState<TodayRow[]>([])
  const [mine, setMine] = useState<Mine>(null)
  const [recent, setRecent] = useState<RecentRow[]>([])
  const [allRecords, setAllRecords] = useState<RecentRow[]>([])
  const [loading, setLoading] = useState(true)
  const [pickingTime, setPickingTime] = useState(false)
  const [customTime, setCustomTime] = useState(nowAsHHMM())
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  const [editDate, setEditDate] = useState<string | null>(null)
  const [editIn, setEditIn] = useState('')
  const [editOut, setEditOut] = useState('')
  const [savingEdit, setSavingEdit] = useState(false)

  // Admin edit/add/delete state
  const [adminEditRow, setAdminEditRow] = useState<RecentRow | null>(null)
  const [adminEditIn, setAdminEditIn] = useState('')
  const [adminEditOut, setAdminEditOut] = useState('')
  const [adminEditSaving, setAdminEditSaving] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)
  const [addStaff, setAddStaff] = useState(STAFF[0])
  const [addDate, setAddDate] = useState('')
  const [addIn, setAddIn] = useState('')
  const [addOut, setAddOut] = useState('')
  const [addSaving, setAddSaving] = useState(false)
  const [addErr, setAddErr] = useState('')

  function load() {
    const p1 = fetch('/api/staff-times/today').then(r => r.ok ? r.json() : { today: [], mine: null, recent: [] })
    const p2 = isAdmin ? fetch('/api/staff-times/all').then(r => r.ok ? r.json() : []) : Promise.resolve([])
    Promise.all([p1, p2]).then(([d, all]) => {
      setToday(Array.isArray(d.today) ? d.today : [])
      setMine(d.mine ?? null)
      setRecent(Array.isArray(d.recent) ? d.recent : [])
      if (isAdmin) setAllRecords(Array.isArray(all) ? all : [])
      setLoading(false)
    }).catch(() => setLoading(false))
  }

  useEffect(() => { load() }, [])
  usePolling(load, 5000, !pickingTime && editDate === null)

  async function adminSaveEdit() {
    if (!adminEditRow?.id) return
    setAdminEditSaving(true)
    const res = await fetch(`/api/staff-times/entry-id/${adminEditRow.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ actual_in: adminEditIn || null, actual_out: adminEditOut || null }),
    })
    setAdminEditSaving(false)
    if (res.ok) {
      const updated = await res.json()
      setAllRecords(prev => prev.map(r => r.id === updated.id ? { ...r, ...updated } : r))
      setAdminEditRow(null)
    }
  }

  async function adminDelete(row: RecentRow) {
    if (!row.id || !confirm(`Delete time entry for ${row.staff_name} on ${row.work_date}?`)) return
    await fetch(`/api/staff-times/entry-id/${row.id}`, { method: 'DELETE' })
    setAllRecords(prev => prev.filter(r => r.id !== row.id))
  }

  async function adminAdd() {
    if (!addDate || !addIn) { setAddErr('Date and Time In are required'); return }
    setAddSaving(true); setAddErr('')
    const res = await fetch('/api/staff-times/entry', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ staff_name: addStaff, work_date: addDate, actual_in: addIn, actual_out: addOut || null }),
    })
    setAddSaving(false)
    if (res.ok) { setShowAddForm(false); setAddIn(''); setAddOut(''); setAddDate(''); load() }
    else { const d = await res.json(); setAddErr(d.error ?? 'Failed to save') }
  }

  function getLocation(): Promise<GeolocationPosition> {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Your browser does not support location services.'))
        return
      }
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true, timeout: 15000, maximumAge: 0,
      })
    })
  }

  async function clock(action: 'in' | 'out') {
    const time = pickingTime ? hhmmTo12h(customTime) : nowAs12h()
    setErr('')
    setSaving(true)

    let latitude: number | null = null, longitude: number | null = null
    try {
      const pos = await getLocation()
      latitude = pos.coords.latitude
      longitude = pos.coords.longitude
    } catch (e: any) {
      setSaving(false)
      if (e?.code === 1) setErr('Location access was denied. Please enable location services for this site and try again.')
      else setErr(e?.message || 'Could not get your location. Make sure GPS is turned on and try again.')
      return
    }

    const res = await fetch('/api/staff-times/today', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, time, latitude, longitude }),
    })
    setSaving(false)
    if (res.ok) {
      const updated = await res.json()
      setMine(updated)
      setPickingTime(false)
      setCustomTime(nowAsHHMM())
      load()
    } else {
      const d = await res.json().catch(() => ({}))
      setErr(d.error || 'Failed to save')
    }
  }

  const grouped = groupByDate(recent)

  function monthMinutesFor(staffName: string, monthKey: string): number {
    const rows = recent.filter(r => r.staff_name === staffName && r.work_date.startsWith(monthKey) && r.actual_in && r.actual_out)
    return rows.reduce((sum, r) => {
      const i = parseTimeMins(r.actual_in), o = parseTimeMins(r.actual_out)
      if (i == null || o == null) return sum
      return sum + (o >= i ? o - i : (o + 1440) - i)
    }, 0)
  }

  function openEdit(date: string, map: Record<string, { in: string | null; out: string | null }>) {
    setEditDate(date)
    setEditIn(to12hToHHMM(map[username]?.in))
    setEditOut(to12hToHHMM(map[username]?.out))
  }

  async function saveEdit() {
    if (!editDate || !editIn) return
    setSavingEdit(true)
    await fetch('/api/staff-times/entry', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        staff_name: username, work_date: editDate,
        actual_in: hhmmTo12h(editIn),
        actual_out: editOut ? hhmmTo12h(editOut) : null,
      }),
    })
    setSavingEdit(false)
    setEditDate(null)
    load()
  }

  if (loading) return <div className="py-10 text-center text-gray-400">Loading…</div>

  return (
    <div className="space-y-4">
      {isAdmin && (
        <div className="flex justify-end">
          <button onClick={() => setShowAddForm(v => !v)}
            className="text-sm font-bold px-3 py-1.5 rounded-xl bg-blue-600 text-white hover:bg-blue-500 transition">
            {showAddForm ? 'Cancel' : '+ Add Entry'}
          </button>
        </div>
      )}

      {showAddForm && isAdmin && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3">
          <p className="text-sm font-semibold text-blue-700">New Time Entry</p>
          {addErr && <p className="text-xs text-red-500">{addErr}</p>}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={labelCls}>Staff</label>
              <select value={addStaff} onChange={e => setAddStaff(e.target.value)} className={inputCls}>
                {STAFF.map(s => <option key={s} value={s} className="capitalize">{s.charAt(0).toUpperCase()+s.slice(1)}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Date</label>
              <input type="date" value={addDate} onChange={e => setAddDate(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Time In (e.g. 8:30am)</label>
              <input placeholder="8:30am" value={addIn} onChange={e => setAddIn(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Time Out (optional)</label>
              <input placeholder="5:00pm" value={addOut} onChange={e => setAddOut(e.target.value)} className={inputCls} />
            </div>
          </div>
          <button onClick={adminAdd} disabled={addSaving}
            className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-sm font-semibold rounded-xl py-2.5 transition">
            {addSaving ? 'Saving…' : 'Save Entry'}
          </button>
        </div>
      )}
      {/* Clock In/Out panel */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
        <p className="text-sm font-semibold text-gray-700">My Time Today</p>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="bg-green-50 rounded-lg px-3 py-2">
            <span className="text-xs text-gray-400 block">Time In</span>
            <span className="font-semibold text-green-700">{mine?.actual_in ?? '—'}</span>
          </div>
          <div className="bg-orange-50 rounded-lg px-3 py-2">
            <span className="text-xs text-gray-400 block">Time Out</span>
            <span className="font-semibold text-orange-600">{mine?.actual_out ?? '—'}</span>
          </div>
        </div>

        {!pickingTime ? (
          <button onClick={() => setPickingTime(true)}
            className="w-full text-center text-xs text-blue-600 font-medium py-1">
            Not now? Tap to pick a different time →
          </button>
        ) : (
          <div className="space-y-1.5">
            <label className={labelCls}>Time to record</label>
            <div className="flex items-center gap-2">
              <input type="time" value={customTime} onChange={e => setCustomTime(e.target.value)}
                className={inputCls + ' flex-1'} />
              <button onClick={() => setPickingTime(false)}
                className="shrink-0 text-xs text-gray-400 font-medium px-2 py-2.5">
                Use now
              </button>
            </div>
          </div>
        )}

        {err && <p className="text-xs text-red-500">{err}</p>}
        <div className="flex gap-2">
          <button onClick={() => clock('in')} disabled={saving}
            className="flex-1 bg-green-600 hover:bg-green-500 disabled:opacity-40 text-white text-sm font-semibold rounded-xl py-2.5 transition">
            {saving ? '…' : `Clock In${pickingTime ? '' : ' (Now)'}`}
          </button>
          <button onClick={() => clock('out')} disabled={saving}
            className="flex-1 bg-orange-500 hover:bg-orange-400 disabled:opacity-40 text-white text-sm font-semibold rounded-xl py-2.5 transition">
            {saving ? '…' : `Clock Out${pickingTime ? '' : ' (Now)'}`}
          </button>
        </div>
        <p className="text-[11px] text-gray-400 text-center">📍 Location must be enabled — you must be at the shop to clock in/out.</p>
      </div>

      {/* Today's times for all staff */}
      {today.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-200">
            <span className="text-xs font-semibold text-gray-600">Today — All Staff</span>
          </div>
          <div className="divide-y divide-gray-100">
            {today.map(r => (
              <div key={r.staff_name} className="flex items-center justify-between px-4 py-2 text-sm">
                <span className="font-medium text-gray-800 capitalize">{r.staff_name}</span>
                <span className="text-green-700">{r.actual_in ?? '—'}</span>
                <span className="text-orange-600">{r.actual_out ?? '—'}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* All records — grouped by date, one row per day, month total bar */}
      {isAdmin ? (() => {
        const adminGrouped = groupByDate(allRecords)
        return (
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <table className="w-full text-[11px] table-fixed">
              <colgroup>
                <col style={{width:'22%'}} />
                {STAFF.map(s => <col key={s} />)}
              </colgroup>
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-1.5 py-2 text-gray-500 font-semibold">Date</th>
                  {STAFF.map(s => (
                    <th key={s} className="text-center px-0.5 py-2 text-gray-500 font-semibold capitalize">{s}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {adminGrouped.length === 0 && (
                  <tr><td colSpan={STAFF.length + 1} className="py-8 text-center text-gray-400">No records yet.</td></tr>
                )}
                {adminGrouped.map(([date, map], i) => {
                  const monthKey = date.slice(0, 7)
                  const prevMonthKey = adminGrouped[i - 1]?.[0]?.slice(0, 7)
                  const isMonthStart = prevMonthKey !== monthKey
                  return (
                    <Fragment key={date}>
                      {isMonthStart && (
                        <tr className="bg-gray-100 border-t-2 border-b-2 border-gray-300">
                          <td className="px-1.5 py-2 text-[10px] font-bold text-gray-600 leading-tight">{monthKeyLabel(monthKey)}<br/>Total</td>
                          {STAFF.map(s => {
                            const mins = allRecords
                              .filter(r => r.staff_name === s && r.work_date.startsWith(monthKey) && r.actual_in && r.actual_out)
                              .reduce((sum, r) => {
                                const tin = parseTimeMins(r.actual_in), tout = parseTimeMins(r.actual_out)
                                if (tin == null || tout == null) return sum
                                return sum + (tout >= tin ? tout - tin : (tout + 1440) - tin)
                              }, 0)
                            return (
                              <td key={s} className="text-center px-0.5 py-2 text-[10px] font-bold text-gray-700">
                                {mins ? minsToHrs(mins) : '—'}
                              </td>
                            )
                          })}
                        </tr>
                      )}
                      <tr className="hover:bg-gray-50">
                        <td className="px-1.5 py-1.5 text-gray-600 leading-tight">{fmtShortDate(date)}</td>
                        {STAFF.map(s => {
                          const record = allRecords.find(r => r.staff_name === s && r.work_date === date)
                          const cellData = map[s]
                          const isEditing = adminEditRow?.id === record?.id
                          return (
                            <td key={s} className="px-0.5 py-1 text-center">
                              {isEditing ? (
                                <div className="flex flex-col gap-0.5">
                                  <input value={adminEditIn} onChange={e => setAdminEditIn(e.target.value)}
                                    placeholder="in"
                                    className="w-full text-[9px] border border-blue-300 rounded px-1 py-0.5 text-center outline-none" />
                                  <input value={adminEditOut} onChange={e => setAdminEditOut(e.target.value)}
                                    placeholder="out"
                                    className="w-full text-[9px] border border-blue-300 rounded px-1 py-0.5 text-center outline-none" />
                                  <div className="flex gap-0.5">
                                    <button onClick={adminSaveEdit} disabled={adminEditSaving}
                                      className="flex-1 text-[8px] font-bold bg-green-600 text-white rounded py-0.5 disabled:opacity-40">
                                      {adminEditSaving ? '…' : '✓'}
                                    </button>
                                    <button onClick={() => record && adminDelete(record)} title="Delete"
                                      className="text-[8px] font-bold bg-red-50 text-red-500 rounded py-0.5 px-1">✕</button>
                                    <button onClick={() => setAdminEditRow(null)}
                                      className="flex-1 text-[8px] font-bold bg-gray-100 text-gray-600 rounded py-0.5">—</button>
                                  </div>
                                </div>
                              ) : record ? (
                                <button
                                  onClick={() => { setAdminEditRow(record); setAdminEditIn(record.actual_in ?? ''); setAdminEditOut(record.actual_out ?? '') }}
                                  className="w-full rounded-lg hover:bg-blue-50 py-0.5 transition">
                                  <div className="flex flex-col items-center leading-tight">
                                    <span className="text-green-700">{cellData?.in ?? <span className="text-gray-300">—</span>}</span>
                                    <span className="text-orange-600">{cellData?.out ?? <span className="text-gray-300">—</span>}</span>
                                  </div>
                                </button>
                              ) : (
                                <span className="text-gray-200">—</span>
                              )}
                            </td>
                          )
                        })}
                      </tr>
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        )
      })() : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full text-[11px] table-fixed">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th rowSpan={2} className="text-left px-1.5 py-1 text-gray-500 font-semibold align-bottom">Date</th>
                {STAFF.map(s => (
                  <th key={s} colSpan={2} className="text-center px-0.5 py-1 text-gray-500 font-semibold capitalize border-l border-gray-200">{s}</th>
                ))}
              </tr>
              <tr>
                {STAFF.map(s => (
                  <Fragment key={s}>
                    <th className="text-center px-0.5 py-0.5 text-green-600 font-medium border-l border-gray-200">In</th>
                    <th className="text-center px-0.5 py-0.5 text-orange-500 font-medium">Out</th>
                  </Fragment>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {grouped.map(([date, map], i) => {
                const monthKey = date.slice(0, 7)
                const prevMonthKey = grouped[i - 1]?.[0]?.slice(0, 7)
                const isMonthStart = prevMonthKey !== monthKey
                return (
                  <Fragment key={date}>
                    {isMonthStart && (
                      <tr className="bg-gray-100 border-t-2 border-b-2 border-gray-300">
                        <td className="px-1.5 py-2 text-[9px] font-bold text-gray-600 leading-tight">{monthKeyLabel(monthKey)}<br/>Total</td>
                        {STAFF.map(s => {
                          const mins = monthMinutesFor(s, monthKey)
                          return (
                            <td key={s} colSpan={2} className="text-center px-0.5 py-2 text-[9px] font-bold text-gray-700 border-l border-gray-200">
                              {mins ? minsToHrs(mins) : '—'}
                            </td>
                          )
                        })}
                      </tr>
                    )}
                    <tr className="hover:bg-gray-50">
                      <td className="px-1.5 py-1 text-gray-600 leading-tight whitespace-nowrap">{fmtShortDate(date)}</td>
                      {STAFF.map(s => {
                        const isMine = s === username
                        const cellIn = map[s]?.in ?? <span className="text-gray-200">—</span>
                        const cellOut = map[s]?.out ?? <span className="text-gray-200">—</span>
                        if (isMine) {
                          return (
                            <Fragment key={s}>
                              <td className="px-0.5 py-0.5 border-l border-gray-200">
                                <button onClick={() => openEdit(date, map)}
                                  className="w-full text-center text-green-700 rounded hover:bg-blue-50 py-0.5 transition">{cellIn}</button>
                              </td>
                              <td className="px-0.5 py-0.5">
                                <button onClick={() => openEdit(date, map)}
                                  className="w-full text-center text-orange-600 rounded hover:bg-blue-50 py-0.5 transition">{cellOut}</button>
                              </td>
                            </Fragment>
                          )
                        }
                        return (
                          <Fragment key={s}>
                            <td className="px-0.5 py-0.5 text-center text-green-700 border-l border-gray-200">{cellIn}</td>
                            <td className="px-0.5 py-0.5 text-center text-orange-600">{cellOut}</td>
                          </Fragment>
                        )
                      })}
                    </tr>
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Edit my time modal */}
      {editDate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={() => setEditDate(null)}>
          <div className="bg-white rounded-2xl p-5 w-full max-w-sm space-y-3 shadow-xl" onClick={e => e.stopPropagation()}>
            <p className="font-bold text-gray-900">Edit my time — {fmtDate(editDate)}</p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className={labelCls}>Time In</label>
                <input type="time" value={editIn} onChange={e => setEditIn(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Time Out</label>
                <input type="time" value={editOut} onChange={e => setEditOut(e.target.value)} className={inputCls} />
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={saveEdit} disabled={!editIn || savingEdit}
                className="flex-1 bg-green-600 disabled:opacity-40 text-white text-sm font-semibold rounded-xl py-2.5">
                {savingEdit ? 'Saving…' : 'Save'}
              </button>
              <button onClick={() => setEditDate(null)} className="px-4 py-2.5 bg-gray-100 text-gray-600 text-sm font-semibold rounded-xl">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Analytics */}
      <p className="text-sm font-semibold text-gray-700">Analytics</p>
      <div className="space-y-3">
        {STAFF.map(name => {
          const rows = recent.filter(r => r.staff_name === name)
          const fullDays = rows.filter(r => r.actual_in && r.actual_out)
          const durations = fullDays.map(r => {
            const i = parseTimeMins(r.actual_in), o = parseTimeMins(r.actual_out)
            if (i == null || o == null) return null
            return o >= i ? o - i : (o + 1440) - i
          }).filter((v): v is number => v !== null)
          const totalMins = durations.reduce((a, b) => a + b, 0)
          const avgMins = durations.length ? totalMins / durations.length : null
          const allInMins = rows.map(r => parseTimeMins(r.actual_in)).filter((v): v is number => v !== null)
          const avgIn = allInMins.length ? allInMins.reduce((a, b) => a + b, 0) / allInMins.length : null

          return (
            <div key={name} className="bg-white border border-gray-200 rounded-xl p-3">
              <p className="font-bold text-gray-900 capitalize text-sm mb-2">{name}</p>
              <div className="grid grid-cols-4 gap-3 text-xs">
                <div><p className="text-gray-400">Days Present</p><p className="font-semibold">{rows.filter(r => r.actual_in).length}</p></div>
                <div><p className="text-gray-400">Total Hours</p><p className="font-semibold">{totalMins ? minsToHrs(totalMins) : '—'}</p></div>
                <div><p className="text-gray-400">Avg/Day</p><p className="font-semibold">{avgMins ? minsToHrs(avgMins) : '—'}</p></div>
                <div><p className="text-gray-400">Avg Arrival</p><p className="font-semibold">{avgIn != null ? minsTo12h(avgIn) : '—'}</p></div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── PAYSLIPS TAB ──────────────────────────────────────────────────────────────

type StaffProfile = {
  id: number; staff_name: string; full_name: string | null; start_date: string | null
  date_of_birth: string | null; ghana_card: string | null; ssnit_number: string | null
  phone: string | null; address: string | null; bank_name: string | null
  bank_account: string | null; momo_number: string | null
}

function fmtC(v: string | null | undefined) {
  if (!v) return '—'
  const n = parseFloat(v)
  return isNaN(n) ? '—' : `₵${n.toFixed(2)}`
}
function numF(v: string | null | undefined) {
  if (!v) return '—'
  const n = parseFloat(v)
  return isNaN(n) ? '—' : n.toLocaleString(undefined, { maximumFractionDigits: 2 })
}
function monthLabel(d: string) {
  const dt = new Date(d + 'T00:00:00')
  return dt.toLocaleString('default', { month: 'short', year: '2-digit' })
}
function monthLabelFull(d: string) {
  const dt = new Date(d + 'T00:00:00')
  return dt.toLocaleString('default', { month: 'long', year: 'numeric' })
}

const PAY_COLS = [
  { key: 'hours_worked',        label: 'Hours',     fmt: (v: any) => v ? `${parseFloat(v).toFixed(1)}h` : '—' },
  { key: 'pay_for_hours',       label: '₵ Hrs',     fmt: fmtC },
  { key: 'overtime_hours',      label: 'OT h',      fmt: (v: any) => v && parseFloat(v) > 0 ? parseFloat(v).toFixed(1)+'h' : '—' },
  { key: 'pay_for_overtime',    label: '₵ OT',      fmt: fmtC },
  { key: 'longevity_days',      label: 'L.Days',    fmt: numF },
  { key: 'pay_for_longevity',   label: '₵ Long',    fmt: fmtC },
  { key: 'duty_allowance',      label: 'Duty',      fmt: fmtC },
  { key: 'data_allowance',      label: 'Data',      fmt: fmtC },
  { key: 'childcare_allowance', label: 'Childcare', fmt: fmtC },
  { key: 'ssnit',               label: 'SSNIT',     fmt: fmtC },
  { key: 'total_salary',        label: 'TOTAL',      fmt: fmtC },
] as const

const ALL_STAFF_NAMES = ['Joe', 'Bino', 'James', 'Rawlings', 'Grony']

type PayView = 'monthly' | 'staff' | 'profiles'

type PayFlag = { staff: string; month: string; issue: string; severity: 'warn' | 'error' }

function detectPayFlags(payslips: Payslip[]): PayFlag[] {
  const flags: PayFlag[] = []
  for (const p of payslips) {
    const m = monthLabel(p.pay_month)
    const isFlat = p.staff_name === 'Grony'

    // Missing hours for non-flat staff
    const hours = p.hours_worked != null ? parseFloat(p.hours_worked) : null
    if (!isFlat && (hours === null || hours === 0)) {
      flags.push({ staff: p.staff_name, month: m, issue: 'Hours not recorded — pay may be estimated', severity: 'warn' })
    }

    // Hours present but pay_for_hours is zero/null
    const payHrs = p.pay_for_hours != null ? parseFloat(p.pay_for_hours) : null
    if (!isFlat && hours && hours > 0 && (!payHrs || payHrs === 0)) {
      flags.push({ staff: p.staff_name, month: m, issue: 'Hours recorded but pay-for-hours is zero', severity: 'error' })
    }

    // Rate anomaly: pay_for_hours / hours should be between 4.50 and 6.00
    if (!isFlat && hours && hours > 0 && payHrs && payHrs > 0) {
      const rate = payHrs / hours
      if (rate < 4.50 || rate > 6.50) {
        flags.push({ staff: p.staff_name, month: m, issue: `Effective rate ₵${rate.toFixed(2)}/h — expected ₵5.00–₵5.50`, severity: 'warn' })
      }
    }

    // Component sum ≠ stored total (only if all components are present)
    const total = p.total_salary != null ? parseFloat(p.total_salary) : null
    const computed = [p.pay_for_hours, p.pay_for_overtime, p.pay_for_longevity, p.duty_allowance, p.data_allowance, p.childcare_allowance]
      .reduce((s, v) => s + (v != null ? parseFloat(v) : 0), 0)
    if (total !== null && computed > 0 && Math.abs(total - computed) > 0.10) {
      flags.push({
        staff: p.staff_name, month: m,
        issue: `Total ₵${total.toFixed(2)} ≠ component sum ₵${computed.toFixed(2)} (diff ₵${Math.abs(total - computed).toFixed(2)})`,
        severity: 'error',
      })
    }

    // Missing longevity for non-Grony staff
    if (!isFlat && (p.longevity_days == null || parseFloat(p.longevity_days) === 0)) {
      flags.push({ staff: p.staff_name, month: m, issue: 'Longevity days not set', severity: 'warn' })
    }
  }
  return flags
}

function PayslipsTab() {
  const [payslips, setPayslips] = useState<Payslip[]>([])
  const [profiles, setProfiles] = useState<StaffProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<PayView>('monthly')
  const [selectedMonth, setSelectedMonth] = useState<string>('')
  const [selectedStaff, setSelectedStaff] = useState<string>('Joe')
  const [editProfile, setEditProfile] = useState<StaffProfile | null>(null)
  const [editForm, setEditForm] = useState<Partial<StaffProfile>>({})
  const [savingProfile, setSavingProfile] = useState(false)
  const [expandedId, setExpandedId] = useState<number | null>(null)

  useEffect(() => {
    Promise.all([
      fetch('/api/payslips').then(r => r.json()).catch(() => []),
      fetch('/api/staff/profiles').then(r => r.json()).catch(() => []),
    ]).then(([p, pr]) => {
      const ps = Array.isArray(p) ? p : []
      setPayslips(ps)
      setProfiles(Array.isArray(pr) ? pr : [])
      // default to most recent month
      const months = [...new Set(ps.map((x: Payslip) => x.pay_month))].sort()
      if (months.length) setSelectedMonth(months[months.length - 1])
      setLoading(false)
    })
  }, [])

  const months = useMemo(() =>
    [...new Set(payslips.map(p => p.pay_month))].sort(), [payslips])

  const payFlags = useMemo(() => detectPayFlags(payslips), [payslips])

  // Monthly view: all staff for selected month
  const monthlyData = useMemo(() =>
    ALL_STAFF_NAMES.map(name => payslips.find(p => p.staff_name === name && p.pay_month === selectedMonth) ?? null),
    [payslips, selectedMonth])

  // Staff view: all months for selected staff
  const staffData = useMemo(() =>
    months.map(m => payslips.find(p => p.staff_name === selectedStaff && p.pay_month === m) ?? null),
    [payslips, months, selectedStaff])

  async function saveProfile() {
    if (!editProfile) return
    setSavingProfile(true)
    const res = await fetch('/api/staff/profiles', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ staff_name: editProfile.staff_name, ...editForm }),
    })
    if (res.ok) {
      const updated = await res.json()
      setProfiles(prev => prev.map(p => p.staff_name === updated.staff_name ? updated : p))
      setEditProfile(null)
    }
    setSavingProfile(false)
  }

  if (loading) return <div className="py-10 text-center text-gray-400">Loading…</div>

  const viewBtn = (v: PayView, label: string) => (
    <button key={v} onClick={() => setView(v)}
      className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold transition
        ${view === v ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
      {label}
    </button>
  )

  return (
    <div className="space-y-4">
      {/* View selector */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {viewBtn('monthly',  '📅 By Month')}
        {viewBtn('staff',    '👤 By Staff')}
        {viewBtn('profiles', '🪪 Profiles')}
        {payFlags.length > 0 && viewBtn('flags' as any, `⚠️ Flags (${payFlags.length})`)}
      </div>

      {/* ── FLAGS VIEW ──────────────────────────────────────────────────────────── */}
      {(view as string) === 'flags' && (
        <div className="space-y-2">
          <p className="text-xs text-gray-500">These payslip records have data that doesn't add up. Fix the underlying staff times or payslip entries to resolve them.</p>
          {payFlags.map((f, i) => (
            <div key={i} className={`rounded-xl border px-3 py-2.5 flex gap-3 items-start
              ${f.severity === 'error' ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200'}`}>
              <span className="mt-0.5 text-base">{f.severity === 'error' ? '🔴' : '🟡'}</span>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${STAFF_COLORS[f.staff] ?? 'bg-gray-100 text-gray-600'}`}>{f.staff}</span>
                  <span className="text-[10px] font-semibold text-gray-500">{f.month}</span>
                </div>
                <p className="text-xs text-gray-800 mt-1">{f.issue}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── MONTHLY VIEW ─────────────────────────────────────────────────────── */}
      {view === 'monthly' && (
        <div className="space-y-3">
          {/* Month selector */}
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {months.map(m => (
              <button key={m} onClick={() => setSelectedMonth(m)}
                className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold transition
                  ${selectedMonth === m ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                {monthLabel(m)}
              </button>
            ))}
          </div>

          {selectedMonth && (
            <>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">{monthLabelFull(selectedMonth)}</p>

              {/* Summary cards */}
              <div className="grid grid-cols-2 gap-2">
                {monthlyData.map((p, i) => {
                  const name = ALL_STAFF_NAMES[i]
                  const color = STAFF_COLORS[name] ?? 'bg-gray-100 text-gray-600'
                  return (
                    <button key={name}
                      onClick={() => setExpandedId(expandedId === i ? null : i)}
                      className={`text-left rounded-xl border p-3 transition ${expandedId === i ? 'border-blue-400 bg-blue-50' : 'border-gray-200 bg-white hover:border-gray-300'}`}>
                      <div className="flex items-center justify-between">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${color}`}>{name}</span>
                        <span className="text-sm font-bold text-green-700">{fmtC(p?.total_salary)}</span>
                      </div>
                      {p && (
                        <div className="mt-1.5 text-[10px] text-gray-500 space-y-0.5">
                          <div className="flex justify-between"><span>Hours</span><span className="font-medium text-gray-700">{p.hours_worked ? parseFloat(p.hours_worked).toFixed(1)+'h' : '—'}</span></div>
                          <div className="flex justify-between"><span>Pay</span><span className="font-medium text-gray-700">{fmtC(p.pay_for_hours)}</span></div>
                          {p.overtime_hours && parseFloat(p.overtime_hours) > 0 && (
                            <div className="flex justify-between"><span>OT</span><span className="font-medium text-orange-600">{fmtC(p.pay_for_overtime)}</span></div>
                          )}
                          <div className="flex justify-between"><span>Longevity</span><span className="font-medium text-gray-700">{p.longevity_days ? `${p.longevity_days}d / ${fmtC(p.pay_for_longevity)}` : '—'}</span></div>
                          <div className="flex justify-between"><span>Duty + Data</span><span className="font-medium text-gray-700">{fmtC(p.duty_allowance)} + {fmtC(p.data_allowance)}</span></div>
                          {p.childcare_allowance && parseFloat(p.childcare_allowance) > 0 && (
                            <div className="flex justify-between"><span>Childcare</span><span className="font-medium text-pink-600">{fmtC(p.childcare_allowance)}</span></div>
                          )}
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>

              {/* Grand total */}
              <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 flex justify-between items-center">
                <span className="text-sm font-bold text-gray-700">Total Salaries & Wages</span>
                <span className="text-lg font-bold text-green-700">
                  {fmtC(String(monthlyData.reduce((s, p) => s + (p ? parseFloat(p.total_salary ?? '0') : 0), 0).toFixed(2)))}
                </span>
              </div>

              {/* Full comparison table */}
              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wide px-3 pt-2.5 pb-1">Full Breakdown</p>
                <div className="overflow-x-auto">
                  <table className="w-full text-[9px]">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="text-left px-3 py-1.5 text-gray-500 font-bold">Staff</th>
                        {PAY_COLS.map(c => (
                          <th key={c.key} className={`text-center px-1 py-1.5 font-bold ${c.key === 'total_salary' ? 'text-green-600' : 'text-gray-400'}`}>{c.label}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {ALL_STAFF_NAMES.map((name, i) => {
                        const p = monthlyData[i]
                        const color = STAFF_COLORS[name] ?? 'bg-gray-100 text-gray-600'
                        return (
                          <tr key={name} className="hover:bg-gray-50">
                            <td className="px-3 py-1.5">
                              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${color}`}>{name}</span>
                            </td>
                            {PAY_COLS.map(c => (
                              <td key={c.key} className={`text-center px-1 py-1.5 tabular-nums ${c.key === 'total_salary' ? 'font-bold text-green-700' : 'text-gray-600'}`}>
                                {p ? c.fmt((p as any)[c.key]) : '—'}
                              </td>
                            ))}
                          </tr>
                        )
                      })}
                      {/* Totals row */}
                      <tr className="bg-gray-100 border-t-2 border-gray-300">
                        <td className="px-3 py-1.5 text-[9px] font-bold text-gray-700">TOTAL</td>
                        {PAY_COLS.map(c => {
                          const sum = monthlyData.reduce((s, p) => s + (p ? parseFloat((p as any)[c.key] ?? '0') || 0 : 0), 0)
                          return (
                            <td key={c.key} className={`text-center px-1 py-1.5 tabular-nums font-bold ${c.key === 'total_salary' ? 'text-green-700' : 'text-gray-600'}`}>
                              {sum > 0 ? (c.key.includes('hours') || c.key === 'longevity_days' || c.key === 'overtime_hours' ? sum.toFixed(1) : `₵${sum.toFixed(2)}`) : '—'}
                            </td>
                          )
                        })}
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── STAFF VIEW ────────────────────────────────────────────────────────── */}
      {view === 'staff' && (
        <div className="space-y-3">
          {/* Staff selector */}
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {ALL_STAFF_NAMES.map(name => {
              const color = STAFF_COLORS[name] ?? 'bg-gray-100 text-gray-600'
              return (
                <button key={name} onClick={() => setSelectedStaff(name)}
                  className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold transition
                    ${selectedStaff === name ? color + ' ring-2 ring-blue-400' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                  {name}
                </button>
              )
            })}
          </div>

          {/* Profile quick-view */}
          {(() => {
            const prof = profiles.find(p => p.staff_name === selectedStaff)
            if (!prof) return null
            return (
              <div className="bg-white border border-gray-200 rounded-xl px-4 py-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                <div><span className="text-gray-400">Full name: </span><span className="font-medium">{prof.full_name ?? '—'}</span></div>
                <div><span className="text-gray-400">Started: </span><span className="font-medium">{prof.start_date ?? '—'}</span></div>
                <div><span className="text-gray-400">Ghana Card: </span><span className="font-medium">{prof.ghana_card ?? '—'}</span></div>
                <div><span className="text-gray-400">SSNIT: </span><span className="font-medium">{prof.ssnit_number ?? '—'}</span></div>
                <div><span className="text-gray-400">Phone: </span><span className="font-medium">{prof.phone ?? '—'}</span></div>
                <div><span className="text-gray-400">MoMo: </span><span className="font-medium">{prof.momo_number ?? '—'}</span></div>
                <div className="col-span-2"><span className="text-gray-400">Bank: </span><span className="font-medium">{prof.bank_name ? `${prof.bank_name} · ${prof.bank_account ?? ''}` : '—'}</span></div>
              </div>
            )
          })()}

          {/* Monthly history table */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-[9px]">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-3 py-1.5 text-gray-500 font-bold whitespace-nowrap">Month</th>
                    {PAY_COLS.map(c => (
                      <th key={c.key} className={`text-center px-1 py-1.5 font-bold whitespace-nowrap ${c.key === 'total_salary' ? 'text-green-600' : 'text-gray-400'}`}>{c.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {months.map((m, i) => {
                    const p = staffData[i]
                    return (
                      <tr key={m} className="hover:bg-gray-50">
                        <td className="px-3 py-1.5 font-semibold text-gray-700 whitespace-nowrap">{monthLabel(m)}</td>
                        {PAY_COLS.map(c => (
                          <td key={c.key} className={`text-center px-1 py-1.5 tabular-nums ${c.key === 'total_salary' ? 'font-bold text-green-700' : 'text-gray-600'}`}>
                            {p ? c.fmt((p as any)[c.key]) : '—'}
                          </td>
                        ))}
                      </tr>
                    )
                  })}
                  {/* Totals row */}
                  <tr className="bg-gray-100 border-t-2 border-gray-300">
                    <td className="px-3 py-1.5 text-[9px] font-bold text-gray-700">TOTAL</td>
                    {PAY_COLS.map(c => {
                      const sum = staffData.reduce((s, p) => s + (p ? parseFloat((p as any)[c.key] ?? '0') || 0 : 0), 0)
                      return (
                        <td key={c.key} className={`text-center px-1 py-1.5 tabular-nums font-bold ${c.key === 'total_salary' ? 'text-green-700' : 'text-gray-600'}`}>
                          {sum > 0 ? (c.key.includes('hours') || c.key === 'longevity_days' || c.key === 'overtime_hours' ? sum.toFixed(1) : `₵${sum.toFixed(2)}`) : '—'}
                        </td>
                      )
                    })}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── PROFILES VIEW ─────────────────────────────────────────────────────── */}
      {view === 'profiles' && (
        <div className="space-y-3">
          {editProfile && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold text-blue-800">{editProfile.staff_name} — Edit Profile</p>
                <button onClick={() => setEditProfile(null)} className="text-gray-400 text-lg">×</button>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                {[
                  ['full_name',     'Full Name'],
                  ['start_date',    'Start Date (YYYY-MM-DD)'],
                  ['date_of_birth', 'Date of Birth (YYYY-MM-DD)'],
                  ['ghana_card',    'Ghana Card No.'],
                  ['ssnit_number',  'SSNIT Number'],
                  ['phone',         'Phone'],
                  ['momo_number',   'MoMo Number'],
                  ['bank_name',     'Bank Name'],
                  ['bank_account',  'Bank Account No.'],
                  ['address',       'Address'],
                ].map(([field, label]) => (
                  <div key={field} className={field === 'address' ? 'col-span-2' : ''}>
                    <label className="text-[10px] text-gray-500 mb-0.5 block">{label}</label>
                    <input
                      value={(editForm as any)[field] ?? ''}
                      onChange={e => setEditForm(f => ({ ...f, [field]: e.target.value }))}
                      placeholder={label}
                      className="w-full bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs outline-none focus:ring-1 focus:ring-blue-400"
                    />
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <button onClick={saveProfile} disabled={savingProfile}
                  className="flex-1 bg-blue-600 text-white text-xs font-bold rounded-lg py-2 disabled:opacity-40">
                  {savingProfile ? 'Saving…' : 'Save Profile'}
                </button>
                <button onClick={() => setEditProfile(null)} className="px-4 py-2 bg-gray-100 text-gray-600 text-xs font-semibold rounded-lg">Cancel</button>
              </div>
            </div>
          )}

          {profiles.map(prof => (
            <div key={prof.staff_name} className="bg-white border border-gray-200 rounded-xl p-4 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${STAFF_COLORS[prof.staff_name] ?? 'bg-gray-100 text-gray-600'}`}>
                    {prof.staff_name}
                  </span>
                  {prof.full_name && <span className="text-sm font-semibold text-gray-800">{prof.full_name}</span>}
                </div>
                <button onClick={() => { setEditProfile(prof); setEditForm({ ...prof }) }}
                  className="text-xs font-semibold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-lg hover:bg-blue-100">Edit</button>
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs border-t border-gray-100 pt-2">
                <div><span className="text-gray-400">Started: </span><span className="font-medium text-gray-800">{prof.start_date ?? <span className="text-red-400">Not set</span>}</span></div>
                <div><span className="text-gray-400">DOB: </span><span className="font-medium text-gray-800">{prof.date_of_birth ?? '—'}</span></div>
                <div><span className="text-gray-400">Ghana Card: </span><span className="font-medium text-gray-800">{prof.ghana_card ?? <span className="text-orange-400">Missing</span>}</span></div>
                <div><span className="text-gray-400">SSNIT: </span><span className="font-medium text-gray-800">{prof.ssnit_number ?? <span className="text-orange-400">Missing</span>}</span></div>
                <div><span className="text-gray-400">Phone: </span><span className="font-medium text-gray-800">{prof.phone ?? '—'}</span></div>
                <div><span className="text-gray-400">MoMo: </span><span className="font-medium text-gray-800">{prof.momo_number ?? '—'}</span></div>
                <div className="col-span-2"><span className="text-gray-400">Bank: </span><span className="font-medium text-gray-800">{prof.bank_name ? `${prof.bank_name} · ${prof.bank_account ?? ''}` : '—'}</span></div>
                <div className="col-span-2"><span className="text-gray-400">Address: </span><span className="font-medium text-gray-800">{prof.address ?? '—'}</span></div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── VIOLATIONS TAB ────────────────────────────────────────────────────────────

const VIOLATION_VIEWS = ['Disciplinary', 'Payslips', 'Times'] as const
type ViolationView = (typeof VIOLATION_VIEWS)[number]

const VIOLATION_ICONS: Record<ViolationView, React.ReactNode> = {
  Disciplinary: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
    </svg>
  ),
  Payslips: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
    </svg>
  ),
  Times: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
    </svg>
  ),
}

function ViolationsTab({ role, username, vtab, setVtab }: { role: string; username: string; vtab: ViolationView; setVtab: (v: ViolationView) => void }) {
  const isAdmin = role === 'owner' || role === 'admin' || username === 'rawlings' || username === 'grony' || username === 'joe'
  const PAYSLIP_MONTHS = ['2026-04', '2026-05']
  const PAYSLIP_MONTH_LABELS: Record<string, string> = { '2026-04': 'April 2026', '2026-05': 'May 2026' }

  const vview = vtab
  const setVview = setVtab
  const [violations, setViolations] = useState<Violation[]>([])
  const [noTimesDays, setNoTimesDays] = useState<string[]>([])
  const [missingPayslips, setMissingPayslips] = useState<{ staff: string; month: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ staff_name: STAFF[0], violation: '', details: '', severity: 'minor', points: '5' })
  const [saving, setSaving] = useState(false)
  const [staffFilter, setStaffFilter] = useState('All')

  useEffect(() => {
    const safe = (p: Promise<Response>) => p.then(r => r.ok ? r.json() : null).catch(() => null)
    Promise.all([
      safe(fetch('/api/staff/violations')),
      safe(fetch('/api/flags')),
      safe(fetch('/api/payslips')),
    ]).then(([v, flags, payslips]) => {
      setViolations(Array.isArray(v) ? v : [])
      setNoTimesDays((flags?.noStaffTimes ?? []).map((r: any) => r.missing_date))
      const existing = new Set(
        (Array.isArray(payslips) ? payslips : []).map((p: any) => `${p.staff_name}|${p.pay_month?.slice(0, 7)}`)
      )
      const missing: { staff: string; month: string }[] = []
      for (const month of PAYSLIP_MONTHS) {
        for (const s of STAFF) {
          if (!existing.has(`${s}|${month}`)) missing.push({ staff: s, month })
        }
      }
      setMissingPayslips(missing)
      setLoading(false)
    })
  }, [])

  async function submit() {
    if (!form.violation.trim()) return
    setSaving(true)
    const res = await fetch('/api/staff/violations', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, points: Number(form.points) || 0 }),
    })
    setSaving(false)
    if (res.ok) {
      const row = await res.json()
      setViolations(prev => [row, ...prev])
      setForm({ staff_name: STAFF[0], violation: '', details: '', severity: 'minor', points: '5' })
      setShowForm(false)
    }
  }

  async function remove(id: number) {
    await fetch('/api/staff/violations', {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    setViolations(prev => prev.filter(v => v.id !== id))
  }

  const canManage = ['owner', 'manager'].includes(role) || username === 'joe'
  const filtered = staffFilter === 'All' ? violations : violations.filter(v => v.staff_name.toLowerCase() === staffFilter.toLowerCase())

  const leaderboard = useMemo(() => {
    const totals: Record<string, number> = {}
    for (const v of violations) totals[v.staff_name] = (totals[v.staff_name] ?? 0) + (v.points || 0)
    return STAFF.map(s => ({ staff: s, points: totals[s] ?? 0 })).sort((a, b) => b.points - a.points)
  }, [violations])

  const vviewCounts: Record<ViolationView, number> = {
    Disciplinary: violations.length,
    Payslips: missingPayslips.length,
    Times: noTimesDays.length,
  }

  if (loading) return <div className="py-10 text-center text-gray-400">Loading…</div>

  return (
    <div className="space-y-4">
      {/* ── sub-menu row ── */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {VIOLATION_VIEWS.map(v => {
          const count = vviewCounts[v]
          const active = vview === v
          return (
            <button key={v} onClick={() => setVview(v)} title={`${count} ${v.toLowerCase()}`}
              className={`relative shrink-0 flex flex-col items-center gap-0.5 px-4 py-2 rounded-xl text-[10px] font-semibold transition
                ${active ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
              {VIOLATION_ICONS[v]}
              {v}
              {count > 0 && (
                <span className={`absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full text-[9px] font-bold flex items-center justify-center
                  ${active ? 'bg-white text-red-600' : 'bg-red-500 text-white'}`}>
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* ── Disciplinary ── */}
      {vview === 'Disciplinary' && (
        <div className="space-y-4">
          <div className="bg-white border border-gray-200 rounded-xl p-3">
            <p className="text-xs font-semibold text-gray-500 mb-2">Penalty Points Leaderboard</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {leaderboard.map(l => (
                <div key={l.staff} className="bg-gray-50 rounded-lg px-3 py-2">
                  <p className="text-[10px] text-gray-400 capitalize">{l.staff}</p>
                  <p className={`text-base font-bold ${l.points > 0 ? 'text-red-500' : 'text-gray-700'}`}>{l.points}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex gap-1.5 overflow-x-auto pb-1">
              {['All', ...STAFF].map(s => (
                <button key={s} onClick={() => setStaffFilter(s)}
                  className={`shrink-0 px-3 py-1.5 rounded-lg text-sm font-medium capitalize transition
                    ${staffFilter === s ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                  {s}
                </button>
              ))}
            </div>
            {canManage && (
              <button onClick={() => setShowForm(v => !v)}
                className="shrink-0 ml-2 bg-red-500 hover:bg-red-400 text-white text-sm font-semibold px-3 py-1.5 rounded-lg transition">
                + Record
              </button>
            )}
          </div>

          {showForm && canManage && (
            <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
              <p className="text-sm font-semibold text-gray-700">Record Violation</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Staff Member</label>
                  <select value={form.staff_name} onChange={e => setForm(f => ({ ...f, staff_name: e.target.value }))} className={inputCls}>
                    {STAFF.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Severity</label>
                  <select value={form.severity} onChange={e => setForm(f => ({ ...f, severity: e.target.value }))} className={inputCls}>
                    <option value="minor">Minor</option>
                    <option value="moderate">Moderate</option>
                    <option value="serious">Serious</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Points</label>
                  <input type="number" min="0" value={form.points}
                    onChange={e => setForm(f => ({ ...f, points: e.target.value }))} className={inputCls} />
                </div>
              </div>
              <div>
                <label className={labelCls}>Violation</label>
                <input value={form.violation} onChange={e => setForm(f => ({ ...f, violation: e.target.value }))}
                  placeholder="e.g. Late arrival, Insubordination…" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Details (optional)</label>
                <textarea value={form.details} onChange={e => setForm(f => ({ ...f, details: e.target.value }))}
                  rows={2} placeholder="Additional context…"
                  className="w-full bg-gray-100 border border-gray-200 rounded-xl px-3 py-2.5 text-base text-gray-900 placeholder-gray-400 outline-none focus:ring-2 focus:ring-blue-400 resize-none" />
              </div>
              <div className="flex gap-2">
                <button onClick={submit} disabled={!form.violation.trim() || saving}
                  className="flex-1 bg-red-500 hover:bg-red-400 disabled:opacity-40 text-white text-sm font-semibold rounded-xl py-2.5 transition">
                  {saving ? 'Saving…' : 'Save Violation'}
                </button>
                <button onClick={() => setShowForm(false)} className="px-4 py-2.5 bg-gray-100 text-gray-600 text-sm font-semibold rounded-xl">Cancel</button>
              </div>
            </div>
          )}

          {filtered.length === 0
            ? <p className="py-10 text-center text-gray-400 text-sm">No violations recorded.</p>
            : filtered.map(v => (
              <div key={v.id} className="bg-white border border-gray-200 rounded-xl p-3 space-y-1">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STAFF_COLORS[v.staff_name.charAt(0).toUpperCase() + v.staff_name.slice(1)] ?? 'bg-gray-100 text-gray-600'}`}>
                      {v.staff_name}
                    </span>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${SEVERITY_COLORS[v.severity] ?? 'bg-gray-100 text-gray-500'}`}>
                      {v.severity}
                    </span>
                    {v.points > 0 && (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-red-50 text-red-600">
                        -{v.points} pts
                      </span>
                    )}
                  </div>
                  {(role === 'owner' || username === 'joe') && (
                    <button onClick={() => remove(v.id)} className="text-xs text-red-400 hover:text-red-600 font-semibold shrink-0">Delete</button>
                  )}
                </div>
                <p className="text-sm font-semibold text-gray-900">{v.violation}</p>
                {v.details && <p className="text-xs text-gray-500">{v.details}</p>}
                <p className="text-xs text-gray-400">
                  {fmtDate(v.created_at)}{v.recorded_by ? ` · ${v.recorded_by}` : ''}
                </p>
              </div>
            ))
          }
        </div>
      )}

      {/* ── Missing Payslips ── */}
      {vview === 'Payslips' && (
        <div className="space-y-3">
          <p className="text-[11px] text-gray-400">
            Joe must provide payslips for all staff for April 2026 and May 2026.
          </p>
          {missingPayslips.length === 0 ? (
            <p className="py-10 text-center text-gray-400 text-sm">All payslips are in. ✓</p>
          ) : (
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden divide-y divide-gray-100">
              {PAYSLIP_MONTHS.map(month => {
                const staffMissing = missingPayslips.filter(p => p.month === month).map(p => p.staff)
                if (staffMissing.length === 0) return (
                  <div key={month} className="flex items-center justify-between px-4 py-3">
                    <span className="text-sm font-semibold text-gray-700">{PAYSLIP_MONTH_LABELS[month]}</span>
                    <span className="text-xs text-green-600 font-semibold">Complete ✓</span>
                  </div>
                )
                return (
                  <div key={month} className="px-4 py-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-gray-700">{PAYSLIP_MONTH_LABELS[month]}</span>
                      <span className="text-[10px] text-orange-600 font-semibold">{staffMissing.length} missing</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {staffMissing.map(s => (
                        <span key={s} className={`text-xs font-semibold px-2.5 py-1 rounded-full ${STAFF_COLORS[s.charAt(0).toUpperCase()+s.slice(1)] ?? 'bg-gray-100 text-gray-600'}`}>
                          {s.charAt(0).toUpperCase()+s.slice(1)}
                        </span>
                      ))}
                    </div>
                    <p className="text-[11px] text-gray-400">Assigned to: <span className="font-semibold text-blue-600">Joe</span></p>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Missing Staff Times ── */}
      {vview === 'Times' && (
        <div className="space-y-3">
          <p className="text-[11px] text-gray-400">Days that have a sales receipt but no staff time was entered.</p>
          {noTimesDays.length === 0
            ? <p className="py-10 text-center text-gray-400 text-sm">All sales days have staff times recorded.</p>
            : (
              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden divide-y divide-gray-100">
                {noTimesDays.map(date => (
                  <FixRow key={date} label={fmtDate(date)} sub="No staff times recorded">
                    {isAdmin ? (
                      <NoTimesFix date={date} onFixed={d => setNoTimesDays(prev => prev.filter(x => x !== d))} />
                    ) : (
                      <p className="text-xs text-gray-400 py-1">Only Rawlings or the owner can add times.</p>
                    )}
                  </FixRow>
                ))}
              </div>
            )
          }
        </div>
      )}
    </div>
  )
}

// ── NO TIMES FIX (used inside ViolationsTab) ──────────────────────────────────

function FixRow({ label, sub, children }: { label: string; sub?: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <div>
      <div className="flex items-center justify-between px-3 py-1.5 gap-2">
        <div className="min-w-0 flex-1">
          <span className="text-[11px] text-gray-900 font-semibold">{label}</span>
          {sub && <span className="ml-2 text-[10px] text-gray-400">{sub}</span>}
        </div>
        <button onClick={() => setOpen(o => !o)}
          className="shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded bg-blue-50 text-blue-600 hover:bg-blue-100 transition">
          {open ? 'Close' : 'Fix'}
        </button>
      </div>
      {open && <div className="px-3 pb-2 border-t border-gray-50 space-y-1.5 pt-1.5">{children}</div>}
    </div>
  )
}

const ABSENCE_STATUSES = ['ABSENT', 'ON LEAVE', 'TRAVELLED', 'ON ASSIGNMENT']

type StaffEntry = { mode: 'work' | 'away'; timeIn: string; timeOut: string; status: string }

function NoTimesFix({ date, onFixed }: { date: string; onFixed: (d: string) => void }) {
  const [entries, setEntries] = useState<Record<string, StaffEntry>>(
    () => Object.fromEntries(STAFF.map(s => [s, { mode: 'work', timeIn: '', timeOut: '', status: 'ABSENT' }]))
  )
  const [saving, setSaving] = useState(false)

  function upd(s: string, patch: Partial<StaffEntry>) {
    setEntries(prev => ({ ...prev, [s]: { ...prev[s], ...patch } }))
  }

  const anyFilled = STAFF.some(s => {
    const e = entries[s]
    return e.mode === 'away' || (e.mode === 'work' && e.timeIn)
  })

  async function doSave(complete: boolean) {
    setSaving(true)
    const toSave = STAFF.filter(s => {
      const e = entries[s]
      return e.mode === 'away' || (e.mode === 'work' && e.timeIn)
    })
    await Promise.all(toSave.map(s => {
      const e = entries[s]
      return fetch('/api/staff-times/entry', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          staff_name: s, work_date: date,
          actual_in: e.mode === 'work' && e.timeIn ? hhmmTo12h(e.timeIn) : null,
          actual_out: e.mode === 'work' && e.timeOut ? hhmmTo12h(e.timeOut) : null,
          status: e.mode === 'away' ? e.status : null,
        }),
      })
    }))
    setSaving(false)
    if (complete) onFixed(date)
  }

  return (
    <div className="space-y-2">
      {STAFF.map(s => {
        const e = entries[s]
        const cap = s.charAt(0).toUpperCase() + s.slice(1)
        return (
          <div key={s} className="bg-gray-50 rounded-xl p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${STAFF_COLORS[cap] ?? 'bg-gray-100 text-gray-600'}`}>{cap}</span>
              <div className="flex gap-1">
                <button onClick={() => upd(s, { mode: 'work' })}
                  className={`text-[10px] font-semibold px-2.5 py-0.5 rounded-lg transition ${e.mode === 'work' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500 hover:bg-gray-300'}`}>
                  Worked
                </button>
                <button onClick={() => upd(s, { mode: 'away' })}
                  className={`text-[10px] font-semibold px-2.5 py-0.5 rounded-lg transition ${e.mode === 'away' ? 'bg-orange-500 text-white' : 'bg-gray-200 text-gray-500 hover:bg-gray-300'}`}>
                  Away
                </button>
              </div>
            </div>
            {e.mode === 'work' ? (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className={labelCls}>Time In *</label>
                  <input type="time" value={e.timeIn} onChange={ev => upd(s, { timeIn: ev.target.value })} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Time Out</label>
                  <input type="time" value={e.timeOut} onChange={ev => upd(s, { timeOut: ev.target.value })} className={inputCls} />
                </div>
              </div>
            ) : (
              <select value={e.status} onChange={ev => upd(s, { status: ev.target.value })} className={inputCls}>
                {ABSENCE_STATUSES.map(st => <option key={st} value={st}>{st}</option>)}
              </select>
            )}
          </div>
        )
      })}
      <div className="flex gap-2">
        <button onClick={() => doSave(false)} disabled={!anyFilled || saving}
          className="flex-1 bg-gray-600 hover:bg-gray-500 disabled:opacity-40 text-white text-xs font-semibold rounded-lg py-2 transition">
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button onClick={() => doSave(true)} disabled={!anyFilled || saving}
          className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-xs font-semibold rounded-lg py-2 transition">
          {saving ? '…' : 'Complete'}
        </button>
      </div>
    </div>
  )
}



function RoleTab({ role, username }: { role: string; username: string }) {
  const [users, setUsers] = useState<AppUser[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<number | null>(null)
  const canManageRoles = role === 'owner' || username === 'joe'

  useEffect(() => {
    fetch('/api/users').then(r => r.json())
      .then(d => { setUsers(Array.isArray(d) ? d : []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  async function changeRole(user: AppUser, newRole: string) {
    setSaving(user.id)
    const res = await fetch(`/api/users/${user.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: newRole }),
    })
    setSaving(null)
    if (res.ok) {
      const updated = await res.json()
      setUsers(prev => prev.map(u => u.id === user.id ? { ...u, ...updated } : u))
    }
  }

  if (!canManageRoles) {
    return <p className="py-10 text-center text-gray-400 text-sm">Only the owner can manage roles.</p>
  }

  if (loading) return <div className="py-10 text-center text-gray-400">Loading…</div>

  const ROLE_COLORS: Record<string, string> = {
    owner: 'bg-blue-100 text-blue-700',
    manager: 'bg-purple-100 text-purple-700',
    staff: 'bg-gray-100 text-gray-600',
  }

  return (
    <div className="space-y-2">
      {users.map(u => {
        // Joe's owner-level access does not extend to editing the owner's own account
        const protectedFromMe = role !== 'owner' && (u.role === 'owner' || u.username?.toLowerCase() === 'grony')
        return (
          <div key={u.id} className="bg-white border border-gray-200 rounded-xl p-3 flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900">{u.display_name}</p>
              <p className="text-xs text-gray-400">@{u.username}{u.email ? ` · ${u.email}` : ''}</p>
            </div>
            <select
              value={u.role}
              onChange={e => changeRole(u, e.target.value)}
              disabled={saving === u.id || protectedFromMe}
              className="shrink-0 text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-gray-700 outline-none focus:ring-1 focus:ring-blue-400 disabled:opacity-50">
              <option value="staff">Staff</option>
              <option value="manager">Manager</option>
              <option value="owner">Owner</option>
            </select>
            <span className={`shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full ${ROLE_COLORS[u.role] ?? 'bg-gray-100 text-gray-500'}`}>
              {saving === u.id ? '…' : u.role}
            </span>
          </div>
        )
      })}
    </div>
  )
}

// ── ROTA TAB ──────────────────────────────────────────────────────────────────

type RotaEntry = {
  id: number
  staff_name: string
  rota_date: string
  sched_in: string | null
  sched_out: string | null
  is_off: boolean
  role: string | null
}

type Absence = {
  id: number
  staff_name: string
  start_date: string
  end_date: string
  reason: string | null
  absence_type: string
}

const ROTA_STAFF = ['Joe', 'James', 'Rawlings', 'Bino']
const ABSENCE_TYPES = ['travel', 'leave', 'sick', 'other']
const ROTA_MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']

const ROTA_STAFF_COLORS: Record<string, string> = {
  Joe: 'bg-blue-100 text-blue-700 border-blue-200',
  James: 'bg-green-100 text-green-700 border-green-200',
  Rawlings: 'bg-orange-100 text-orange-700 border-orange-200',
  Bino: 'bg-purple-100 text-purple-700 border-purple-200',
}

function hoursFromShift(entry: RotaEntry): number {
  if (entry.is_off || !entry.sched_in || !entry.sched_out) return 0
  const parse = (t: string) => {
    const m = t.match(/(\d+):(\d+)(am|pm)/i)
    if (!m) return 0
    let h = parseInt(m[1]), min = parseInt(m[2])
    if (m[3].toLowerCase() === 'pm' && h !== 12) h += 12
    if (m[3].toLowerCase() === 'am' && h === 12) h = 0
    return h + min / 60
  }
  return Math.max(0, parse(entry.sched_out) - parse(entry.sched_in))
}

function RotaTab() {
  const today = new Date()
  const [subTab, setSubTab] = useState<'schedule' | 'absences'>('schedule')
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth() + 1)
  const [rota, setRota] = useState<RotaEntry[]>([])
  const [absences, setAbsences] = useState<Absence[]>([])
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [editEntry, setEditEntry] = useState<RotaEntry | null>(null)

  // Absence form
  const [showAbsForm, setShowAbsForm] = useState(false)
  const [absForm, setAbsForm] = useState({ staff_name: 'Joe', start_date: '', end_date: '', reason: '', absence_type: 'travel' })
  const [savingAbs, setSavingAbs] = useState(false)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/rota?year=${year}&month=${month}`)
      .then(r => r.json()).then(d => { setRota(d); setLoading(false) })
  }, [year, month])

  useEffect(() => {
    fetch('/api/rota/absences').then(r => r.json()).then(setAbsences)
  }, [])

  async function generate() {
    setGenerating(true)
    await fetch('/api/rota/generate', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ year, month, leaveStaff: [] }),
    })
    const res = await fetch(`/api/rota?year=${year}&month=${month}`)
    setRota(await res.json())
    setGenerating(false)
  }

  async function saveEdit() {
    if (!editEntry) return
    const res = await fetch('/api/rota', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editEntry),
    })
    const updated = await res.json()
    setRota(prev => prev.map(e => e.id === updated.id ? updated : e))
    setEditEntry(null)
  }

  async function saveAbsence() {
    setSavingAbs(true)
    const res = await fetch('/api/rota/absences', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(absForm),
    })
    const created = await res.json()
    setAbsences(prev => [created, ...prev])
    setShowAbsForm(false)
    setSavingAbs(false)
  }

  async function deleteAbsence(id: number) {
    await fetch('/api/rota/absences', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    setAbsences(prev => prev.filter(a => a.id !== id))
  }

  const byDate = useMemo(() => {
    const map: Record<string, RotaEntry[]> = {}
    for (const e of rota) {
      if (!map[e.rota_date]) map[e.rota_date] = []
      map[e.rota_date].push(e)
    }
    return map
  }, [rota])

  const sortedDates = useMemo(() => Object.keys(byDate).sort(), [byDate])

  const hoursSummary = useMemo(() => {
    const h: Record<string, number> = {}
    for (const e of rota) h[e.staff_name] = (h[e.staff_name] ?? 0) + hoursFromShift(e)
    return h
  }, [rota])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end">
        <div className="flex gap-1">
          <button onClick={() => setSubTab('schedule')}
            className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition ${subTab === 'schedule' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
            Schedule
          </button>
          <button onClick={() => setSubTab('absences')}
            className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition ${subTab === 'absences' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
            Absences
          </button>
        </div>
      </div>

      {/* ── SCHEDULE SUB-TAB ── */}
      {subTab === 'schedule' && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 flex-wrap">
            <select value={month} onChange={e => setMonth(Number(e.target.value))}
              className="bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm font-medium outline-none focus:ring-2 focus:ring-blue-400">
              {ROTA_MONTHS.map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}
            </select>
            <select value={year} onChange={e => setYear(Number(e.target.value))}
              className="bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm font-medium outline-none focus:ring-2 focus:ring-blue-400">
              {[2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            <button onClick={generate} disabled={generating}
              className="bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-sm font-semibold px-4 py-2 rounded-xl transition">
              {generating ? 'Generating…' : rota.length ? 'Re-generate' : 'Generate'}
            </button>
          </div>

          {rota.length > 0 && (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {ROTA_STAFF.map(s => {
                const h = hoursSummary[s] ?? 0
                const target = s === 'Bino' ? 100 : 210
                const pct = Math.min(100, Math.round((h / target) * 100))
                return (
                  <div key={s} className="bg-white border border-gray-200 rounded-xl p-3">
                    <div className="flex justify-between items-center mb-1">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${ROTA_STAFF_COLORS[s]}`}>{s}</span>
                      <span className="text-xs text-gray-400">{target}h</span>
                    </div>
                    <p className="text-lg font-bold text-gray-900">{h.toFixed(1)}h</p>
                    <div className="mt-1.5 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all ${pct >= 90 ? 'bg-green-500' : pct >= 70 ? 'bg-yellow-400' : 'bg-red-400'}`}
                        style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {loading && <p className="py-8 text-center text-gray-400">Loading…</p>}
          {!loading && rota.length === 0 && (
            <p className="py-8 text-center text-gray-400 text-sm">No rota for {ROTA_MONTHS[month-1]} {year}. Click Generate to create one.</p>
          )}

          {editEntry && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={() => setEditEntry(null)}>
              <div className="bg-white rounded-2xl p-5 w-full max-w-sm space-y-3 shadow-xl" onClick={e => e.stopPropagation()}>
                <p className="font-bold text-gray-900">{editEntry.staff_name} — {fmtDate(editEntry.rota_date)}</p>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={editEntry.is_off}
                    onChange={e => setEditEntry(prev => prev ? {...prev, is_off: e.target.checked} : prev)}
                    className="w-4 h-4 accent-blue-600" />
                  <span className="text-sm text-gray-700">Day Off</span>
                </label>
                {!editEntry.is_off && (
                  <>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className={labelCls}>Start time</label>
                        <input value={editEntry.sched_in ?? ''} placeholder="8:00am"
                          onChange={e => setEditEntry(prev => prev ? {...prev, sched_in: e.target.value} : prev)}
                          className={inputCls} />
                      </div>
                      <div>
                        <label className={labelCls}>End time</label>
                        <input value={editEntry.sched_out ?? ''} placeholder="5:00pm"
                          onChange={e => setEditEntry(prev => prev ? {...prev, sched_out: e.target.value} : prev)}
                          className={inputCls} />
                      </div>
                    </div>
                    <div>
                      <label className={labelCls}>Role</label>
                      <select value={editEntry.role ?? 'normal'}
                        onChange={e => setEditEntry(prev => prev ? {...prev, role: e.target.value} : prev)}
                        className={inputCls}>
                        <option value="opener">Opener</option>
                        <option value="closer">Closer</option>
                        <option value="normal">Normal</option>
                      </select>
                    </div>
                  </>
                )}
                <div className="flex gap-2">
                  <button onClick={saveEdit} className="flex-1 bg-green-600 text-white text-sm font-semibold rounded-xl py-2.5">Save</button>
                  <button onClick={() => setEditEntry(null)} className="px-4 py-2.5 bg-gray-100 text-gray-600 text-sm font-semibold rounded-xl">Cancel</button>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-3">
            {sortedDates.map(dateStr => {
              const dow = new Date(dateStr + 'T00:00:00').getDay()
              const isSun = dow === 0
              if (isSun) return null
              const dayEntries = byDate[dateStr] ?? []
              const allOff = dayEntries.every(e => e.is_off)
              return (
                <div key={dateStr} className={`bg-white border rounded-xl overflow-hidden ${allOff ? 'border-gray-100 opacity-60' : 'border-gray-200'}`}>
                  <div className="px-3 py-2 bg-gray-50 border-b border-gray-100 flex items-center gap-2">
                    <span className="text-xs font-bold text-gray-700">{fmtDate(dateStr)}</span>
                    {allOff && <span className="text-xs text-gray-400">— all off</span>}
                  </div>
                  <div className="divide-y divide-gray-50">
                    {ROTA_STAFF.map(staff => {
                      const e = dayEntries.find(x => x.staff_name === staff)
                      if (!e) return null
                      return (
                        <button key={staff} onClick={() => setEditEntry({...e})}
                          className="w-full flex items-center gap-3 px-3 py-2 hover:bg-gray-50 text-left transition">
                          <span className={`shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full w-16 text-center ${ROTA_STAFF_COLORS[staff]}`}>{staff}</span>
                          {e.is_off ? (
                            <span className="text-xs text-gray-400">OFF</span>
                          ) : (
                            <div className="flex items-center gap-2 text-sm">
                              <span className="text-gray-900 font-medium">{e.sched_in} – {e.sched_out}</span>
                              {e.role && e.role !== 'normal' && (
                                <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${e.role === 'opener' ? 'bg-yellow-100 text-yellow-700' : 'bg-indigo-100 text-indigo-700'}`}>
                                  {e.role}
                                </span>
                              )}
                              <span className="text-xs text-gray-400">{hoursFromShift(e).toFixed(1)}h</span>
                            </div>
                          )}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── ABSENCES SUB-TAB ── */}
      {subTab === 'absences' && (
        <div className="space-y-3">
          <button onClick={() => setShowAbsForm(v => !v)}
            className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold px-4 py-2 rounded-xl transition">
            + Record Absence
          </button>

          {showAbsForm && (
            <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
              <p className="text-sm font-semibold text-gray-900">New Absence</p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className={labelCls}>Staff</label>
                  <select value={absForm.staff_name} onChange={e => setAbsForm(f => ({...f, staff_name: e.target.value}))} className={inputCls}>
                    {ROTA_STAFF.map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Type</label>
                  <select value={absForm.absence_type} onChange={e => setAbsForm(f => ({...f, absence_type: e.target.value}))} className={inputCls}>
                    {ABSENCE_TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase()+t.slice(1)}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>From</label>
                  <input type="date" value={absForm.start_date} onChange={e => setAbsForm(f => ({...f, start_date: e.target.value}))} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>To</label>
                  <input type="date" value={absForm.end_date} onChange={e => setAbsForm(f => ({...f, end_date: e.target.value}))} className={inputCls} />
                </div>
              </div>
              <div>
                <label className={labelCls}>Reason (optional)</label>
                <input value={absForm.reason} onChange={e => setAbsForm(f => ({...f, reason: e.target.value}))} placeholder="Details…" className={inputCls} />
              </div>
              <div className="flex gap-2">
                <button onClick={saveAbsence} disabled={savingAbs || !absForm.start_date || !absForm.end_date}
                  className="flex-1 bg-green-600 hover:bg-green-500 disabled:opacity-40 text-white text-sm font-semibold rounded-xl py-3 transition">
                  {savingAbs ? 'Saving…' : 'Save'}
                </button>
                <button onClick={() => setShowAbsForm(false)} className="px-4 py-3 bg-gray-100 text-gray-600 text-sm font-semibold rounded-xl">Cancel</button>
              </div>
            </div>
          )}

          {absences.length === 0 && !showAbsForm && (
            <p className="py-8 text-center text-gray-400 text-sm">No absences recorded.</p>
          )}
          <div className="space-y-2">
            {absences.map(a => (
              <div key={a.id} className="bg-white border border-gray-200 rounded-xl p-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${ROTA_STAFF_COLORS[a.staff_name] ?? 'bg-gray-100 text-gray-600'}`}>{a.staff_name}</span>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 capitalize`}>{a.absence_type}</span>
                  </div>
                  <p className="text-sm text-gray-800 mt-1 font-medium">{fmtDate(a.start_date)} → {fmtDate(a.end_date)}</p>
                  {a.reason && <p className="text-xs text-gray-400 mt-0.5">{a.reason}</p>}
                </div>
                <button onClick={() => deleteAbsence(a.id)}
                  className="shrink-0 text-xs text-red-500 font-semibold px-2.5 py-1 rounded-lg bg-red-50 hover:bg-red-100 transition">
                  Remove
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── ANALYTICS TAB ────────────────────────────────────────────────────────────

function AnalyticsTab() {
  const [recent, setRecent] = useState<RecentRow[]>([])
  const [loading, setLoading] = useState(true)
  const [activeStaff, setActiveStaff] = useState<string[]>(STAFF)

  useEffect(() => {
    fetch('/api/staff-times/today')
      .then(r => r.json())
      .then(d => {
        const rows = Array.isArray(d.recent) ? d.recent : []
        setRecent(rows.filter((r: RecentRow) => r.staff_name !== '__shop_open__'))
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  function toggleStaff(s: string) {
    setActiveStaff(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s])
  }

  const filtered = useMemo(() => recent.filter(r => activeStaff.includes(r.staff_name)), [recent, activeStaff])

  function durationMins(r: RecentRow): number | null {
    if (!r.actual_in || !r.actual_out) return null
    const i = parseTimeMins(r.actual_in), o = parseTimeMins(r.actual_out)
    if (i == null || o == null) return null
    return o >= i ? o - i : (o + 1440) - i
  }

  // Monthly hours per staff
  const monthlyData = useMemo(() => {
    const map: Record<string, Record<string, number>> = {}
    for (const r of filtered) {
      const mins = durationMins(r)
      if (mins == null) continue
      const monthKey = r.work_date.slice(0, 7)
      if (!map[monthKey]) map[monthKey] = {}
      map[monthKey][r.staff_name] = (map[monthKey][r.staff_name] ?? 0) + mins / 60
    }
    return Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, vals]) => ({
        month: monthKeyShort(month),
        ...Object.fromEntries(STAFF.map(s => [s, Math.round((vals[s] ?? 0) * 10) / 10])),
      }))
  }, [filtered])

  // All-time leaderboard
  const leaderboard = useMemo(() => {
    const totals: Record<string, number> = {}
    for (const r of filtered) {
      const mins = durationMins(r)
      if (mins == null) continue
      totals[r.staff_name] = (totals[r.staff_name] ?? 0) + mins
    }
    return STAFF.filter(s => activeStaff.includes(s))
      .map(s => ({ staff: s, hours: Math.round((totals[s] ?? 0) / 6) / 10 }))
      .sort((a, b) => b.hours - a.hours)
  }, [filtered, activeStaff])

  // Tenure: first recorded date per staff (proxy -- app doesn't track hire dates)
  const tenure = useMemo(() => {
    const first: Record<string, string> = {}
    for (const r of recent) {
      if (!activeStaff.includes(r.staff_name)) continue
      if (!first[r.staff_name] || r.work_date < first[r.staff_name]) first[r.staff_name] = r.work_date
    }
    const today = new Date().toISOString().slice(0, 10)
    return STAFF.filter(s => activeStaff.includes(s)).map(s => {
      const since = first[s]
      return { staff: s, since, months: since ? monthsBetween(since, today) : 0 }
    }).sort((a, b) => b.months - a.months)
  }, [recent, activeStaff])

  // Punctuality: average clock-in time
  const punctuality = useMemo(() => {
    const sums: Record<string, { total: number; count: number }> = {}
    for (const r of filtered) {
      const i = parseTimeMins(r.actual_in)
      if (i == null) continue
      if (!sums[r.staff_name]) sums[r.staff_name] = { total: 0, count: 0 }
      sums[r.staff_name].total += i
      sums[r.staff_name].count++
    }
    return STAFF.filter(s => activeStaff.includes(s)).map(s => {
      const v = sums[s]
      return { staff: s, avgMins: v ? Math.round(v.total / v.count) : null }
    }).sort((a, b) => (a.avgMins ?? 9999) - (b.avgMins ?? 9999))
  }, [filtered, activeStaff])

  // Day-of-week pattern (avg hours, combined across active staff)
  const dowData = useMemo(() => {
    const sums = Array(7).fill(0), counts = Array(7).fill(0)
    for (const r of filtered) {
      const mins = durationMins(r)
      if (mins == null) continue
      const dow = new Date(r.work_date + 'T00:00:00').getDay()
      sums[dow] += mins; counts[dow]++
    }
    const labels = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
    return labels.map((l, i) => ({ day: l, avgHours: counts[i] ? Math.round((sums[i] / counts[i] / 60) * 10) / 10 : 0 }))
  }, [filtered])

  // Busiest month highlight
  const busiestMonth = useMemo(() => {
    if (!monthlyData.length) return null
    let best = monthlyData[0], bestTotal = -1
    for (const row of monthlyData as any[]) {
      const total = STAFF.reduce((s, st) => s + (row[st] ?? 0), 0)
      if (total > bestTotal) { bestTotal = total; best = row }
    }
    return { month: (best as any).month, total: Math.round(bestTotal * 10) / 10 }
  }, [monthlyData])

  if (loading) return <div className="py-10 text-center text-gray-400">Loading…</div>

  return (
    <div className="space-y-5">
      {/* Staff filter chips */}
      <div className="flex gap-1.5 flex-wrap">
        {STAFF.map(s => (
          <button key={s} onClick={() => toggleStaff(s)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold capitalize transition
              ${activeStaff.includes(s) ? 'text-white' : 'bg-gray-100 text-gray-400'}`}
            style={activeStaff.includes(s) ? { backgroundColor: STAFF_CHART_COLORS[s] } : {}}>
            {s}
          </button>
        ))}
      </div>

      {recent.length === 0 ? (
        <p className="py-10 text-center text-gray-400 text-sm">No staff time data yet.</p>
      ) : (
        <>
          {/* Busiest month highlight */}
          {busiestMonth && (
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
              <p className="text-xs text-blue-600 font-medium">Busiest month</p>
              <p className="text-lg font-bold text-gray-900">{busiestMonth.month} — {busiestMonth.total}h total</p>
            </div>
          )}

          {/* Monthly hours comparison */}
          <div className="bg-white border border-gray-200 rounded-xl p-3">
            <p className="text-sm font-semibold text-gray-700 mb-2">Monthly Hours — Staff Comparison</p>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={monthlyData} margin={{ left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip wrapperStyle={{ fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                {STAFF.filter(s => activeStaff.includes(s)).map(s => (
                  <Bar key={s} dataKey={s} fill={STAFF_CHART_COLORS[s]} radius={[3, 3, 0, 0]} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* All-time leaderboard */}
          <div className="bg-white border border-gray-200 rounded-xl p-3">
            <p className="text-sm font-semibold text-gray-700 mb-2">All-Time Total Hours</p>
            <ResponsiveContainer width="100%" height={Math.max(120, leaderboard.length * 44)}>
              <BarChart data={leaderboard} layout="vertical" margin={{ left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis dataKey="staff" type="category" tick={{ fontSize: 12 }} width={70} className="capitalize" />
                <Tooltip wrapperStyle={{ fontSize: 12 }} formatter={(v: any) => [`${v}h`, 'Total']} />
                <Bar dataKey="hours" radius={[0, 4, 4, 0]}>
                  {leaderboard.map(row => <Cell key={row.staff} fill={STAFF_CHART_COLORS[row.staff]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Tenure */}
          <div className="bg-white border border-gray-200 rounded-xl p-3">
            <p className="text-sm font-semibold text-gray-700 mb-0.5">Tenure (Active Since)</p>
            <p className="text-[11px] text-gray-400 mb-2">Based on earliest recorded clock-in — not necessarily actual hire date.</p>
            <div className="space-y-2">
              {tenure.map(t => (
                <div key={t.staff} className="flex items-center justify-between text-sm">
                  <span className="font-semibold capitalize" style={{ color: STAFF_CHART_COLORS[t.staff] }}>{t.staff}</span>
                  <span className="text-gray-600">{t.since ? fmtDate(t.since) : '—'}</span>
                  <span className="text-gray-400 text-xs">{t.months} mo{t.months !== 1 ? 's' : ''}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Punctuality */}
          <div className="bg-white border border-gray-200 rounded-xl p-3">
            <p className="text-sm font-semibold text-gray-700 mb-0.5">Punctuality — Average Clock-In Time</p>
            <p className="text-[11px] text-gray-400 mb-2">Lower (earlier) is better. Based on all recorded clock-ins.</p>
            <div className="space-y-2">
              {punctuality.map(p => (
                <div key={p.staff} className="flex items-center justify-between text-sm">
                  <span className="font-semibold capitalize" style={{ color: STAFF_CHART_COLORS[p.staff] }}>{p.staff}</span>
                  <span className="text-gray-700 font-medium">{p.avgMins != null ? minsTo12h(p.avgMins) : '—'}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Day-of-week pattern */}
          <div className="bg-white border border-gray-200 rounded-xl p-3">
            <p className="text-sm font-semibold text-gray-700 mb-2">Average Hours by Day of Week</p>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={dowData} margin={{ left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip wrapperStyle={{ fontSize: 12 }} formatter={(v: any) => [`${v}h`, 'Avg']} />
                <Bar dataKey="avgHours" fill="#6366f1" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </div>
  )
}

// ── ASSIGNMENTS TAB ──────────────────────────────────────────────────────────

const VIOLATION_TYPES: { type: string; label: string; auto: boolean }[] = [
  { type: 'missing_days', label: 'Sales Receipts not entered', auto: true },
  { type: 'no_cash', label: 'Walk-in receipts missing cash counted', auto: true },
  { type: 'cost_gte_sell', label: 'Cost Price ≥ Selling Price', auto: true },
  { type: 'no_staff_times', label: 'Days with no staff times recorded', auto: true },
  { type: 'unchecked_cab', label: 'Weeks with no Cash at Bank confirmation', auto: true },
  { type: 'no_group', label: 'Items with no group assigned', auto: false },
  { type: 'duplicates', label: 'Possible duplicate item pairs', auto: false },
  { type: 'not_in_inventory', label: 'Item names not found in inventory', auto: false },
]

function AssignmentsTab({ role, username }: { role: string; username: string }) {
  const [assignments, setAssignments] = useState<Record<string, string>>({})
  const [settings, setSettings] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [error, setError] = useState('')
  const canManage = ['owner', 'manager'].includes(role) || username === 'joe'

  function load() {
    fetch('/api/violations/assignments')
      .then(r => r.json())
      .then(d => { setAssignments(d.assignments ?? {}); setSettings(d.settings ?? {}); setLoading(false) })
      .catch(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  async function assign(type: string, staff: string) {
    setSaving(type); setError('')
    const label = VIOLATION_TYPES.find(v => v.type === type)?.label ?? type
    const res = await fetch('/api/violations/assignments', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ violation_type: type, staff_name: staff || null, violation_label: label }),
    })
    setSaving(null)
    if (res.ok) {
      setAssignments(prev => ({ ...prev, [type]: staff }))
    } else {
      const d = await res.json().catch(() => ({}))
      setError(d.error || 'Could not save assignment. Please try again.')
    }
  }

  async function saveSettings() {
    setSaving('__settings__'); setError('')
    const res = await fetch('/api/violations/assignments', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ settings }),
    })
    setSaving(null)
    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      setError(d.error || 'Could not save settings. Please try again.')
    }
  }

  if (loading) return <div className="py-10 text-center text-gray-400">Loading…</div>

  return (
    <div className="space-y-4">
      {error && <p className="text-xs text-red-500 font-medium">{error}</p>}
      <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
        <p className="text-sm font-semibold text-gray-700">Auto-Penalty Settings</p>
        <p className="text-[11px] text-gray-400">
          Once an assigned violation has been outstanding this many days, the assigned staff member is
          automatically penalized the points below. Checked daily.
        </p>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className={labelCls}>Threshold (days)</label>
            <input type="number" min="1" disabled={!canManage}
              value={settings.threshold_days ?? '3'}
              onChange={e => setSettings(s => ({ ...s, threshold_days: e.target.value }))}
              className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Points per violation</label>
            <input type="number" min="1" disabled={!canManage}
              value={settings.points_per_violation ?? '5'}
              onChange={e => setSettings(s => ({ ...s, points_per_violation: e.target.value }))}
              className={inputCls} />
          </div>
        </div>
        {canManage && (
          <button onClick={saveSettings} disabled={saving === '__settings__'}
            className="bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-sm font-semibold rounded-xl px-4 py-2 transition">
            {saving === '__settings__' ? 'Saving…' : 'Save Settings'}
          </button>
        )}
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden divide-y divide-gray-100">
        {VIOLATION_TYPES.map(v => (
          <div key={v.type} className="flex items-center justify-between gap-3 px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm text-gray-800">{v.label}</p>
              {!v.auto && <p className="text-[10px] text-gray-400">No auto-penalty — no fixed date to measure against.</p>}
            </div>
            <select value={assignments[v.type] ?? ''} disabled={!canManage || saving === v.type}
              onChange={e => assign(v.type, e.target.value)}
              className="shrink-0 bg-gray-100 border border-gray-200 rounded-lg px-2 py-1.5 text-sm capitalize outline-none focus:ring-1 focus:ring-blue-400 disabled:opacity-60">
              <option value="">Unassigned</option>
              {STAFF.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
            </select>
          </div>
        ))}
      </div>

      {!canManage && <p className="text-[11px] text-gray-400 text-center">Only the owner or manager can change assignments.</p>}
    </div>
  )
}

// ── MAIN ──────────────────────────────────────────────────────────────────────

function StaffClientInner({ role, username, embedded }: { role: string; username: string; embedded?: boolean }) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  const initialTab = searchParams.get('tab')
  const initialVtab = searchParams.get('vtab')
  const [tab, setTabState] = useState<Tab>(TABS.includes(initialTab as Tab) ? (initialTab as Tab) : 'Times')
  const [vtab, setVtabState] = useState<ViolationView>(
    VIOLATION_VIEWS.includes(initialVtab as ViolationView) ? (initialVtab as ViolationView) : 'Disciplinary'
  )

  const setTab = useCallback((t: Tab) => {
    setTabState(t)
    const p = new URLSearchParams(searchParams.toString())
    p.set('tab', t)
    if (t !== 'Violations') p.delete('vtab')
    router.replace(`${pathname}?${p.toString()}`, { scroll: false })
  }, [searchParams, router, pathname])

  const setVtab = useCallback((v: ViolationView) => {
    setVtabState(v)
    const p = new URLSearchParams(searchParams.toString())
    p.set('tab', 'Violations')
    p.set('vtab', v)
    router.replace(`${pathname}?${p.toString()}`, { scroll: false })
  }, [searchParams, router, pathname])

  return (
    <div className="py-4 space-y-4">
      {!embedded && <h1 className="text-xl font-bold text-gray-900">Staff</h1>}

      <div className="flex gap-1 overflow-x-auto pb-1">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`shrink-0 flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl text-[10px] font-semibold transition
              ${tab === t ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
            {TAB_ICONS[t]}
            {t}
          </button>
        ))}
      </div>

      {tab === 'Times' && <TimesTab username={username} role={role} />}
      {tab === 'Payslips' && <PayslipsTab />}
      {tab === 'Violations' && <ViolationsTab role={role} username={username} vtab={vtab} setVtab={setVtab} />}
      {tab === 'Role' && <RoleTab role={role} username={username} />}
      {tab === 'Rota' && <RotaTab />}
      {tab === 'Analytics' && <AnalyticsTab />}
      {tab === 'Assignments' && <AssignmentsTab role={role} username={username} />}
    </div>
  )
}

export default function StaffClient({ role, username, embedded }: { role: string; username: string; embedded?: boolean }) {
  return (
    <Suspense fallback={<div className="py-10 text-center text-gray-400">Loading…</div>}>
      <StaffClientInner role={role} username={username} embedded={embedded} />
    </Suspense>
  )
}
