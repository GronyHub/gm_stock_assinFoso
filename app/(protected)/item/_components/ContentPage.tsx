'use client'
import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { fmtDate } from '@/lib/fmtDate'

type Content = { key: string; body: string; updated_by: string | null; updated_at: string | null }

// Lightweight rendering for content written with a small markdown-like
// convention (# / ## headings, - bullets, blank-line paragraphs) -- no
// markdown library needed for this.
function RenderedBody({ body }: { body: string }) {
  const lines = body.split('\n')
  const blocks: React.ReactNode[] = []
  let bullets: string[] = []
  function flushBullets(key: string) {
    if (bullets.length === 0) return
    blocks.push(
      <ul key={key} className="list-disc pl-5 space-y-0.5 my-1.5">
        {bullets.map((b, i) => <li key={i} className="text-[12px] text-gray-800 leading-snug">{b}</li>)}
      </ul>
    )
    bullets = []
  }
  lines.forEach((line, i) => {
    const trimmed = line.trim()
    if (trimmed.startsWith('## ')) {
      flushBullets(`b${i}`)
      blocks.push(<p key={i} className="text-[12px] font-bold text-gray-800 mt-3 mb-0.5">{trimmed.slice(3)}</p>)
    } else if (trimmed.startsWith('# ')) {
      flushBullets(`b${i}`)
      blocks.push(<p key={i} className="text-sm font-bold text-gray-900 mt-4 mb-1 first:mt-0">{trimmed.slice(2)}</p>)
    } else if (trimmed.startsWith('- ')) {
      bullets.push(trimmed.slice(2))
    } else if (trimmed === '') {
      flushBullets(`b${i}`)
    } else {
      flushBullets(`b${i}`)
      blocks.push(<p key={i} className="text-[12px] text-gray-700 leading-snug my-1">{trimmed}</p>)
    }
  })
  flushBullets('final')
  return <div>{blocks}</div>
}

export default function ContentPage({ contentKey, title }: { contentKey: string; title: string }) {
  const { data: session } = useSession()
  const role = (session?.user as any)?.role ?? 'staff'
  const username = (session?.user as any)?.username ?? session?.user?.name ?? ''
  const canEdit = role === 'owner' || username.toLowerCase() === 'joe'

  const [content, setContent] = useState<Content | null>(null)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function load() {
    fetch(`/api/manage-content?key=${contentKey}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setContent(d) })
      .catch(() => {})
  }

  useEffect(() => { load() }, [contentKey])

  function startEdit() {
    setDraft(content?.body ?? '')
    setEditing(true)
    setError('')
  }

  async function save() {
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/manage-content', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: contentKey, body: draft }),
      })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error ?? 'Failed to save') }
      setEditing(false)
      load()
    } catch (e: any) {
      setError(e.message ?? 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  if (!content) return <p className="text-[11px] text-gray-400 text-center py-6">Loading…</p>

  return (
    <div className="py-2 px-2 space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">{title}</p>
        {canEdit && !editing && (
          <button onClick={startEdit} className="text-[10px] font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded hover:bg-blue-100">
            Edit
          </button>
        )}
      </div>

      {editing ? (
        <div className="bg-white border border-gray-200 rounded-lg p-2 space-y-1.5">
          <textarea value={draft} onChange={e => setDraft(e.target.value)} rows={16}
            className="w-full bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 text-xs font-mono outline-none focus:ring-1 focus:ring-blue-400 resize-y" />
          <p className="text-[9px] text-gray-400">Use &quot;# Heading&quot;, &quot;## Subheading&quot;, and &quot;- bullet&quot; lines for formatting.</p>
          {error && <p className="text-[10px] text-red-500">{error}</p>}
          <div className="flex items-center gap-1.5">
            <button onClick={save} disabled={saving}
              className="flex-1 text-xs font-semibold px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white transition">
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button onClick={() => setEditing(false)} disabled={saving}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 transition">
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg px-3 py-2">
          <RenderedBody body={content.body} />
          {content.updated_by && content.updated_at && (
            <p className="text-[9px] text-gray-400 mt-3 pt-2 border-t border-gray-100">
              Last updated by <span className="capitalize">{content.updated_by}</span> · {fmtDate(content.updated_at)}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
