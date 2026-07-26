'use client'
import { useState } from 'react'

// Just the "+ New Task" trigger/form -- the tasks themselves render inline
// under their chosen submenu's blue bar in RoleFlagsTable, right alongside
// the auto-generated violation rows for that submenu, not in a list here.
export default function CustomTasksSection({ submenus, onAdded }: {
  submenus: { label: string }[]
  onAdded: () => void
}) {
  const [showForm, setShowForm] = useState(false)
  const [title, setTitle] = useState('')
  const [notes, setNotes] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [submenu, setSubmenu] = useState(submenus[0]?.label ?? '')
  const [saving, setSaving] = useState(false)

  async function addTask(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim() || !submenu || saving) return
    setSaving(true)
    const res = await fetch('/api/tasks', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, notes, due_date: dueDate || null, submenu }),
    })
    setSaving(false)
    if (res.ok) {
      setTitle(''); setNotes(''); setDueDate(''); setShowForm(false)
      onAdded()
    } else {
      const d = await res.json().catch(() => ({}))
      alert(d.error || 'Could not save task.')
    }
  }

  return (
    <div className="mb-2">
      <button onClick={() => setShowForm(v => !v)}
        className="w-full text-xs font-semibold px-3 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition">
        {showForm ? '× Close' : '+ New Task'}
      </button>
      {showForm && (
        <form onSubmit={addTask} className="mt-1.5 p-2 space-y-1.5 bg-gray-50 border border-gray-200 rounded-lg">
          <input autoFocus value={title} onChange={e => setTitle(e.target.value)} placeholder="Task title *"
            className="w-full text-xs bg-white border border-gray-300 rounded px-2 py-1.5 outline-none focus:ring-1 focus:ring-blue-400" />
          <select value={submenu} onChange={e => setSubmenu(e.target.value)}
            className="w-full text-xs bg-white border border-gray-300 rounded px-2 py-1.5 outline-none focus:ring-1 focus:ring-blue-400">
            {submenus.map(s => <option key={s.label} value={s.label}>{s.label}</option>)}
          </select>
          <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Notes (optional)"
            className="w-full text-xs bg-white border border-gray-300 rounded px-2 py-1.5 outline-none focus:ring-1 focus:ring-blue-400" />
          <div className="flex items-center gap-1.5">
            <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}
              className="text-xs bg-white border border-gray-300 rounded px-2 py-1.5 outline-none focus:ring-1 focus:ring-blue-400" />
            <button type="submit" disabled={saving || !title.trim()}
              className="ml-auto text-xs font-semibold px-3 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 transition">
              {saving ? 'Saving…' : 'Add'}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
