'use client'
import { useCallback, useEffect, useState } from 'react'
import { lawPageHref } from '@/lib/lawAreas'

// Laws written but not yet approved. Each one is approved on its own topic page, or here with the buttons below, which use
// the same approval as the topic pages (it creates the checklist tasks and stops the tasks they replace).
type Draft = { id: number; title: string | null; text: string; category: string | null; subcategory: string | null; status?: string }

const inHub = () => typeof window !== 'undefined' && window.parent !== window
const openPage = (path: string) => { if (inHub()) window.parent.postMessage({ type: 'open-path', path }, window.location.origin); else window.location.href = path }
const json = { 'Content-Type': 'application/json' }

export default function DraftLaws() {
  const [drafts, setDrafts] = useState<Draft[] | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  const load = useCallback(() => {
    fetch('/api/page-laws', { cache: 'no-store' })
      .then(r => r.json())
      .then(d => { if (Array.isArray(d)) setDrafts(d.filter((l: Draft) => l.status === 'draft')); else setError(d?.error ?? 'Could not load the drafts') })
      .catch(() => setError('Could not load the drafts'))
  }, [])
  useEffect(() => { load() }, [load])

  // Approves every draft in the given topics (one call per topic). Stops at the first refusal and says why.
  async function approveTopics(categories: string[]) {
    setBusy(true); setMsg('')
    let done = 0
    for (const category of categories) {
      const r = await fetch('/api/page-laws/approve', { method: 'POST', headers: json, body: JSON.stringify({ category }) })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) { setMsg(`${category}: ${d.error ?? 'could not approve'}`); break }
      done += Number(d.approved ?? 0)
    }
    setBusy(false)
    setMsg(prev => prev || `Approved ${done} law${done === 1 ? '' : 's'}.`)
    load()
  }

  if (error) return <p className="p-3 text-sm text-red-600">{error}</p>
  if (!drafts) return <p className="p-3 text-sm text-gray-400">Loading…</p>

  const groups = new Map<string, Draft[]>()
  for (const d of drafts) {
    const k = `${d.category ?? 'No topic yet'}${d.subcategory ? ` › ${d.subcategory}` : ''}`
    groups.set(k, [...(groups.get(k) ?? []), d])
  }
  const topics = Array.from(new Set(drafts.map(d => d.category).filter((c): c is string => !!c)))

  return (
    <div className="mx-auto max-w-2xl space-y-3 p-3">
      <div className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-[13px] text-amber-900">
        <p className="font-bold">Drafts to approve: {drafts.length}</p>
        <p>Approving a law creates its tasks. Tap a law to open it on its topic page, or approve here.</p>
        {topics.length > 0 && <button type="button" disabled={busy} onClick={() => void approveTopics(topics)}
          className="mt-2 w-full rounded-lg bg-amber-500 px-3 py-2 text-sm font-bold text-white disabled:opacity-50">{busy ? 'Approving…' : `Approve all drafts (${drafts.length})`}</button>}
        {msg && <p className="mt-2 text-[13px] font-semibold text-gray-800">{msg}</p>}
      </div>
      {drafts.length === 0 && <p className="text-sm text-gray-500">No drafts waiting. Every law is approved.</p>}
      {[...groups.entries()].map(([topic, rows]) => (
        <div key={topic} className="space-y-1.5">
          <p className="text-[12px] font-extrabold uppercase tracking-wide text-gray-500">{topic}</p>
          {rows.map(l => (
            <button key={l.id} type="button" onClick={() => openPage(lawPageHref(l.id, null)!)}
              className="block w-full rounded-xl border border-amber-300 bg-white px-3 py-2 text-left active:opacity-70">
              <p className="text-[14px] font-semibold text-gray-900">{l.title || l.text.slice(0, 120)}</p>
            </button>
          ))}
        </div>
      ))}
    </div>
  )
}
