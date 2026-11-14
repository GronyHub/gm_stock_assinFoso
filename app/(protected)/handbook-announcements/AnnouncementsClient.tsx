'use client'
import { useEffect, useMemo, useState } from 'react'

type Task = { id: number; title: string; notes?: string | null; due_date?: string | null; submenu?: string | null; done: boolean; created_by?: string | null; created_at: string; assigned_to?: string | null; completed_by?: string | null; task_type?: string | null }

// The "Announcements" list the old Handbook showed: every task / announcement saved in the app, grouped by where it was written.
export default function AnnouncementsClient() {
  const [tasks, setTasks] = useState<Task[] | null>(null)
  const [error, setError] = useState('')
  const [show, setShow] = useState<'open' | 'done' | 'all'>('open')
  const [q, setQ] = useState('')
  useEffect(() => {
    fetch('/api/tasks', { cache: 'no-store' }).then(async r => { const d = await r.json(); if (!r.ok || !Array.isArray(d)) throw new Error(d.error ?? 'Could not load'); setTasks(d) }).catch(e => setError((e as Error).message))
  }, [])
  const list = useMemo(() => (tasks ?? []).filter(t => (show === 'all' || (show === 'done') === !!t.done) && (!q.trim() || (t.title + ' ' + (t.notes ?? '') + ' ' + (t.assigned_to ?? '') + ' ' + (t.submenu ?? '')).toLowerCase().includes(q.trim().toLowerCase()))), [tasks, show, q])
  const groups = useMemo(() => {
    const m = new Map<string, Task[]>()
    for (const t of list) { const k = t.submenu || 'General'; if (!m.has(k)) m.set(k, []); m.get(k)!.push(t) }
    return Array.from(m.entries()).sort((a, b) => a[0].localeCompare(b[0]))
  }, [list])
  return (
    <div className="mx-auto max-w-3xl px-3 pb-24 pt-3">
      <div className="mb-2 flex items-center gap-2">
        <a href="/item" className="text-sm text-gray-500">&larr; Back to app</a>
        <h1 className="ml-2 mr-auto text-xl font-bold text-[#14213D]">Tasks &amp; notices</h1>
      </div>
      <p className="mb-2 text-xs text-gray-500">Everything saved as an announcement: tasks and notices saved in the app, grouped by where they were written.</p>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search" className="min-w-0 flex-1 rounded-xl border border-gray-300 p-2 text-sm" />
        {(['open', 'done', 'all'] as const).map(k => <button key={k} type="button" onClick={() => setShow(k)} className={`rounded-full px-3 py-1 text-xs font-bold ${show === k ? 'bg-[#14213D] text-white' : 'bg-gray-100 text-gray-700'}`}>{k === 'open' ? 'Open' : k === 'done' ? 'Done' : 'All'}</button>)}
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {!tasks && !error && <p className="text-sm text-gray-400">Loading…</p>}
      {tasks && <p className="mb-2 text-[12px] text-gray-500">{list.length} of {tasks.length}</p>}
      <div className="space-y-4">
        {groups.map(([g, ts]) => (
          <div key={g}>
            <p className="mb-1 text-xs font-extrabold uppercase tracking-wide text-[#14213D]">{g} ({ts.length})</p>
            <div className="space-y-2">
              {ts.map(t => (
                <div key={t.id} className={`rounded-xl border p-3 ${t.done ? 'border-gray-200 bg-gray-50' : 'border-gray-200 bg-white'}`}>
                  <p className={`text-sm font-semibold ${t.done ? 'text-gray-500 line-through' : 'text-gray-900'}`}>{t.title}</p>
                  {t.notes && <p className="mt-1 whitespace-pre-line text-[13px] text-gray-700">{t.notes}</p>}
                  <p className="mt-1.5 text-[12px] text-gray-500">
                    {t.task_type ? `${t.task_type} · ` : ''}{t.assigned_to ? `For ${t.assigned_to} · ` : ''}{t.due_date ? `Due ${String(t.due_date).slice(0, 10)} · ` : ''}Added {new Date(t.created_at).toLocaleDateString()}{t.created_by ? ` by ${t.created_by}` : ''}{t.done ? ` · Done${t.completed_by ? ` by ${t.completed_by}` : ''}` : ''}
                  </p>
                </div>
              ))}
            </div>
          </div>
        ))}
        {tasks && list.length === 0 && <p className="py-6 text-center text-sm text-gray-400">Nothing here.</p>}
      </div>
    </div>
  )
}
