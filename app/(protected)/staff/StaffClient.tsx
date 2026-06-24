'use client'
import { useState, useEffect } from 'react'

type StaffTime = {
  id: number
  staff_name: string
  actual_in: string | null
  actual_out: string | null
  work_date: string
}

type Violation = {
  id: number
  staff_name: string
  violation: string
  details: string | null
  severity: string
  recorded_by: string | null
  created_at: string
}

type User = {
  id: number
  username: string
  display_name: string
  role: string
}

const TABS = ['Times', 'Payslips', 'Violations', 'Role'] as const
type Tab = (typeof TABS)[number]

const SEVERITIES = ['minor', 'moderate', 'serious']

function fmtTime(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString('en-GH', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Accra' })
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GH', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Africa/Accra' })
}

function severityColor(s: string) {
  if (s === 'serious') return 'bg-red-100 text-red-700'
  if (s === 'moderate') return 'bg-orange-100 text-orange-700'
  return 'bg-yellow-100 text-yellow-700'
}

// ─── Times Tab ───────────────────────────────────────────────────────────────
function TimesTab() {
  const [times, setTimes] = useState<StaffTime[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/staff-times/all')
      .then(r => r.json())
      .then(d => { setTimes(Array.isArray(d) ? d : []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  if (loading) return <p className="text-gray-400 text-sm py-8 text-center">Loading…</p>
  if (!times.length) return <p className="text-gray-400 text-sm py-8 text-center">No time records yet.</p>

  // Group by staff
  const byStaff: Record<string, StaffTime[]> = {}
  times.forEach(t => {
    if (!byStaff[t.staff_name]) byStaff[t.staff_name] = []
    byStaff[t.staff_name].push(t)
  })

  return (
    <div className="space-y-6">
      {Object.entries(byStaff).map(([name, rows]) => (
        <div key={name} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
            <span className="font-semibold text-gray-900">{name}</span>
            <span className="text-xs text-gray-400">{rows.length} days</span>
          </div>
          <div className="divide-y divide-gray-100">
            {rows.slice(0, 30).map(r => (
              <div key={r.id} className="grid grid-cols-3 gap-2 px-4 py-2.5 text-sm">
                <span className="text-gray-600">{fmtDate(r.work_date)}</span>
                <span className="text-gray-900">In: {fmtTime(r.actual_in)}</span>
                <span className="text-gray-900">Out: {fmtTime(r.actual_out)}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Payslips Tab ─────────────────────────────────────────────────────────────
function PayslipsTab() {
  return (
    <div className="py-16 text-center text-gray-400 text-sm">
      Payslips coming soon.
    </div>
  )
}

// ─── Violations Tab ───────────────────────────────────────────────────────────
function ViolationsTab({ role }: { role: string }) {
  const [violations, setViolations] = useState<Violation[]>([])
  const [loading, setLoading] = useState(true)
  const [staffName, setStaffName] = useState('')
  const [violation, setViolation] = useState('')
  const [details, setDetails] = useState('')
  const [severity, setSeverity] = useState<string>('minor')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function load() {
    fetch('/api/staff/violations')
      .then(r => r.json())
      .then(d => { setViolations(Array.isArray(d) ? d : []); setLoading(false) })
      .catch(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!staffName || !violation) return
    setSaving(true)
    setError('')
    const res = await fetch('/api/staff/violations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ staff_name: staffName, violation, details, severity }),
    })
    setSaving(false)
    if (res.ok) {
      setStaffName(''); setViolation(''); setDetails(''); setSeverity('minor')
      load()
    } else {
      const d = await res.json().catch(() => ({}))
      setError(d.error || 'Failed to save')
    }
  }

  async function remove(id: number) {
    await fetch('/api/staff/violations', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    load()
  }

  const canRecord = ['owner', 'manager'].includes(role)
  const canDelete = role === 'owner'

  return (
    <div className="space-y-6">
      {canRecord && (
        <form onSubmit={submit} className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
          <h2 className="font-semibold text-gray-900">Record Violation</h2>
          <input
            value={staffName} onChange={e => setStaffName(e.target.value)}
            placeholder="Staff name"
            className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-400"
          />
          <input
            value={violation} onChange={e => setViolation(e.target.value)}
            placeholder="Violation (e.g. Late arrival)"
            className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-400"
          />
          <textarea
            value={details} onChange={e => setDetails(e.target.value)}
            placeholder="Details (optional)"
            rows={2}
            className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-400 resize-none"
          />
          <select
            value={severity} onChange={e => setSeverity(e.target.value)}
            className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-400 bg-white"
          >
            {SEVERITIES.map(s => (
              <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
            ))}
          </select>
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <button type="submit" disabled={saving || !staffName || !violation}
            className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white font-semibold rounded-xl py-3 text-sm transition">
            {saving ? 'Saving…' : 'Record Violation'}
          </button>
        </form>
      )}

      {loading ? (
        <p className="text-gray-400 text-sm text-center py-8">Loading…</p>
      ) : violations.length === 0 ? (
        <p className="text-gray-400 text-sm text-center py-8">No violations recorded.</p>
      ) : (
        <div className="space-y-3">
          {violations.map(v => (
            <div key={v.id} className="bg-white border border-gray-200 rounded-xl p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-gray-900">{v.staff_name}</span>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${severityColor(v.severity)}`}>
                      {v.severity}
                    </span>
                  </div>
                  <p className="text-sm text-gray-700 mt-1">{v.violation}</p>
                  {v.details && <p className="text-xs text-gray-400 mt-0.5">{v.details}</p>}
                  <p className="text-xs text-gray-400 mt-1">
                    Recorded by {v.recorded_by ?? '—'} · {fmtDate(v.created_at)}
                  </p>
                </div>
                {canDelete && (
                  <button onClick={() => remove(v.id)}
                    className="text-red-400 hover:text-red-600 text-sm font-medium transition shrink-0">
                    Delete
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Role Tab ─────────────────────────────────────────────────────────────────
function RoleTab({ role }: { role: string }) {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<number | null>(null)

  useEffect(() => {
    fetch('/api/users')
      .then(r => r.json())
      .then(d => { setUsers(Array.isArray(d) ? d : []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  async function changeRole(id: number, newRole: string) {
    setSaving(id)
    await fetch('/api/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, role: newRole }),
    })
    setSaving(null)
    setUsers(prev => prev.map(u => u.id === id ? { ...u, role: newRole } : u))
  }

  if (role !== 'owner') {
    return <p className="text-gray-400 text-sm text-center py-8">Only the owner can manage roles.</p>
  }

  if (loading) return <p className="text-gray-400 text-sm text-center py-8">Loading…</p>

  return (
    <div className="space-y-3">
      {users.map(u => (
        <div key={u.id} className="bg-white border border-gray-200 rounded-xl px-4 py-3 flex items-center justify-between gap-3">
          <div>
            <p className="font-semibold text-gray-900 text-sm">{u.display_name}</p>
            <p className="text-xs text-gray-400">@{u.username}</p>
          </div>
          <select
            value={u.role}
            onChange={e => changeRole(u.id, e.target.value)}
            disabled={saving === u.id}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm bg-white outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-50"
          >
            <option value="staff">Staff</option>
            <option value="manager">Manager</option>
            <option value="owner">Owner</option>
          </select>
        </div>
      ))}
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function StaffClient({ role }: { role: string }) {
  const [tab, setTab] = useState<Tab>('Times')

  return (
    <div className="py-4 max-w-2xl space-y-4">
      <h1 className="text-xl font-bold text-gray-900">Staff</h1>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200">
        {TABS.map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`pb-2 px-1 text-sm font-semibold border-b-2 transition ${
              tab === t
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'Times' && <TimesTab />}
      {tab === 'Payslips' && <PayslipsTab />}
      {tab === 'Violations' && <ViolationsTab role={role} />}
      {tab === 'Role' && <RoleTab role={role} />}
    </div>
  )
}
