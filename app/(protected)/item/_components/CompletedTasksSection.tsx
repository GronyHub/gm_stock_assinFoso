'use client'
import { useEffect, useState } from 'react'
import { fmtDate, daysBetween } from '@/lib/fmtDate'

type Task = {
  id: number; title: string; notes: string | null; due_date: string | null
  submenu: string | null; view: string | null
  done: boolean; created_by: string | null; created_at: string; completed_at: string | null
}

// Global archive of every completed task across every page in the app --
// DynamicTasksSection only ever shows one page's own tasks (scoped by
// submenu), even with "Show done" checked, so a task ticked off on one page
// was never visible anywhere except that same page again. This pulls every
// custom_tasks row with done=true regardless of scope, so completed work
// stays visible in one place instead of scattered across however many
// pages it was written on.
export default function CompletedTasksSection() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)

  function load() {
    fetch('/api/tasks').then(r => r.ok ? r.json() : []).then((all: unknown) => {
      const list = Array.isArray(all) ? (all as Task[]) : []
      setTasks(list.filter(t => t.done).sort((a, b) => {
        const ta = a.completed_at ? new Date(a.completed_at).getTime() : 0
        const tb = b.completed_at ? new Date(b.completed_at).getTime() : 0
        return tb - ta
      }))
      setLoading(false)
    }).catch(() => setLoading(false))
  }
  useEffect(() => { load() }, [])

  async function unComplete(id: number) {
    setTasks(prev => prev.filter(t => t.id !== id))
    await fetch(`/api/tasks/${id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ done: false }),
    }).catch(() => {})
  }

  async function remove(id: number, title: string) {
    if (!confirm(`Delete task "${title}"?`)) return
    setTasks(prev => prev.filter(t => t.id !== id))
    await fetch(`/api/tasks/${id}`, { method: 'DELETE' }).catch(() => {})
  }

  if (loading) return <div className="py-10 text-center text-gray-400 text-sm">Loading…</div>
  if (tasks.length === 0) return <p className="text-[11px] text-gray-400 text-center py-6">No completed tasks yet.</p>

  return (
    <div className="space-y-2">
      <p className="text-[10px] text-gray-400 px-0.5">{tasks.length} completed across all pages</p>
      <div className="bg-white border border-gray-200 rounded-lg divide-y divide-gray-50">
        {tasks.map(t => {
          const days = t.completed_at ? daysBetween(t.created_at, t.completed_at) : null
          return (
            <div key={t.id} className="px-2.5 py-2 flex items-start gap-2">
              <input type="checkbox" checked onChange={() => unComplete(t.id)}
                className="mt-0.5 w-3.5 h-3.5 accent-blue-600 shrink-0 cursor-pointer" title="Mark as not done" />
              <div className="min-w-0 flex-1">
                <p className="text-[12px] font-medium text-gray-500 line-through">{t.title}</p>
                {t.notes && <p className="text-[10px] text-gray-400">{t.notes}</p>}
                <p className="text-[9px] text-gray-400">
                  {t.submenu || 'Unscoped'} · Written {fmtDate(t.created_at)}{t.created_by ? ` by ${t.created_by}` : ''}
                </p>
                {t.completed_at && (
                  <p className="text-[9px] text-green-600 font-medium">
                    Completed {fmtDate(t.completed_at)} · {days} day{days === 1 ? '' : 's'} to complete
                  </p>
                )}
              </div>
              <button onClick={() => remove(t.id, t.title)} className="shrink-0 text-gray-300 hover:text-red-500 font-bold leading-none">×</button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
