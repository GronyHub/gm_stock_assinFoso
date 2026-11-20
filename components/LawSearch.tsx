'use client'
import { useEffect, useMemo, useState } from 'react'
import { lawPageHref } from '@/lib/lawAreas'

// Search across every law. A result opens that law on its own topic page.
type Law = { id: number; title: string | null; text: string; category: string | null; subcategory: string | null; code?: string | null; status?: string }

const inHub = () => typeof window !== 'undefined' && window.parent !== window
const openPage = (path: string) => { if (inHub()) window.parent.postMessage({ type: 'open-path', path }, window.location.origin); else window.location.href = path }

export default function LawSearch() {
  const [laws, setLaws] = useState<Law[] | null>(null)
  const [q, setQ] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/page-laws', { cache: 'no-store' })
      .then(r => r.json())
      .then(d => { if (Array.isArray(d)) setLaws(d); else setError(d?.error ?? 'Could not load the laws') })
      .catch(() => setError('Could not load the laws'))
  }, [])

  const hits = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (s.length < 2 || !laws) return []
    return laws.filter(l => l.status !== 'retired' && [l.title, l.text, l.category, l.subcategory, l.code].some(v => (v ?? '').toLowerCase().includes(s))).slice(0, 60)
  }, [laws, q])

  return (
    <div className="mx-auto max-w-2xl space-y-3 p-3">
      <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search all laws, for example personal number"
        className="w-full rounded-xl border border-gray-300 p-2.5 text-sm" />
      {error && <p className="text-sm text-red-600">{error}</p>}
      {!laws && !error && <p className="text-sm text-gray-400">Loading…</p>}
      {q.trim().length > 0 && q.trim().length < 2 && <p className="text-[13px] text-gray-500">Type at least two letters.</p>}
      {q.trim().length >= 2 && laws && hits.length === 0 && <p className="text-sm text-gray-500">No law matches “{q.trim()}”.</p>}
      <div className="space-y-2">
        {hits.map(l => (
          <button key={l.id} type="button" onClick={() => openPage(lawPageHref(l.id, null)!)}
            className="block w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-left active:opacity-70">
            <p className="text-[12px] font-bold text-gray-500">{l.category ?? 'No topic yet'}{l.subcategory ? ` › ${l.subcategory}` : ''}{l.status === 'draft' ? ' · draft' : ''}</p>
            <p className="text-[14px] font-semibold text-gray-900">{l.title || l.text.slice(0, 140)}</p>
          </button>
        ))}
      </div>
    </div>
  )
}
