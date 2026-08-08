'use client'
import { useState, useEffect } from 'react'

type Law = { id: number; text: string; created_at: string }

// The fixed rules for this page, as a real list -- each one its own row
// (page_laws table) instead of one freeform textarea, so PageToolIcons can
// badge the page with how many laws it actually has. Notes (PageLawsNote)
// stays a single textarea -- only Law changed shape.
export default function PageLawsList({ scopeKey, onChange }: { scopeKey: string; onChange?: () => void }) {
  const [laws, setLaws] = useState<Law[]>([])
  const [loading, setLoading] = useState(true)
  const [text, setText] = useState('')
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editText, setEditText] = useState('')

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

  if (loading) return <div className="py-6 text-center text-gray-400 text-xs">Loading…</div>

  return (
    <div className="space-y-2">
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

      {laws.length === 0 ? (
        <p className="text-[11px] text-gray-400 text-center py-6">No laws yet.</p>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg divide-y divide-gray-50">
          {laws.map((l, i) => (
            <div key={l.id} className="px-2.5 py-2 flex items-start gap-2">
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
                  <p className="min-w-0 flex-1 text-[12px] text-gray-800" style={{ wordBreak: 'break-word' }}>{l.text}</p>
                  <button onClick={() => startEdit(l)} title="Edit" className="shrink-0 text-gray-300 hover:text-gray-600">✎</button>
                  <button onClick={() => remove(l.id)} className="shrink-0 text-gray-300 hover:text-red-500 font-bold leading-none">×</button>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
