'use client'
import { useState, useEffect } from 'react'
import { fmtDate, daysBetween } from '@/lib/fmtDate'
import CompletedTasksSection from './CompletedTasksSection'

type Task = {
  id: number; title: string; notes: string | null; due_date: string | null
  done: boolean; created_by: string | null; created_at: string; completed_at: string | null
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
  const [showArchive, setShowArchive] = useState(false)

  const [editingId, setEditingId] = useState<number | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editNotes, setEditNotes] = useState('')
  const [editDueDate, setEditDueDate] = useState('')

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

  async function remove(id: number, title: string) {
    if (!confirm(`Delete task "${title}"?`)) return
    setTasks(prev => prev.filter(x => x.id !== id))
    await fetch(`/api/tasks/${id}`, { method: 'DELETE' }).catch(() => {})
  }

  function startEdit(t: Task) {
    setEditingId(t.id)
    setEditTitle(t.title)
    setEditNotes(t.notes ?? '')
    setEditDueDate(t.due_date ?? '')
  }

  async function saveEdit(id: number) {
    const title = editTitle.trim()
    if (!title) return
    const notes = editNotes.trim() || null
    const due_date = editDueDate || null
    setTasks(prev => prev.map(x => x.id === id ? { ...x, title, notes, due_date } : x))
    setEditingId(null)
    await fetch(`/api/tasks/${id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, notes, due_date }),
    }).catch(() => {})
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

      <button onClick={() => setShowArchive(v => !v)}
        className="w-full text-[10px] font-semibold text-blue-600 hover:bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 transition">
        {showArchive ? '← Back to this page' : '🗄 View completed tasks (all pages)'}
      </button>

      {showArchive ? <CompletedTasksSection /> : <>

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
          {visible.map(t => {
            const isEditing = editingId === t.id
            const days = t.done && t.completed_at ? daysBetween(t.created_at, t.completed_at) : null
            return (
              <div key={t.id} className="px-2.5 py-2 flex items-start gap-2">
                <input type="checkbox" checked={t.done} onChange={() => toggle(t)}
                  className="mt-0.5 w-3.5 h-3.5 accent-blue-600 shrink-0" />
                <div className="min-w-0 flex-1">
                  {isEditing ? (
                    <div className="space-y-1.5">
                      <input autoFocus value={editTitle} onChange={e => setEditTitle(e.target.value)} placeholder="Task title *"
                        className="w-full text-xs bg-white border border-gray-300 rounded px-2 py-1.5 outline-none focus:ring-1 focus:ring-blue-400" />
                      <input value={editNotes} onChange={e => setEditNotes(e.target.value)} placeholder="Notes (optional)"
                        className="w-full text-xs bg-white border border-gray-300 rounded px-2 py-1.5 outline-none focus:ring-1 focus:ring-blue-400" />
                      <div className="flex items-center gap-1.5">
                        <input type="date" value={editDueDate} onChange={e => setEditDueDate(e.target.value)}
                          className="text-xs bg-white border border-gray-300 rounded px-2 py-1.5 outline-none focus:ring-1 focus:ring-blue-400" />
                        <button onClick={() => setEditingId(null)}
                          className="ml-auto text-[10px] font-semibold px-2 py-1.5 rounded-lg text-gray-500 hover:bg-gray-100 transition">Cancel</button>
                        <button onClick={() => saveEdit(t.id)} disabled={!editTitle.trim()}
                          className="text-[10px] font-semibold px-2.5 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 transition">Save</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <p className={`text-[12px] font-medium ${t.done ? 'line-through text-gray-400' : 'text-gray-800'}`}>{t.title}</p>
                      {t.notes && <p className="text-[10px] text-gray-400">{t.notes}</p>}
                      {t.due_date && <p className="text-[9px] text-gray-400">Due {fmtDate(t.due_date)}</p>}
                      <p className="text-[9px] text-gray-400">
                        Written {fmtDate(t.created_at)}{t.created_by ? ` by ${t.created_by}` : ''}
                      </p>
                      {t.done && days !== null && (
                        <p className="text-[9px] text-green-600 font-medium">Completed in {days} day{days === 1 ? '' : 's'}</p>
                      )}
                    </>
                  )}
                </div>
                {!isEditing && (
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button onClick={() => startEdit(t)} className="text-gray-300 hover:text-blue-600" title="Edit">✎</button>
                    <button onClick={() => remove(t.id, t.title)} className="text-gray-300 hover:text-red-500 font-bold leading-none">×</button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      </>}
    </div>
  )
}
