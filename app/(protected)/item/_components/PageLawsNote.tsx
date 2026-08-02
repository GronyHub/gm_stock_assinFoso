'use client'
import { useState, useEffect } from 'react'

// A blank, editable notes box scoped to one page (own row in page_notes,
// keyed by the same scopeKey DynamicTasksSection uses) -- separate from the
// formal Company Laws content, just a quick place to jot page-specific
// rules/reminders.
export default function PageLawsNote({ scopeKey }: { scopeKey: string }) {
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    fetch(`/api/page-notes?scopeKey=${encodeURIComponent(scopeKey)}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { setNotes(d?.notes ?? ''); setLoading(false) })
      .catch(() => setLoading(false))
  }, [scopeKey])

  async function save() {
    setSaving(true)
    setSaved(false)
    const res = await fetch('/api/page-notes', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scopeKey, notes }),
    })
    setSaving(false)
    if (res.ok) { setSaved(true); setTimeout(() => setSaved(false), 1500) }
  }

  if (loading) return <div className="py-6 text-center text-gray-400 text-xs">Loading…</div>

  return (
    <div className="space-y-2">
      <p className="text-[10px] text-gray-400">
        Page-specific rules or reminders -- separate from the main Company Laws page.
      </p>
      <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={8}
        placeholder="Write notes/laws for this page…"
        className="w-full bg-gray-100 border border-gray-200 rounded-lg px-2.5 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-400" />
      <button onClick={save} disabled={saving}
        className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-sm font-semibold rounded-xl py-2 transition">
        {saving ? 'Saving…' : saved ? 'Saved ✓' : 'Save'}
      </button>
    </div>
  )
}
