'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useSession } from 'next-auth/react'
import { fmtDate } from '@/lib/fmtDate'
import ManageLogPanel from './ManageLogPanel'

type F = { id: number; name: string; url: string; size: number | null; uploaded_by: string | null; created_at: string }
const mb = (b: number | null) => (b ? (b >= 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`) : '')

// Files tab of Audio Adverts: upload the audio files (jingles, voiceovers, the roadside adverts), play them, name each by the service it advertises. The Jingle Log (one new jingle a month) sits below.
export default function AudioFiles() {
  const { data: session } = useSession()
  const u = (session?.user as { role?: string; username?: string } | undefined)
  const uname = String(u?.username ?? session?.user?.name ?? '').toLowerCase()
  const isOwner = u?.role === 'owner' || uname === 'joe'
  const canAdd = isOwner || uname === 'bino'
  const [files, setFiles] = useState<F[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [editing, setEditing] = useState<{ id: number; name: string } | null>(null)
  const input = useRef<HTMLInputElement | null>(null)
  const load = useCallback(() => { fetch('/api/audio-files', { cache: 'no-store' }).then(r => (r.ok ? r.json() : null)).then(d => setFiles(d?.files ?? [])).catch(() => setFiles([])) }, [])
  useEffect(load, [load])

  async function upload(list: FileList | null) {
    if (!list?.length) return
    setBusy(true); setErr('')
    const fd = new FormData(); Array.from(list).forEach(f => fd.append('file', f))
    const r = await fetch('/api/audio-files', { method: 'POST', body: fd })
    const d = await r.json().catch(() => ({}))
    setBusy(false)
    if (!r.ok) setErr(d.error ?? 'Could not upload')
    if (input.current) input.current.value = ''
    load()
  }
  async function rename() {
    if (!editing) return
    const r = await fetch('/api/audio-files', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editing) })
    if (!r.ok) { setErr((await r.json().catch(() => ({}))).error ?? 'Could not rename'); return }
    setEditing(null); load()
  }
  async function remove(f: F) {
    if (!confirm(`Delete "${f.name}"? The file is removed.`)) return
    await fetch(`/api/audio-files?id=${f.id}`, { method: 'DELETE' }); load()
  }

  return (
    <div className="max-w-3xl space-y-3">
      <div className="rounded-xl border border-gray-200 bg-white p-3">
        <p className="text-[13px] font-semibold text-gray-900">Audio files</p>
        <p className="text-[12px] text-gray-500">Jingles, voiceovers and the roadside adverts. Name each file by the actual service it advertises, never a generic or placeholder name.</p>
        {canAdd && (<div className="mt-2">
          <input ref={input} type="file" accept="audio/*,.mp3,.wav,.m4a,.aac,.ogg,.opus,.amr" multiple className="hidden" onChange={e => void upload(e.target.files)} />
          <button type="button" disabled={busy} onClick={() => input.current?.click()} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{busy ? 'Uploading…' : '⬆ Upload audio files'}</button>
        </div>)}
        {err && <p className="mt-2 text-sm text-red-600">{err}</p>}
      </div>
      {files === null && <p className="py-4 text-center text-sm text-gray-400">Loading…</p>}
      {files && files.length === 0 && <p className="py-4 text-center text-sm text-gray-500">No audio files yet.{canAdd ? ' Upload the first one above.' : ''}</p>}
      {files && files.map(f => (
        <div key={f.id} className="rounded-xl border border-gray-200 bg-white p-3">
          <div className="flex items-start justify-between gap-2">
            {editing?.id === f.id
              ? <div className="flex min-w-0 flex-1 gap-1.5"><input value={editing.name} onChange={e => setEditing({ id: f.id, name: e.target.value })} className="min-w-0 flex-1 rounded-lg border border-gray-300 p-1.5 text-sm" /><button type="button" onClick={() => void rename()} className="rounded-lg bg-green-600 px-3 text-sm font-bold text-white">Save</button><button type="button" onClick={() => setEditing(null)} className="text-sm text-gray-500">✕</button></div>
              : <p className="min-w-0 break-words text-[14px] font-semibold text-gray-900">🎵 {f.name}</p>}
            {editing?.id !== f.id && canAdd && <button type="button" onClick={() => setEditing({ id: f.id, name: f.name })} className="shrink-0 rounded bg-blue-50 px-2 py-1 text-[12px] font-bold text-blue-700">Rename</button>}
          </div>
          <p className="text-[12px] text-gray-500">{[mb(f.size), f.uploaded_by ? `added by ${f.uploaded_by.charAt(0).toUpperCase() + f.uploaded_by.slice(1)}` : '', fmtDate(f.created_at.slice(0, 10))].filter(Boolean).join(' · ')}</p>
          <audio controls preload="none" src={f.url} className="mt-1.5 w-full" />
          {isOwner && <button type="button" onClick={() => void remove(f)} className="mt-1 text-[12px] font-semibold text-red-600">Delete</button>}
        </div>))}
      <details className="rounded-xl border border-gray-200 bg-white">
        <summary className="cursor-pointer px-3 py-2 text-[13px] font-semibold text-gray-900">🎵 Jingle Log: at least one new jingle every month</summary>
        <div className="p-2"><ManageLogPanel category="audio_jingle" label="Jingle Log" icon="🎵" /></div>
      </details>
    </div>
  )
}
