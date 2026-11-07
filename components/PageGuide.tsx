'use client'
import { useEffect, useRef, useState } from 'react'

type Info = { page: string; title: string; video_url: string; custom: boolean; seen: boolean; can_replace: boolean }

// "How to use this page" video. A ▶ Guide button sits on the page's bar for good; the first time a staff member
// opens the page, a notice offers the guide (Watch / Skip). Either choice is remembered for that staff member, so
// the notice doesn't come back -- the button stays. Owner-level users can replace the built-in guide with their
// own screen recording, or go back to the built-in one. See lib/pageGuides.ts and /api/page-guides.
export default function PageGuide({ page }: { page: string }) {
  const [info, setInfo] = useState<Info | null>(null)
  const [notice, setNotice] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [upload, setUpload] = useState<{ pct: number } | null>(null)
  const [msg, setMsg] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let live = true
    fetch(`/api/page-guides?page=${page}`).then(r => r.ok ? r.json() : null).then((d: Info | null) => {
      if (!live || !d) return
      setInfo(d)
      setNotice(!d.seen)
    }).catch(() => {})
    return () => { live = false }
  }, [page])

  function markSeen() {
    if (info && !info.seen) {
      setInfo({ ...info, seen: true })
      fetch('/api/page-guides', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ page }) }).catch(() => {})
    }
  }
  function watch() { setNotice(false); setPlaying(true); markSeen() }
  function skip() { setNotice(false); markSeen() }

  function replace(file: File) {
    setMsg(''); setUpload({ pct: 0 })
    const fd = new FormData(); fd.append('page', page); fd.append('file', file)
    const xhr = new XMLHttpRequest()
    xhr.open('POST', '/api/page-guides/upload')
    xhr.upload.onprogress = e => { if (e.lengthComputable) setUpload({ pct: Math.round((e.loaded / e.total) * 100) }) }
    xhr.onload = () => {
      setUpload(null)
      try {
        const d = JSON.parse(xhr.responseText)
        if (xhr.status >= 200 && xhr.status < 300 && info) { setInfo({ ...info, video_url: d.video_url, custom: true }); setMsg('Your recording is now this page\'s guide.') }
        else setMsg(d.error ?? 'Upload failed.')
      } catch { setMsg('Upload failed.') }
    }
    xhr.onerror = () => { setUpload(null); setMsg('Upload failed. Check the connection.') }
    xhr.send(fd)
  }
  async function resetToBuiltIn() {
    if (!info || !confirm('Go back to the built-in guide video for this page?')) return
    const r = await fetch(`/api/page-guides?page=${page}`, { method: 'DELETE' })
    if (r.ok) { setInfo({ ...info, custom: false, video_url: `/guides/${page}.mp4` }); setMsg('Back to the built-in guide.') }
  }

  if (!info) return null
  return (
    <>
      <button type="button" onClick={() => setPlaying(true)} title={`How to use ${info.title}: play the guide video`}
        className="shrink-0 rounded-lg bg-indigo-50 px-2 py-1 text-[10px] font-bold text-indigo-700 hover:bg-indigo-100">▶ Guide</button>

      {notice && !playing && (
        <div className="fixed inset-x-0 bottom-4 z-[70] flex justify-center px-3">
          <div className="w-full max-w-sm rounded-xl border border-indigo-200 bg-white p-3 shadow-xl">
            <p className="text-sm font-bold text-gray-900">📺 New to {info.title}?</p>
            <p className="mt-0.5 text-xs text-gray-600">Watch the short guide on what this page is for and how to use it. You can play it again any time with the ▶ Guide button.</p>
            <div className="mt-2 flex gap-2">
              <button type="button" onClick={watch} className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-indigo-700">▶ Watch</button>
              <button type="button" onClick={skip} className="rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-bold text-gray-700 hover:bg-gray-200">Skip</button>
            </div>
          </div>
        </div>
      )}

      {playing && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-3" onClick={() => setPlaying(false)}>
          <div className="w-full max-w-md rounded-xl bg-white p-3" onClick={e => e.stopPropagation()}>
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-sm font-bold text-gray-900">How to use {info.title}</p>
              <button type="button" onClick={() => setPlaying(false)} className="rounded bg-gray-100 px-2 py-0.5 text-xs font-bold text-gray-700">✕ Close</button>
            </div>
            <video key={info.video_url} src={info.video_url} controls autoPlay playsInline className="max-h-[70vh] w-full rounded-lg bg-black" />
            {info.can_replace && (
              <div className="mt-2 space-y-1 border-t border-gray-100 pt-2">
                <div className="flex flex-wrap gap-1.5">
                  <button type="button" disabled={!!upload} onClick={() => fileRef.current?.click()}
                    className="rounded bg-blue-600 px-2 py-1 text-[11px] font-bold text-white disabled:opacity-40">{upload ? `Uploading ${upload.pct}%…` : 'Replace with my recording'}</button>
                  {info.custom && <button type="button" onClick={() => void resetToBuiltIn()} className="rounded bg-gray-100 px-2 py-1 text-[11px] font-bold text-gray-700">Use the built-in guide</button>}
                </div>
                <p className="text-[10px] text-gray-500">{info.custom ? 'Showing your uploaded recording.' : 'Showing the built-in guide.'} Record the page with your phone&apos;s screen recorder, then upload it here (up to 200 MB).</p>
                {msg && <p className="text-[10px] font-semibold text-blue-700">{msg}</p>}
                <input ref={fileRef} type="file" accept="video/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) replace(f); e.target.value = '' }} />
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
