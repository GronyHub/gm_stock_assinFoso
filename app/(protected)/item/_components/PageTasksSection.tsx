'use client'
import { useState, useEffect } from 'react'

type CustomTask = {
  id: number
  title: string
  notes: string | null
  due_date: string | null
  submenu: string | null
  done: boolean
}

// Custom checklist tasks (created here, tagged to this exact page) used to
// only be viewable/completable on the now-removed Cash Tasks/Manage Tasks
// pages (RoleFlagsTable's blue bars, one per submenu). Since every
// auto-detected flag type already moved to its own page, this gives custom
// tasks the same treatment -- each page owns and shows only its own tasks,
// tagged by the exact submenu label passed in (must match a real entry in
// item/page.tsx's cashSubmenus/manageSubmenus/staffSubmenus).
export default function PageTasksSection({ submenu }: { submenu: string }) {
  const [tasks, setTasks] = useState<CustomTask[] | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [title, setTitle] = useState('')
  const [notes, setNotes] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [saving, setSaving] = useState(false)

  function load() {
    fetch('/api/tasks').then(r => r.ok ? r.json() : []).then(d => {
      setTasks(Array.isArray(d) ? d.filter((t: CustomTask) => t.submenu === submenu) : [])
    }).catch(() => setTasks([]))
  }
  useEffect(() => { load() }, [submenu])

  async function addTask(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim() || saving) return
    setSaving(true)
    const res = await fetch('/api/tasks', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: title.trim(), notes: notes.trim() || null, due_date: dueDate || null, submenu, view: null }),
    })
    setSaving(false)
    if (res.ok) { setTitle(''); setNotes(''); setDueDate(''); setShowForm(false); load() }
  }

  async function toggle(task: CustomTask) {
    setTasks(prev => prev ? prev.map(t => t.id === task.id ? { ...t, done: !t.done } : t) : prev)
    await fetch(`/api/tasks/${task.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ done: !task.done }),
    }).catch(() => {})
  }

  async function remove(id: number) {
    setTasks(prev => prev ? prev.filter(t => t.id !== id) : prev)
    await fetch(`/api/tasks/${id}`, { method: 'DELETE' }).catch(() => {})
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-2.5 space-y-1.5">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">📋 Tasks</p>
        <button onClick={() => setShowForm(v => !v)}
          className="text-[9px] font-semibold px-2 py-0.5 rounded bg-blue-50 text-blue-600 hover:bg-blue-100 transition">
          {showForm ? '× Close' : '+ New'}
        </button>
      </div>
      {showForm && (
        <form onSubmit={addTask} className="space-y-1.5 bg-gray-50 border border-gray-200 rounded-lg p-2">
          <input autoFocus value={title} onChange={e => setTitle(e.target.value)} placeholder="Task title *"
            className="w-full text-xs bg-white border border-gray-300 rounded px-2 py-1.5 outline-none focus:ring-1 focus:ring-blue-400" />
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
      {tasks === null ? (
        <p className="text-[10px] text-gray-400 py-1">Loading…</p>
      ) : tasks.length === 0 ? (
        <p className="text-[10px] text-gray-400 py-1">No tasks.</p>
      ) : (
        <div className="divide-y divide-gray-100">
          {tasks.map(t => (
            <div key={t.id} className="flex items-start gap-2 py-1.5">
              <input type="checkbox" checked={t.done} onChange={() => toggle(t)} className="mt-0.5 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className={`text-[11px] font-semibold ${t.done ? 'line-through text-gray-400' : 'text-gray-800'}`}>{t.title}</p>
                {t.notes && <p className="text-[10px] text-gray-400">{t.notes}</p>}
                {t.due_date && <p className="text-[9px] text-gray-400">due {t.due_date}</p>}
              </div>
              <button onClick={() => remove(t.id)} className="shrink-0 text-gray-300 hover:text-red-500 font-bold leading-none">×</button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
