'use client'
import { useState, useEffect } from 'react'
import { usePolling } from '@/lib/usePolling'
import { fmtDate } from '@/lib/fmtDate'

type LogEntry = {
  id: number
  log_date: string
  notes: string | null
  photo_url: string | null
  logged_by: string
  created_at: string
}

// One reusable panel for every Grony Manage category that has no existing
// data behind it (Arrangement, Cleanliness, Future, Customer Display, Staff
// Display, Training, Repair Works, Quality Assurance) -- a simple dated log
// staff add notes/photos to, viewable as history over time.
export default function ManageLogPanel({ category, label, icon }: { category: string; label: string; icon: string }) {
  const [entries, setEntries] = useState<LogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [notes, setNotes] = useState('')
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null)

  function load() {
    fetch(`/api/manage-logs?category=${category}`)
      .then(r => r.ok ? r.json() : [])
      .then(d => { setEntries(Array.isArray(d) ? d : []); setLoading(false) })
      .catch(() => setLoading(false))
  }

  useEffect(() => { load() }, [category])
  usePolling(load, 20000)

  async function handleFile(file: File) {
    setUploading(true)
    setError('')
    const fd = new FormData()
    fd.append('file', file)
    try {
      const res = await fetch('/api/announcements/upload', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Upload failed')
      setPhotoUrl(data.url)
    } catch (e: any) {
      setError(e.message ?? 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  async function save() {
    if (!notes.trim() && !photoUrl) { setError('Add a note or a photo'); return }
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/manage-logs', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category, notes: notes.trim() || null, photo_url: photoUrl }),
      })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error ?? 'Failed to save') }
      setNotes('')
      setPhotoUrl(null)
      load()
    } catch (e: any) {
      setError(e.message ?? 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  async function remove(id: number) {
    await fetch(`/api/manage-logs?id=${id}`, { method: 'DELETE' })
    setConfirmDeleteId(null)
    setEntries(prev => prev.filter(e => e.id !== id))
  }

  return (
    <div className="py-2 px-2 space-y-2">
      <div className="bg-white border border-gray-200 rounded-lg px-2.5 py-2 space-y-1.5">
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">{icon} {label}</p>
        <textarea value={notes} onChange={e => setNotes(e.target.value)}
          placeholder={`Notes about ${label.toLowerCase()}…`} rows={2}
          className="w-full bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 text-xs outline-none focus:ring-1 focus:ring-blue-400 resize-none" />
        {photoUrl && (
          <div className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photoUrl} alt="" className="w-12 h-12 rounded object-cover border border-gray-200" />
            <button onClick={() => setPhotoUrl(null)} className="text-[10px] text-red-500 font-semibold">Remove photo</button>
          </div>
        )}
        {error && <p className="text-[10px] text-red-500">{error}</p>}
        <div className="flex items-center gap-1.5">
          <label className="shrink-0 text-[10px] font-semibold px-2 py-1.5 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 transition cursor-pointer">
            {uploading ? 'Uploading…' : '📷 Photo'}
            <input type="file" accept="image/*" capture="environment" className="hidden" disabled={uploading}
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
          </label>
          <button onClick={save} disabled={saving || uploading || (!notes.trim() && !photoUrl)}
            className="flex-1 text-xs font-semibold px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white transition">
            {saving ? 'Saving…' : 'Add Entry'}
          </button>
        </div>
      </div>

      {loading ? (
        <p className="text-[11px] text-gray-400 text-center py-6">Loading…</p>
      ) : entries.length === 0 ? (
        <p className="text-[11px] text-gray-400 text-center py-6">No {label.toLowerCase()} entries yet.</p>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg divide-y divide-gray-50">
          {entries.map(e => (
            <div key={e.id} className="px-2.5 py-1.5 flex items-start gap-2">
              {e.photo_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={e.photo_url} alt="" className="w-10 h-10 rounded object-cover border border-gray-200 shrink-0" />
              )}
              <div className="min-w-0 flex-1">
                <p className="text-[9px] text-gray-400">{fmtDate(e.log_date)} · <span className="capitalize">{e.logged_by}</span></p>
                {e.notes && <p className="text-[11px] text-gray-800 whitespace-pre-wrap leading-snug">{e.notes}</p>}
              </div>
              {confirmDeleteId === e.id ? (
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => remove(e.id)} className="text-[9px] font-bold text-white bg-red-600 rounded px-1.5 py-0.5">Yes</button>
                  <button onClick={() => setConfirmDeleteId(null)} className="text-[9px] font-semibold text-gray-600 bg-gray-100 rounded px-1.5 py-0.5">No</button>
                </div>
              ) : (
                <button onClick={() => setConfirmDeleteId(e.id)} className="shrink-0 text-gray-300 hover:text-red-500 font-bold leading-none">×</button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
