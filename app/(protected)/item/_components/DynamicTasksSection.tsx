'use client'
import { useState, useEffect } from 'react'
import { fmtDate } from '@/lib/fmtDate'

type Task = {
  id: number; title: string; notes: string | null; due_date: string | null
  done: boolean; created_by: string | null; created_at: string
}

// A simple to-do list scoped to one dynamic Grony Manage tab -- reuses the
// existing custom_tasks table (see /api/tasks), keyed by `scopeKey` in its
// `submenu` column so each tab's tasks stay separate without needing a new
// table. No cadence/assignee/auto-penalty yet -- that's the bigger
// "standards" system being designed separately; this is just a checklist.
export default function DynamicTasksSection({ scopeKey }: { scopeKey: string }) {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [title, setTitle] = useState('')
  const [notes, setNotes] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [saving, setSaving] = useState(false)
  const [showDone, setShowDone] = useState(false)

  function load() {
    fetch('/api/tasks').then(r => r.ok ? r.json() : []).then((all: unknown) => {
      setTasks(Array.isArray(all) ? (all as Task[]).filter((t: any) => t.submenu === scopeKey) : [])
      setLoading(false)
    }).catch(() => setLoading(false))
  }
  useEffect(() => { load() }, [scopeKey])

  async function addTask(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim() || saving) return
    setSaving(true)
    const res = await fetch('/api/tasks', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: title.trim(), notes: notes.trim() || null, due_date: dueDate || null, submenu: scopeKey, view: '' }),
    })
    setSaving(false)
    if (res.ok) { setTitle(''); setNotes(''); setDueDate(''); setShowForm(false); load() }
  }

  async function toggle(t: Task) {
    setTasks(prev => prev.map(x => x.id === t.id ? { ...x, done: !x.done } : x))
    await fetch(`/api/tasks/${t.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ done: !t.done }),
    }).catch(() => {})
  }

  async function remove(id: number) {
    setTasks(prev => prev.filter(x => x.id !== id))
    await fetch(`/api/tasks/${id}`, { method: 'DELETE' }).catch(() => {})
  }

  const visible = showDone ? tasks : tasks.filter(t => !t.done)

  if (loading) return <div className="py-10 text-center text-gray-400 text-sm">Loading…</div>

  return (
    <div className="py-2 px-2 space-y-2">
      <div className="flex items-center gap-2">
        <button onClick={() => setShowForm(v => !v)}
          className="flex-1 text-xs font-semibold px-3 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition">
          {showForm ? '× Close' : '+ New Task'}
        </button>
        <label className="shrink-0 flex items-center gap-1 text-[10px] text-gray-500 cursor-pointer">
          <input type="checkbox" checked={showDone} onChange={e => setShowDone(e.target.checked)} />
          Show done
        </label>
      </div>

      {showForm && (
        <form onSubmit={addTask} className="p-2 space-y-1.5 bg-gray-50 border border-gray-200 rounded-lg">
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

      {visible.length === 0 ? (
        <p className="text-[11px] text-gray-400 text-center py-6">No tasks yet.</p>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg divide-y divide-gray-50">
          {visible.map(t => (
            <div key={t.id} className="px-2.5 py-2 flex items-start gap-2">
              <input type="checkbox" checked={t.done} onChange={() => toggle(t)}
                className="mt-0.5 w-3.5 h-3.5 accent-blue-600 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className={`text-[12px] font-medium ${t.done ? 'line-through text-gray-400' : 'text-gray-800'}`}>{t.title}</p>
                {t.notes && <p className="text-[10px] text-gray-400">{t.notes}</p>}
                {t.due_date && <p className="text-[9px] text-gray-400">Due {fmtDate(t.due_date)}</p>}
              </div>
              <button onClick={() => remove(t.id)} className="shrink-0 text-gray-300 hover:text-red-500 font-bold leading-none">×</button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
