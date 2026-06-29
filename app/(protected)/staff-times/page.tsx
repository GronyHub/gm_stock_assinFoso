'use client'
import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { fmtDate } from '@/lib/fmtDate'
import HistoryPanel from '../item/_components/HistoryPanel'

const STAFF = ['joe', 'bino', 'james', 'rawlings']
const TABS = ['Time In', 'Time Out', 'Analytics', 'History'] as const
type Tab = typeof TABS[number]

type Mine = { actual_in: string | null; actual_out: string | null }
type StaffRow = { staff_name: string; actual_in: string | null; actual_out: string | null }
type RecentRow = { id: number; staff_name: string; work_date: string; actual_in: string | null; actual_out: string | null; entered_by: string | null }

// Ghana is UTC+0 always
function ghanaFmt12Now() {
  return new Date().toLocaleString('en-US', {
    timeZone: 'Africa/Accra', hour: 'numeric', minute: '2-digit', hour12: true,
  }).replace(' ', '').toLowerCase()
}

function ghanaToday() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Accra' }) // YYYY-MM-DD
}

function parseTimeMins(t: string | null): number | null {
  if (!t) return null
  const m = t.match(/^(\d+):(\d+)(am|pm)$/i)
  if (!m) return null
  let h = parseInt(m[1]), min = parseInt(m[2])
  const ap = m[3].toLowerCase()
  if (ap === 'pm' && h !== 12) h += 12
  if (ap === 'am' && h === 12) h = 0
  return h * 60 + min
}

function minsToHrsLabel(mins: number) {
  const h = Math.floor(mins / 60), m = Math.round(mins % 60)
  return `${h}h ${m}m`
}

function avgTimeMins(times: (string | null)[]): number | null {
  const vals = times.map(parseTimeMins).filter((v): v is number => v !== null)
  if (!vals.length) return null
  return vals.reduce((a, b) => a + b, 0) / vals.length
}

function minsTo12h(mins: number) {
  let h = Math.floor(mins / 60) % 24, m = Math.round(mins % 60)
  const ap = h >= 12 ? 'pm' : 'am'
  h = h % 12 || 12
  return `${h}:${String(m).padStart(2, '0')}${ap}`
}

const inputCls = 'bg-gray-100 border border-gray-200 rounded-xl px-3 py-2.5 text-base text-gray-900 outline-none focus:ring-2 focus:ring-blue-400'

function TimePicker({ onConfirm, onCancel }: { onConfirm: (t: string) => void; onCancel: () => void }) {
  const now = new Date()
  const gh = new Date(now.toLocaleString('en-US', { timeZone: 'Africa/Accra' }))
  const [hour, setHour] = useState(String(gh.getHours() % 12 || 12))
  const [minute, setMinute] = useState(String(Math.floor(gh.getMinutes() / 5) * 5).padStart(2, '0'))
  const [ampm, setAmpm] = useState(gh.getHours() >= 12 ? 'pm' : 'am')

  return (
    <div className="space-y-4 pt-2">
      <p className="text-sm text-gray-500">Select time (Ghana):</p>
      <div className="flex items-center gap-2">
        <select value={hour} onChange={e => setHour(e.target.value)} className={inputCls}>
          {Array.from({ length: 12 }, (_, i) => i + 1).map(h => <option key={h} value={h}>{h}</option>)}
        </select>
        <span className="text-gray-400 font-bold text-lg">:</span>
        <select value={minute} onChange={e => setMinute(e.target.value)} className={inputCls}>
          {Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, '0')).map(m => <option key={m} value={m}>{m}</option>)}
        </select>
        <select value={ampm} onChange={e => setAmpm(e.target.value)} className={inputCls}>
          <option value="am">AM</option>
          <option value="pm">PM</option>
        </select>
      </div>
      <div className="flex gap-2">
        <button onClick={() => onConfirm(`${hour}:${minute}${ampm}`)}
          className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl py-3 text-sm transition">
          Confirm
        </button>
        <button onClick={onCancel} className="px-4 py-3 bg-gray-100 text-gray-600 rounded-xl text-sm font-semibold">Cancel</button>
      </div>
    </div>
  )
}

function ActionSection({
  action, mine, saving, error, onCurrentTime, onPick, picking, onPickConfirm, onPickCancel,
}: {
  action: 'in' | 'out'
  mine: Mine | null
  saving: boolean
  error: string
  onCurrentTime: () => void
  onPick: () => void
  picking: boolean
  onPickConfirm: (t: string) => void
  onPickCancel: () => void
}) {
  const recorded = action === 'in' ? mine?.actual_in : mine?.actual_out
  const blocked = action === 'out' && !mine?.actual_in
  const color = action === 'in' ? 'bg-green-600 hover:bg-green-500' : 'bg-orange-500 hover:bg-orange-400'

  return (
    <div className="space-y-4">
      {error && <p className="text-red-500 text-sm bg-red-50 rounded-xl px-4 py-3">{error}</p>}
      <div className={`bg-white border rounded-xl p-4 space-y-3 ${blocked ? 'opacity-50' : ''}`}>
        {recorded && (
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">Recorded</p>
            <p className="text-lg font-bold text-gray-900">{recorded}</p>
          </div>
        )}
        {blocked ? (
          <p className="text-sm text-red-400 text-center py-2">Record Time In first.</p>
        ) : picking ? (
          <TimePicker onConfirm={onPickConfirm} onCancel={onPickCancel} />
        ) : (
          <div className="flex gap-2">
            <button onClick={onCurrentTime} disabled={saving}
              className={`flex-1 ${color} disabled:opacity-40 text-white font-semibold rounded-xl py-3 text-sm transition`}>
              {saving ? 'Saving...' : 'Current Time'}
            </button>
            <button onClick={onPick} disabled={saving}
              className="px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-sm font-semibold transition">
              Pick Time
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function groupByDate(rows: RecentRow[]) {
  const map = new Map<string, Record<string, { id: number; in: string | null; out: string | null }>>()
  for (const r of rows) {
    if (!map.has(r.work_date)) map.set(r.work_date, {})
    map.get(r.work_date)![r.staff_name] = { id: r.id, in: r.actual_in, out: r.actual_out }
  }
  return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]))
}


function AnalyticsTab({ all }: { all: RecentRow[] }) {
  const stats = STAFF.map(name => {
    const rows = all.filter(r => r.staff_name === name)
    const daysPresent = rows.filter(r => r.actual_in).length
    const fullDays = rows.filter(r => r.actual_in && r.actual_out)
    const durations = fullDays.map(r => {
      const i = parseTimeMins(r.actual_in), o = parseTimeMins(r.actual_out)
      if (i == null || o == null) return null
      return o >= i ? o - i : (o + 1440) - i // handle overnight
    }).filter((v): v is number => v !== null)
    const totalMins = durations.reduce((a, b) => a + b, 0)
    const avgMins = durations.length ? totalMins / durations.length : null
    const avgIn = avgTimeMins(rows.map(r => r.actual_in))
    const avgOut = avgTimeMins(fullDays.map(r => r.actual_out))
    const allInMins = rows.map(r => parseTimeMins(r.actual_in)).filter((v): v is number => v !== null)
    const allOutMins = fullDays.map(r => parseTimeMins(r.actual_out)).filter((v): v is number => v !== null)
    const earliest = allInMins.length ? Math.min(...allInMins) : null
    const latest = allOutMins.length ? Math.max(...allOutMins) : null
    const lastDay = rows.length ? rows.sort((a, b) => b.work_date.localeCompare(a.work_date))[0].work_date : null
    return { name, daysPresent, fullDays: fullDays.length, totalMins, avgMins, avgIn, avgOut, earliest, latest, lastDay }
  })

  return (
    <div className="space-y-4">
      {stats.map(s => (
        <div key={s.name} className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
          <p className="font-bold text-gray-900 capitalize text-base">{s.name}</p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <div><p className="text-xs text-gray-400">Days Present</p><p className="font-semibold">{s.daysPresent}</p></div>
            <div><p className="text-xs text-gray-400">Full Days (In+Out)</p><p className="font-semibold">{s.fullDays}</p></div>
            <div><p className="text-xs text-gray-400">Total Hours</p><p className="font-semibold">{s.totalMins ? minsToHrsLabel(s.totalMins) : '—'}</p></div>
            <div><p className="text-xs text-gray-400">Avg Hours/Day</p><p className="font-semibold">{s.avgMins ? minsToHrsLabel(s.avgMins) : '—'}</p></div>
            <div><p className="text-xs text-gray-400">Avg Arrival</p><p className="font-semibold">{s.avgIn != null ? minsTo12h(s.avgIn) : '—'}</p></div>
            <div><p className="text-xs text-gray-400">Avg Departure</p><p className="font-semibold">{s.avgOut != null ? minsTo12h(s.avgOut) : '—'}</p></div>
            <div><p className="text-xs text-gray-400">Earliest Arrival</p><p className="font-semibold text-green-700">{s.earliest != null ? minsTo12h(s.earliest) : '—'}</p></div>
            <div><p className="text-xs text-gray-400">Latest Departure</p><p className="font-semibold text-orange-600">{s.latest != null ? minsTo12h(s.latest) : '—'}</p></div>
            <div className="col-span-2"><p className="text-xs text-gray-400">Last Day Worked</p><p className="font-semibold">{s.lastDay ? fmtDate(s.lastDay) : '—'}</p></div>
          </div>
        </div>
      ))}
    </div>
  )
}

function AttendanceHistory() {
  return (
    <div className="space-y-2">
      <p className="text-xs text-gray-400">Showing all time entries recorded by staff — edits, additions, and deletions.</p>
      <HistoryPanel keywords={['time', 'clocked']} />
    </div>
  )
}

export default function StaffTimesPage() {
  const { data: session } = useSession()
  const role = (session?.user as any)?.role
  const username = ((session?.user as any)?.username ?? session?.user?.name ?? '').toLowerCase()
  const isAdmin = role === 'owner' || role === 'admin' || username === 'rawlings' || username === 'grony'

  const [tab, setTab] = useState<Tab>('Time In')
  const [mine, setMine] = useState<Mine | null>(null)
  const [today, setToday] = useState<StaffRow[]>([])
  const [all, setAll] = useState<RecentRow[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [picking, setPicking] = useState(false)
  const [error, setError] = useState('')

  // Admin state
  const [editRow, setEditRow] = useState<RecentRow | null>(null)
  const [editIn, setEditIn] = useState('')
  const [editOut, setEditOut] = useState('')
  const [editSaving, setEditSaving] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)
  const [addStaff, setAddStaff] = useState(STAFF[0])
  const [addDate, setAddDate] = useState('')
  const [addIn, setAddIn] = useState('')
  const [addOut, setAddOut] = useState('')
  const [addSaving, setAddSaving] = useState(false)
  const [addError, setAddError] = useState('')

  function fetchData() {
    Promise.all([
      fetch('/api/staff-times/today').then(r => r.json()),
      fetch('/api/staff-times/all').then(r => r.json()),
    ]).then(([d, allRows]) => {
      setMine(d.mine ?? null)
      setToday(Array.isArray(d.today) ? d.today : [])
      setAll(Array.isArray(allRows) ? allRows : [])
      setLoading(false)
    }).catch(() => setLoading(false))
  }

  useEffect(() => { fetchData() }, [])

  async function saveEdit() {
    if (!editRow) return
    setEditSaving(true)
    const res = await fetch(`/api/staff-times/entry-id/${editRow.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ actual_in: editIn || null, actual_out: editOut || null }),
    })
    setEditSaving(false)
    if (res.ok) {
      const updated: RecentRow = await res.json()
      setAll(prev => prev.map(r => r.id === updated.id ? { ...r, ...updated } : r))
      setEditRow(null)
    }
  }

  async function deleteRow(row: RecentRow) {
    if (!confirm(`Delete time entry for ${row.staff_name} on ${row.work_date}?`)) return
    await fetch(`/api/staff-times/entry-id/${row.id}`, { method: 'DELETE' })
    setAll(prev => prev.filter(r => r.id !== row.id))
  }

  async function addEntry() {
    if (!addDate || !addIn) { setAddError('Date and Time In are required'); return }
    setAddSaving(true); setAddError('')
    const res = await fetch('/api/staff-times/entry', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ staff_name: addStaff, work_date: addDate, actual_in: addIn, actual_out: addOut || null }),
    })
    setAddSaving(false)
    if (res.ok) {
      setShowAddForm(false); setAddIn(''); setAddOut(''); setAddDate('')
      fetchData()
    } else {
      const d = await res.json(); setAddError(d.error ?? 'Failed to save')
    }
  }

  async function record(action: 'in' | 'out', time: string) {
    setSaving(true); setError('')
    const res = await fetch('/api/staff-times/today', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, time }),
    })
    setSaving(false); setPicking(false)
    if (res.ok) { const u = await res.json(); setMine(u); fetchData() }
    else { const d = await res.json(); setError(d.error ?? 'Failed to save') }
  }

  const todayStr = new Date().toLocaleDateString('en-GB', { timeZone: 'Africa/Accra', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const grouped = groupByDate(all)
  const action = tab === 'Time In' ? 'in' : 'out'

  if (loading) return <div className="py-20 text-center text-gray-400">Loading...</div>

  return (
    <div className="py-4 space-y-4">
      <div>
        <h1 className="text-xl font-bold">Attendance</h1>
        <p className="text-xs text-gray-400 mt-0.5">{todayStr}</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
        {TABS.map(t => (
          <button key={t} onClick={() => { setTab(t); setError(''); setPicking(false) }}
            className={`flex-1 text-sm font-semibold py-2 rounded-lg transition
              ${tab === t ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            {t}
          </button>
        ))}
      </div>

      {tab === 'Analytics' ? (
        <AnalyticsTab all={all} />
      ) : tab === 'History' ? (
        <AttendanceHistory />
      ) : (
        <div className="space-y-5">
          <ActionSection
            action={action}
            mine={mine}
            saving={saving}
            error={error}
            picking={picking}
            onCurrentTime={() => record(action, ghanaFmt12Now())}
            onPick={() => setPicking(true)}
            onPickConfirm={t => record(action, t)}
            onPickCancel={() => setPicking(false)}
          />

          {/* Today's snapshot */}
          <div>
            <p className="text-sm font-semibold text-gray-700 mb-2">Today — All Staff</p>
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-3 py-2 text-xs text-gray-500 font-semibold">Staff</th>
                    <th className="text-center px-3 py-2 text-xs text-green-600 font-semibold">Time In</th>
                    <th className="text-center px-3 py-2 text-xs text-orange-500 font-semibold">Time Out</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {STAFF.map(name => {
                    const row = today.find(r => r.staff_name === name)
                    return (
                      <tr key={name}>
                        <td className="px-3 py-2.5 font-medium capitalize text-gray-900">{name}</td>
                        <td className="px-3 py-2.5 text-center text-green-700">{row?.actual_in ?? <span className="text-gray-300">—</span>}</td>
                        <td className="px-3 py-2.5 text-center text-orange-600">{row?.actual_out ?? <span className="text-gray-300">—</span>}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Full history */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold text-gray-700">All Records</p>
              {isAdmin && (
                <button onClick={() => setShowAddForm(v => !v)}
                  className="text-xs font-bold text-blue-600 bg-blue-50 px-3 py-1 rounded-lg hover:bg-blue-100 transition">
                  {showAddForm ? 'Cancel' : '+ Add Entry'}
                </button>
              )}
            </div>

            {isAdmin && showAddForm && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-3 space-y-3">
                <p className="text-xs font-semibold text-blue-700">New Time Entry</p>
                {addError && <p className="text-xs text-red-500">{addError}</p>}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Staff</p>
                    <select value={addStaff} onChange={e => setAddStaff(e.target.value)}
                      className="w-full bg-white border border-gray-200 rounded-lg px-2 py-1.5 text-sm outline-none">
                      {STAFF.map(s => <option key={s} value={s} className="capitalize">{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Date</p>
                    <input type="date" value={addDate} onChange={e => setAddDate(e.target.value)}
                      className="w-full bg-white border border-gray-200 rounded-lg px-2 py-1.5 text-sm outline-none" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Time In</p>
                    <input placeholder="e.g. 8:30am" value={addIn} onChange={e => setAddIn(e.target.value)}
                      className="w-full bg-white border border-gray-200 rounded-lg px-2 py-1.5 text-sm outline-none" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Time Out</p>
                    <input placeholder="e.g. 5:00pm" value={addOut} onChange={e => setAddOut(e.target.value)}
                      className="w-full bg-white border border-gray-200 rounded-lg px-2 py-1.5 text-sm outline-none" />
                  </div>
                </div>
                <button onClick={addEntry} disabled={addSaving}
                  className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-sm font-semibold rounded-lg py-2 transition">
                  {addSaving ? 'Saving…' : 'Save Entry'}
                </button>
              </div>
            )}

            {isAdmin ? (
              /* Admin flat list with edit/delete per row */
              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="text-left px-3 py-2 text-gray-500 font-semibold">Date</th>
                      <th className="text-left px-3 py-2 text-gray-500 font-semibold">Staff</th>
                      <th className="text-center px-2 py-2 text-green-600 font-semibold">In</th>
                      <th className="text-center px-2 py-2 text-orange-500 font-semibold">Out</th>
                      <th className="text-left px-2 py-2 text-gray-400 font-semibold">By</th>
                      <th className="px-2 py-2" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {all.map(r => (
                      <>
                        <tr key={r.id} className="hover:bg-gray-50">
                          <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{fmtDate(r.work_date)}</td>
                          <td className="px-3 py-2 font-medium capitalize text-gray-900">{r.staff_name}</td>
                          <td className="px-2 py-2 text-center text-green-700">{r.actual_in ?? <span className="text-gray-300">—</span>}</td>
                          <td className="px-2 py-2 text-center text-orange-600">{r.actual_out ?? <span className="text-gray-300">—</span>}</td>
                          <td className="px-2 py-2 text-gray-400">{r.entered_by ?? '—'}</td>
                          <td className="px-2 py-2">
                            <div className="flex gap-1 justify-end">
                              <button onClick={() => { setEditRow(r); setEditIn(r.actual_in ?? ''); setEditOut(r.actual_out ?? '') }}
                                className="text-blue-600 bg-blue-50 px-2 py-0.5 rounded text-xs font-semibold hover:bg-blue-100">
                                Edit
                              </button>
                              <button onClick={() => deleteRow(r)}
                                className="text-red-500 bg-red-50 px-2 py-0.5 rounded text-xs font-semibold hover:bg-red-100">
                                Del
                              </button>
                            </div>
                          </td>
                        </tr>
                        {editRow?.id === r.id && (
                          <tr key={`edit-${r.id}`} className="bg-blue-50/60 border-b border-blue-200">
                            <td colSpan={6} className="px-3 py-2">
                              <div className="flex items-end gap-2 flex-wrap">
                                <div>
                                  <p className="text-xs text-gray-400 mb-0.5">Time In</p>
                                  <input value={editIn} onChange={e => setEditIn(e.target.value)}
                                    placeholder="e.g. 8:30am"
                                    className="bg-white border border-gray-200 rounded px-2 py-1 text-xs w-24 outline-none" />
                                </div>
                                <div>
                                  <p className="text-xs text-gray-400 mb-0.5">Time Out</p>
                                  <input value={editOut} onChange={e => setEditOut(e.target.value)}
                                    placeholder="e.g. 5:00pm"
                                    className="bg-white border border-gray-200 rounded px-2 py-1 text-xs w-24 outline-none" />
                                </div>
                                <div className="flex gap-1">
                                  <button onClick={saveEdit} disabled={editSaving}
                                    className="bg-green-600 text-white text-xs font-bold rounded px-3 py-1 disabled:opacity-40">
                                    {editSaving ? '…' : 'Save'}
                                  </button>
                                  <button onClick={() => setEditRow(null)}
                                    className="bg-gray-100 text-gray-600 text-xs font-semibold rounded px-3 py-1">
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              /* Non-admin grouped grid view */
              <div className="bg-white border border-gray-200 rounded-xl overflow-x-auto">
                <table className="w-full text-xs min-w-[520px]">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="text-left px-3 py-2 text-gray-500 font-semibold">Date</th>
                      {STAFF.map(s => (
                        <th key={s} colSpan={2} className="text-center px-2 py-2 text-gray-500 font-semibold capitalize">{s}</th>
                      ))}
                    </tr>
                    <tr className="border-b border-gray-100">
                      <th className="px-3 py-1" />
                      {STAFF.map(s => (
                        <>
                          <th key={s + 'i'} className="text-center px-1 py-1 text-green-600 font-medium">In</th>
                          <th key={s + 'o'} className="text-center px-1 py-1 text-orange-500 font-medium">Out</th>
                        </>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {grouped.map(([date, map]) => (
                      <tr key={date} className="hover:bg-gray-50">
                        <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{fmtDate(date)}</td>
                        {STAFF.map(s => (
                          <>
                            <td key={s + 'i'} className="text-center px-1 py-2 text-green-700">{map[s]?.in ?? <span className="text-gray-200">—</span>}</td>
                            <td key={s + 'o'} className="text-center px-1 py-2 text-orange-600">{map[s]?.out ?? <span className="text-gray-200">—</span>}</td>
                          </>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
