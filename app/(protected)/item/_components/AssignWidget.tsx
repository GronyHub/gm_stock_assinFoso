'use client'
import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { ASSIGNABLE_VIOLATIONS, ASSIGNABLE_STAFF } from './violationAssignments'

// A small self-contained "who's responsible for this" control -- drop one
// into any page that owns a violation type (Sales, Items, CAB, Staff Times)
// instead of routing everyone through one central Assignments screen. Each
// instance fetches/saves independently since it's the only one on most
// pages; on pages with several (Sales has 4), the duplicate GETs are cheap
// and simpler than threading shared state through files that don't
// otherwise need it.
export default function AssignWidget({ type }: { type: string }) {
  const { data: session } = useSession()
  const role = (session?.user as any)?.role ?? 'staff'
  const username = (session?.user as any)?.username ?? session?.user?.name ?? ''
  const canManage = ['owner', 'manager'].includes(role) || username === 'joe'
  const label = ASSIGNABLE_VIOLATIONS.find(v => v.type === type)?.label ?? type

  const [assignee, setAssignee] = useState('')
  const [deadline, setDeadline] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch('/api/violations/assignments').then(r => r.json()).then(d => {
      setAssignee(d.assignments?.[type] ?? '')
      setDeadline(d.deadlines?.[type] ?? '')
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [type])

  async function save(nextAssignee: string, nextDeadline: string) {
    setSaving(true)
    const res = await fetch('/api/violations/assignments', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ violation_type: type, staff_name: nextAssignee || null, violation_label: label, deadline: nextDeadline || null }),
    })
    setSaving(false)
    if (res.ok) { setAssignee(nextAssignee); setDeadline(nextDeadline) }
  }

  if (loading) return null

  return (
    <div className="flex items-center gap-2 flex-wrap bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5 text-[11px]">
      <span className="text-gray-500 font-semibold shrink-0">Assigned:</span>
      {canManage ? (
        <select value={assignee} disabled={saving} onChange={e => save(e.target.value, deadline)}
          className="bg-white border border-gray-200 rounded-lg px-1.5 py-1 text-[11px] capitalize outline-none focus:ring-1 focus:ring-blue-400">
          <option value="">Unassigned</option>
          {ASSIGNABLE_STAFF.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
        </select>
      ) : (
        <span className="capitalize font-medium text-gray-700">{assignee || 'Unassigned'}</span>
      )}
      {canManage && (
        <input type="date" value={deadline} disabled={saving || !assignee} onChange={e => save(assignee, e.target.value)}
          title="Deadline -- overdue triggers auto-penalty"
          className="bg-white border border-gray-200 rounded-lg px-1.5 py-1 text-[11px] outline-none focus:ring-1 focus:ring-blue-400 disabled:opacity-50" />
      )}
      {!canManage && deadline && <span className="text-gray-400">due {deadline}</span>}
    </div>
  )
}
