'use client'
import { useState, useEffect } from 'react'

// A blank, editable text box scoped to one page (own row in page_notes,
// keyed by scope_key+kind -- same scope_key namespace DynamicTasksSection's
// custom_tasks uses). Backs both of PageToolIcons' text icons off the same
// component: Law is meant as the fixed rule for this page (rarely edited),
// Notes is the day-to-day running scratchpad -- two separate rows, two
// separate icons, distinguished purely by `kind`.
export default function PageLawsNote({ scopeKey, kind }: { scopeKey: string; kind: 'law' | 'note' }) {
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    fetch(`/api/page-notes?scopeKey=${encodeURIComponent(scopeKey)}&kind=${kind}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { setNotes(d?.notes ?? ''); setLoading(false) })
      .catch(() => setLoading(false))
  }, [scopeKey, kind])

  async function save() {
    setSaving(true)
    setSaved(false)
    const res = await fetch('/api/page-notes', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scopeKey, kind, notes }),
    })
    setSaving(false)
    if (res.ok) { setSaved(true); setTimeout(() => setSaved(false), 1500) }
  }

  if (loading) return <div className="py-6 text-center text-gray-400 text-xs">Loading…</div>

  const isLaw = kind === 'law'

  return (
    <div className="space-y-2">
      <p className="text-[10px] text-gray-400">
        {isLaw
          ? 'The fixed rule for this page -- rarely changes, separate from the main Company Laws page.'
          : 'Day-to-day notes or reminders for this page -- separate from the fixed Law box.'}
      </p>
      <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={8}
        placeholder={isLaw ? 'Write the rule for this page…' : 'Write notes for this page…'}
        className="w-full bg-gray-100 border border-gray-200 rounded-lg px-2.5 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-400" />
      <button onClick={save} disabled={saving}
        className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-sm font-semibold rounded-xl py-2 transition">
        {saving ? 'Saving…' : saved ? 'Saved ✓' : 'Save'}
      </button>
    </div>
  )
}
