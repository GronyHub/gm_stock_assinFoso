'use client'
import { useMemo, useState } from 'react'
import { TOPICS } from '../item/_components/TrainingGuideModal'

const OWNER_GROUPS = new Set(['Development Setup', 'Troubleshooting', 'Hosting & Infrastructure', 'Design with Claude AI'])
const OWNER_IDS = new Set(['bills-tab'])
export const isOwnerTopic = (t: { id: string; group: string }) => OWNER_GROUPS.has(t.group) || OWNER_IDS.has(t.id)

// How To (every staff member) and Owner Guide (owner and Joe only): the former Handbook's topics, on two pages.
export default function GuideClient({ mode }: { mode: 'howto' | 'owner' }) {
  const [query, setQuery] = useState('')
  const [activeId, setActiveId] = useState<string | null>(null)
  const topics = useMemo(() => TOPICS.filter(t => (mode === 'owner') === isOwnerTopic(t)), [mode])
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return q ? topics.filter(t => t.title.toLowerCase().includes(q) || t.keywords.includes(q) || t.group.toLowerCase().includes(q)) : topics
  }, [query, topics])
  const grouped = useMemo(() => {
    const m = new Map<string, typeof topics>()
    for (const t of filtered) { if (!m.has(t.group)) m.set(t.group, []); m.get(t.group)!.push(t) }
    return Array.from(m.entries())
  }, [filtered])
  const picked = activeId ? topics.find(t => t.id === activeId) ?? null : null
  const active = picked ?? filtered[0] ?? null

  return (
    <div className="mx-auto max-w-4xl px-3 pb-24 pt-3">
      <div className="mb-2 flex items-center gap-2">
        <a href="/item" className="text-sm text-gray-500">&larr; Back to app</a>
        <h1 className="ml-2 mr-auto text-xl font-bold text-[#14213D]">{mode === 'owner' ? 'Owner Guide' : 'How To'}</h1>
      </div>
      <p className="mb-2 text-xs text-gray-500">{mode === 'owner' ? 'For the owner and Joe only: setup, hosting, troubleshooting and designing with Claude.' : 'How to do things in the app, step by step. Ask a manager if you are stuck.'}</p>
      <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search this guide" className="mb-3 w-full rounded-xl border border-gray-300 p-2.5 text-sm" />
      <div className="flex gap-3">
        <div className={`${picked ? 'hidden sm:block' : 'block'} w-full shrink-0 sm:w-64`}>
          {grouped.length === 0 && <p className="py-6 text-center text-sm text-gray-400">No topics match.</p>}
          {grouped.map(([g, ts]) => (
            <div key={g} className="mb-3">
              <p className="px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-gray-400">{g}</p>
              {ts.map(t => <button key={t.id} type="button" onClick={() => setActiveId(t.id)} className={`block w-full rounded-lg px-2 py-1.5 text-left text-sm ${active?.id === t.id ? 'bg-blue-50 font-semibold text-blue-700' : 'text-gray-700 hover:bg-gray-50'}`}>{t.title}</button>)}
            </div>
          ))}
        </div>
        <div className={`${picked ? 'block' : 'hidden sm:block'} min-w-0 flex-1`}>
          {active && (
            <div className="max-w-xl space-y-3">
              <button type="button" onClick={() => setActiveId(null)} className="text-xs font-semibold text-blue-600 sm:hidden">&larr; All topics</button>
              <h2 className="text-lg font-bold text-gray-900">{active.title}</h2>
              {active.body}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
