'use client'
import { useState, useEffect } from 'react'
import { fmtOrdinalDate } from '@/lib/fmtDate'

type Task = {
  id: number
  title: string
  notes: string | null
  due_date: string | null
  done: boolean
  created_by: string | null
  created_at: string
}

// User-created tasks -- separate from the auto-generated violation bars
// below (RoleFlagsTable), which come from the app's own flags/checks. This
// is a plain to-do list for anything that isn't already tracked somewhere.
export default function CustomTasksSection() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [showDone, setShowDone] = useState(false)
  const [title, setTitle] = useState('')
  const [notes, setNotes] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [saving, setSaving] = useState(false)

  function load() {
    fetch('/api/tasks').then(r => r.ok ? r.json() : []).then(d => {
      setTasks(Array.isArray(d) ? d : [])
      setLoading(false)
    }).catch(() => setLoading(false))
  }
  useEffect(() => { load() }, [])

  async function addTask(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim() || saving) return
    setSaving(true)
    const res = await fetch('/api/tasks', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, notes, due_date: dueDate || null }),
    })
    setSaving(false)
    if (res.ok) {
      setTitle(''); setNotes(''); setDueDate(''); setShowForm(false)
      load()
    } else {
      const d = await res.json().catch(() => ({}))
      alert(d.error || 'Could not save task.')
    }
  }

  async function toggleDone(t: Task) {
    setTasks(prev => prev.map(x => x.id === t.id ? { ...x, done: !x.done } : x))
    await fetch(`/api/tasks/${t.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ done: !t.done }),
    }).catch(() => {})
    load()
  }

  async function removeTask(id: number) {
    setTasks(prev => prev.filter(x => x.id !== id))
    await fetch(`/api/tasks/${id}`, { method: 'DELETE' }).catch(() => {})
  }

  const visible = showDone ? tasks : tasks.filter(t => !t.done)
  const openCount = tasks.filter(t => !t.done).length

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden mb-2">
      <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 bg-gray-50 border-b border-gray-200">
        <span className="text-[11px] font-semibold text-gray-500">My Tasks{openCount > 0 ? ` (${openCount})` : ''}</span>
        <div className="flex items-center gap-2 shrink-0">
          <label className="flex items-center gap-1 text-[10px] text-gray-500 cursor-pointer">
            <input type="checkbox" checked={showDone} onChange={e => setShowDone(e.target.checked)} />
            Done
          </label>
          <button onClick={() => setShowForm(v => !v)}
            className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-blue-600 text-white hover:bg-blue-500 transition">
            {showForm ? '× Close' : '+ New Task'}
          </button>
        </div>
      </div>
      {showForm && (
        <form onSubmit={addTask} className="p-2 space-y-1.5 bg-gray-50 border-b border-gray-200">
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
      {loading ? (
        <p className="text-xs text-gray-400 text-center py-4">Loading…</p>
      ) : visible.length === 0 ? (
        <p className="text-xs text-gray-400 text-center py-4">
          {showDone ? 'No tasks yet.' : 'No open tasks -- tap "+ New Task" to add one.'}
        </p>
      ) : (
        <div className="divide-y divide-gray-100">
          {visible.map(t => (
            <div key={t.id} className="flex items-start gap-2 px-2.5 py-1.5">
              <input type="checkbox" checked={t.done} onChange={() => toggleDone(t)} className="mt-0.5 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className={`text-xs ${t.done ? 'line-through text-gray-400' : 'text-gray-800'}`}>{t.title}</p>
                {t.notes && <p className="text-[10px] text-gray-400 truncate">{t.notes}</p>}
                {(t.due_date || t.created_by) && (
                  <p className="text-[9px] text-gray-400">
                    {t.due_date && `Due ${fmtOrdinalDate(t.due_date)}`}{t.due_date && t.created_by && ' · '}
                    {t.created_by && <>by <span className="capitalize">{t.created_by}</span></>}
                  </p>
                )}
              </div>
              <button onClick={() => removeTask(t.id)} title="Delete task"
                className="shrink-0 text-gray-300 hover:text-red-500 text-sm leading-none px-1">×</button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
