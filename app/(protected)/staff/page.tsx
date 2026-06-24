'use client'
import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { fmtDate } from '@/lib/fmtDate'

// ── shared helpers ────────────────────────────────────────────────────────────
const STAFF = ['joe', 'bino', 'james', 'rawlings']

const inputCls = 'w-full bg-gray-100 border border-gray-200 rounded-xl px-3 py-2.5 text-base text-gray-900 placeholder-gray-400 outline-none focus:ring-2 focus:ring-blue-400'
const labelCls = 'text-xs text-gray-400 font-medium mb-1 block'

const STAFF_COLORS: Record<string, string> = {
  Joe: 'bg-blue-100 text-blue-700',
  Bino: 'bg-purple-100 text-purple-700',
  James: 'bg-green-100 text-green-700',
  Rawlings: 'bg-orange-100 text-orange-700',
}

// ── TIMES TAB ─────────────────────────────────────────────────────────────────
type RecentRow = { staff_name: string; work_date: string; actual_in: string | null; actual_out: string | null; entered_by: string | null }

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

function groupByDate(rows: RecentRow[]) {
  const map = new Map<string, Record<string, { in: string | null; out: string | null }>>()
  for (const r of rows) {
    if (!map.has(r.work_date)) map.set(r.work_date, {})
    map.get(r.work_date)![r.staff_name] = { in: r.actual_in, out: r.actual_out }
  }
  return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]))
}

function TimesTab() {
  const [all, setAll] = useState<RecentRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/staff-times/today')
      .then(r => r.json())
      .then(d => { setAll(Array.isArray(d.recent) ? d.recent : []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const grouped = groupByDate(all)

  if (loading) return <div className="py-10 text-center text-gray-400">Loading…</div>

  return (
    <div className="space-y-4">
      {/* All Records Table */}
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

      {/* Analytics */}
      <p className="text-sm font-semibold text-gray-700">Analytics</p>
      <div className="space-y-3">
        {STAFF.map(name => {
          const rows = all.filter(r => r.staff_name === name)
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
              <div className="grid grid-cols-3 gap-3 text-xs">
                <div><p className="text-gray-400">Days Present</p><p className="font-semibold">{rows.filter(r => r.actual_in).length}</p></div>
                <div><p className="text-gray-400">Total Hours</p><p className="font-semibold">{totalMins ? minsToHrs(totalMins) : '—'}</p></div>
                <div><p className="text-gray-400">Avg Hours/Day</p><p className="font-semibold">{avgMins ? minsToHrs(avgMins) : '—'}</p></div>
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
type Payslip = {
  id: number; staff_name: string; pay_month: string; payment_period: string | null
  hours_worked: string | null; pay_for_hours: string | null; overtime_hours: string | null
  pay_for_overtime: string | null; longevity_days: string | null; pay_for_longevity: string | null
  duty_allowance: string | null; data_allowance: string | null; ssnit: string | null; total_salary: string | null
}

function fmt(v: string | null) {
  if (!v) return '—'
  const n = parseFloat(v)
  return isNaN(n) ? '—' : `₵${n.toFixed(2)}`
}
function num(v: string | null) {
  if (!v) return '—'
  const n = parseFloat(v)
  return isNaN(n) ? '—' : n.toLocaleString('en-GH', { maximumFractionDigits: 2 })
}
function monthLabel(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-GH', { month: 'long', year: 'numeric' })
}
function PayRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-sm text-gray-500">{label}</span>
      <span className={`text-sm font-semibold ${highlight ? 'text-gray-900' : 'text-gray-600'}`}>{value}</span>
    </div>
  )
}

function PayslipsTab() {
  const [payslips, setPayslips] = useState<Payslip[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Payslip | null>(null)
  const [staffFilter, setStaffFilter] = useState('All')

  useEffect(() => {
    fetch('/api/payslips').then(r => r.json())
      .then(d => { setPayslips(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const staffNames = ['All', ...Array.from(new Set(payslips.map(p => p.staff_name))).sort()]
  const filtered = staffFilter === 'All' ? payslips : payslips.filter(p => p.staff_name === staffFilter)

  if (loading) return <div className="py-10 text-center text-gray-400">Loading…</div>

  return (
    <div className="space-y-4">
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {staffNames.map(s => (
          <button key={s} onClick={() => setStaffFilter(s)}
            className={`shrink-0 px-3 py-1.5 rounded-lg text-sm font-medium transition
              ${staffFilter === s ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            {s}
          </button>
        ))}
      </div>

      {selected && (
        <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${STAFF_COLORS[selected.staff_name] ?? 'bg-gray-100 text-gray-600'}`}>
                  {selected.staff_name}
                </span>
                <span className="text-base font-bold text-gray-900">{monthLabel(selected.pay_month)}</span>
              </div>
              {selected.payment_period && <p className="text-xs text-gray-400 mt-1">{selected.payment_period}</p>}
            </div>
            <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600 text-lg font-bold">×</button>
          </div>
          <div className="border-t border-gray-100 pt-3 space-y-2">
            <PayRow label="Hours worked" value={num(selected.hours_worked)} />
            <PayRow label="Pay for hours" value={fmt(selected.pay_for_hours)} highlight />
            <PayRow label="Overtime hours" value={num(selected.overtime_hours)} />
            <PayRow label="Pay for overtime" value={fmt(selected.pay_for_overtime)} highlight />
            <PayRow label="Longevity days" value={num(selected.longevity_days)} />
            <PayRow label="Pay for longevity" value={fmt(selected.pay_for_longevity)} highlight />
            <PayRow label="Duty allowance" value={fmt(selected.duty_allowance)} highlight />
            <PayRow label="Data allowance" value={fmt(selected.data_allowance)} highlight />
            {selected.ssnit && <PayRow label="SSNIT" value={fmt(selected.ssnit)} />}
          </div>
          <div className="border-t border-gray-200 pt-3 flex justify-between items-center">
            <span className="text-sm font-bold text-gray-700">Total Salary</span>
            <span className="text-xl font-bold text-green-700">{fmt(selected.total_salary)}</span>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {filtered.length === 0 && <p className="py-10 text-center text-gray-400 text-sm">No payslips found.</p>}
        {filtered.map(p => (
          <button key={p.id} onClick={() => setSelected(p === selected ? null : p)}
            className={`w-full text-left rounded-xl border p-3 transition
              ${selected?.id === p.id ? 'border-blue-400 bg-blue-50' : 'border-gray-200 bg-white hover:border-gray-300'}`}>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <span className={`shrink-0 text-xs font-semibold px-2.5 py-0.5 rounded-full ${STAFF_COLORS[p.staff_name] ?? 'bg-gray-100 text-gray-600'}`}>
                  {p.staff_name}
                </span>
                <span className="text-sm font-medium text-gray-800 truncate">{monthLabel(p.pay_month)}</span>
              </div>
              <span className="shrink-0 text-sm font-bold text-gray-900">{fmt(p.total_salary)}</span>
            </div>
            {p.payment_period && <p className="text-xs text-gray-400 mt-1">{p.payment_period}</p>}
          </button>
        ))}
      </div>
    </div>
  )
}

// ── VIOLATIONS TAB ────────────────────────────────────────────────────────────
const SEVERITY_COLORS: Record<string, string> = {
  minor: 'bg-yellow-100 text-yellow-700',
  moderate: 'bg-orange-100 text-orange-700',
  serious: 'bg-red-100 text-red-600',
}

type Violation = {
  id: number; staff_name: string; violation: string; details: string | null
  severity: string; recorded_by: string | null; created_at: string
}

function ViolationsTab({ role }: { role: string }) {
  const [violations, setViolations] = useState<Violation[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ staff_name: STAFF[0], violation: '', details: '', severity: 'minor' })
  const [saving, setSaving] = useState(false)
  const [staffFilter, setStaffFilter] = useState('All')

  useEffect(() => {
    fetch('/api/staff/violations').then(r => r.json())
      .then(d => { setViolations(Array.isArray(d) ? d : []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  async function submit() {
    if (!form.violation.trim()) return
    setSaving(true)
    const res = await fetch('/api/staff/violations', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    setSaving(false)
    if (res.ok) {
      const row = await res.json()
      setViolations(prev => [row, ...prev])
      setForm({ staff_name: STAFF[0], violation: '', details: '', severity: 'minor' })
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

  const canManage = ['owner', 'manager'].includes(role)
  const filtered = staffFilter === 'All' ? violations : violations.filter(v => v.staff_name.toLowerCase() === staffFilter.toLowerCase())

  if (loading) return <div className="py-10 text-center text-gray-400">Loading…</div>

  return (
    <div className="space-y-4">
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
                {STAFF.map(s => <option key={s} value={s} className="capitalize">{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
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
              </div>
              {role === 'owner' && (
                <button onClick={() => remove(v.id)} className="text-xs text-red-400 hover:text-red-600 font-semibold shrink-0">Delete</button>
              )}
            </div>
            <p className="text-sm font-semibold text-gray-900">{v.violation}</p>
            {v.details && <p className="text-xs text-gray-500">{v.details}</p>}
            <p className="text-xs text-gray-400">
              {new Date(v.created_at).toLocaleString('en-GH', { timeZone: 'Africa/Accra', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })}
              {v.recorded_by ? ` · ${v.recorded_by}` : ''}
            </p>
          </div>
        ))
      }
    </div>
  )
}

// ── ROLE TAB ──────────────────────────────────────────────────────────────────
type AppUser = { id: number; username: string; display_name: string; email: string | null; role: string }

function RoleTab({ sessionRole }: { sessionRole: string }) {
  const [users, setUsers] = useState<AppUser[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<number | null>(null)

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

  if (sessionRole !== 'owner') {
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
      {users.map(u => (
        <div key={u.id} className="bg-white border border-gray-200 rounded-xl p-3 flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900">{u.display_name}</p>
            <p className="text-xs text-gray-400">@{u.username}{u.email ? ` · ${u.email}` : ''}</p>
          </div>
          <select
            value={u.role}
            onChange={e => changeRole(u, e.target.value)}
            disabled={saving === u.id}
            className="shrink-0 text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-gray-700 outline-none focus:ring-1 focus:ring-blue-400 disabled:opacity-50">
            <option value="staff">Staff</option>
            <option value="manager">Manager</option>
            <option value="owner">Owner</option>
          </select>
          <span className={`shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full ${ROLE_COLORS[u.role] ?? 'bg-gray-100 text-gray-500'}`}>
            {saving === u.id ? '…' : u.role}
          </span>
        </div>
      ))}
    </div>
  )
}

// ── MAIN PAGE ─────────────────────────────────────────────────────────────────
const TABS = ['Times', 'Payslips', 'Violations', 'Role'] as const
type Tab = typeof TABS[number]

export default function StaffPage() {
  const { data: session } = useSession()
  const role = (session?.user as any)?.role ?? 'staff'
  const [tab, setTab] = useState<Tab>('Times')

  return (
    <div className="py-4 space-y-4">
      <h1 className="text-xl font-bold">Staff</h1>

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto pb-1">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`shrink-0 px-4 py-2 rounded-xl text-sm font-semibold transition
              ${tab === t ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            {t}
          </button>
        ))}
      </div>

      {tab === 'Times' && <TimesTab />}
      {tab === 'Payslips' && <PayslipsTab />}
      {tab === 'Violations' && <ViolationsTab role={role} />}
      {tab === 'Role' && <RoleTab sessionRole={role} />}
    </div>
  )
}
