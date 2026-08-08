'use client'
import { useState, useEffect } from 'react'

type Law = { id: number; text: string; created_at: string }

export type FlagLaw = {
  key: string
  label: string
  description?: string
  count: number
  onViewClick?: () => void
}

// The fixed rules for this page, as a real list -- each one its own row
// (page_laws table) instead of one freeform textarea, so PageToolIcons can
// badge the page with how many laws it actually has. Notes (PageLawsNote)
// stays a single textarea -- only Law changed shape. Optional flags prop
// appends flag laws as continuation items after regular editable laws.
export default function PageLawsList({ scopeKey, onChange, flags, isItemsLaws = false }: { scopeKey: string; onChange?: () => void; flags?: FlagLaw[]; isItemsLaws?: boolean }) {
  const [laws, setLaws] = useState<Law[]>([])
  const [loading, setLoading] = useState(true)
  const [text, setText] = useState('')
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editText, setEditText] = useState('')
  const [taskForLaw, setTaskForLaw] = useState<number | null>(null)
  const [taskTitle, setTaskTitle] = useState('')
  const [noteForLaw, setNoteForLaw] = useState<number | null>(null)
  const [noteText, setNoteText] = useState('')

  function load() {
    fetch(`/api/page-laws?scopeKey=${encodeURIComponent(scopeKey)}`)
      .then(r => r.ok ? r.json() : [])
      .then(d => { setLaws(Array.isArray(d) ? d : []); setLoading(false) })
      .catch(() => setLoading(false))
  }
  useEffect(() => { load() }, [scopeKey])

  async function addLaw(e: React.FormEvent) {
    e.preventDefault()
    if (!text.trim() || saving) return
    setSaving(true)
    const res = await fetch('/api/page-laws', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scopeKey, text: text.trim() }),
    })
    setSaving(false)
    if (res.ok) { setText(''); load(); onChange?.() }
  }

  async function remove(id: number) {
    if (!confirm('Delete this law?')) return
    setLaws(prev => prev.filter(l => l.id !== id))
    await fetch(`/api/page-laws/${id}`, { method: 'DELETE' }).catch(() => {})
    onChange?.()
  }

  function startEdit(l: Law) {
    setEditingId(l.id)
    setEditText(l.text)
  }

  async function saveEdit(id: number) {
    const trimmed = editText.trim()
    if (!trimmed) return
    setLaws(prev => prev.map(l => l.id === id ? { ...l, text: trimmed } : l))
    setEditingId(null)
    await fetch(`/api/page-laws/${id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: trimmed }),
    }).catch(() => {})
  }

  async function addTaskForLaw() {
    if (!taskTitle.trim() || taskForLaw === null) return
    await fetch('/api/tasks', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: taskTitle.trim(), submenu: scopeKey, law_id: taskForLaw }),
    }).catch(() => {})
    setTaskTitle('')
    setTaskForLaw(null)
  }

  async function addNoteForLaw() {
    if (noteForLaw === null) return
    await fetch('/api/page-notes', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scopeKey, kind: 'note', notes: noteText.trim(), law_id: noteForLaw }),
    }).catch(() => {})
    setNoteText('')
    setNoteForLaw(null)
  }

  if (loading) return <div className="py-6 text-center text-gray-400 text-xs">Loading…</div>

  return (
    <div className={isItemsLaws ? '' : 'space-y-2'}>
      {!isItemsLaws && (
        <>
          <p className="text-[10px] text-gray-400">
            The fixed rules for this page -- rarely change, separate from the main Company Laws page.
          </p>

          <form onSubmit={addLaw} className="flex items-center gap-1.5">
            <input value={text} onChange={e => setText(e.target.value)} placeholder="Add a law…"
              className="flex-1 min-w-0 text-xs bg-gray-100 border border-gray-200 rounded-lg px-2.5 py-1.5 outline-none focus:ring-2 focus:ring-blue-400" />
            <button type="submit" disabled={saving || !text.trim()}
              className="shrink-0 text-xs font-semibold px-3 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 transition">
              {saving ? '…' : 'Add'}
            </button>
          </form>
        </>
      )}

      {laws.length === 0 && (!flags || flags.length === 0) ? (
        <p className={`text-[11px] text-gray-400 text-center py-6 ${isItemsLaws ? '' : ''}`}>No laws yet.</p>
      ) : (
        <div className={`bg-white ${isItemsLaws ? 'divide-y divide-gray-100' : 'border border-gray-200 rounded-lg divide-y divide-gray-50'}`}>
          {laws.map((l, i) => (
            <div key={l.id} className={`flex items-start gap-2 ${isItemsLaws ? 'px-4 py-3' : 'px-2.5 py-2'}`}>
              <span className="shrink-0 text-[10px] font-bold text-gray-300 mt-0.5">{i + 1}</span>
              {editingId === l.id ? (
                <>
                  <input autoFocus value={editText} onChange={e => setEditText(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') saveEdit(l.id)
                      if (e.key === 'Escape') setEditingId(null)
                    }}
                    className="min-w-0 flex-1 text-xs bg-gray-100 border border-gray-300 rounded px-2 py-1 outline-none focus:ring-1 focus:ring-blue-400" />
                  <button onClick={() => saveEdit(l.id)} title="Save"
                    className="shrink-0 text-green-600 hover:text-green-700 px-1 text-xs font-bold">✓</button>
                  <button onClick={() => setEditingId(null)} title="Cancel"
                    className="shrink-0 text-gray-400 hover:text-gray-600 px-1 text-xs font-bold">×</button>
                </>
              ) : (
                <>
                  <div className="min-w-0 flex-1">
                    <p className="text-[12px] text-gray-800" style={{ wordBreak: 'break-word' }}>{l.text}</p>
                    {taskForLaw === l.id ? (
                      <div className="flex gap-1 mt-1">
                        <input autoFocus value={taskTitle} onChange={e => setTaskTitle(e.target.value)} placeholder="Task title…"
                          onKeyDown={e => { if (e.key === 'Enter') addTaskForLaw(); if (e.key === 'Escape') setTaskForLaw(null) }}
                          className="flex-1 min-w-0 text-[10px] bg-gray-100 border border-gray-300 rounded px-2 py-1 outline-none focus:ring-1 focus:ring-blue-400" />
                        <button onClick={addTaskForLaw} title="Save" className="shrink-0 text-green-600 hover:text-green-700 text-xs font-bold">✓</button>
                        <button onClick={() => setTaskForLaw(null)} title="Cancel" className="shrink-0 text-gray-400 hover:text-gray-600 text-xs font-bold">×</button>
                      </div>
                    ) : noteForLaw === l.id ? (
                      <div className="flex flex-col gap-1 mt-1">
                        <textarea autoFocus value={noteText} onChange={e => setNoteText(e.target.value)} placeholder="Note…" rows={2}
                          onKeyDown={e => { if (e.key === 'Escape') setNoteForLaw(null) }}
                          className="flex-1 min-w-0 text-[10px] bg-gray-100 border border-gray-300 rounded px-2 py-1 outline-none focus:ring-1 focus:ring-blue-400 resize-none" />
                        <div className="flex gap-1">
                          <button onClick={addNoteForLaw} title="Save" className="flex-1 text-green-600 hover:text-green-700 text-xs font-bold">Save</button>
                          <button onClick={() => setNoteForLaw(null)} title="Cancel" className="shrink-0 text-gray-400 hover:text-gray-600 text-xs font-bold">×</button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex gap-1.5 mt-1 text-[10px]">
                        <button onClick={() => setTaskForLaw(l.id)} title="Add task for this law" className="text-blue-500 hover:text-blue-600 font-semibold">✓ Task</button>
                        <button onClick={() => setNoteForLaw(l.id)} title="Add note for this law" className="text-amber-500 hover:text-amber-600 font-semibold">📝 Note</button>
                      </div>
                    )}
                  </div>
                  <button onClick={() => startEdit(l)} title="Edit" className="shrink-0 text-gray-300 hover:text-gray-600">✎</button>
                  <button onClick={() => remove(l.id)} className="shrink-0 text-gray-300 hover:text-red-500 font-bold leading-none">×</button>
                </>
              )}
            </div>
          ))}
          {flags && flags.map((f, i) => (
            <div key={f.key} className={`flex items-start gap-2 ${isItemsLaws ? 'px-4 py-3 bg-red-50/30' : 'px-2.5 py-2 bg-gray-50/50'}`}>
              <span className="shrink-0 text-[10px] font-bold text-gray-300 mt-0.5">{laws.length + i + 1}</span>
              <div className="min-w-0 flex-1">
                <p className="text-[12px] text-gray-800">{f.label}</p>
                {f.description && <p className="text-[10px] text-gray-600 mt-0.5">{f.description}</p>}
                <div className="flex items-center gap-1.5 mt-1.5">
                  <span className="text-[10px] bg-red-100 text-red-700 font-bold px-2 py-0.5 rounded">{f.count}</span>
                  {f.onViewClick && (
                    <button onClick={f.onViewClick} className="text-[10px] text-blue-600 font-semibold hover:text-blue-700">
                      View flagged records
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
