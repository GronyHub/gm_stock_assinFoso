'use client'
import { useEffect, useRef, useState, type RefObject } from 'react'

type Info = { page: string; title: string; video_url: string; custom: boolean; can_replace: boolean }

// A page's guide video, shown on its Company Laws tile. The owner and Joe can replace it with their own screen recording
// or go back to the built-in one (see /api/page-guides).
export default function GuideVideo({ page, videoRef, onEnded }: { page: string; videoRef?: RefObject<HTMLVideoElement | null>; onEnded?: () => void }) {
  const [info, setInfo] = useState<Info | null>(null)
  const [upload, setUpload] = useState<{ pct: number } | null>(null)
  const [msg, setMsg] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    let live = true
    fetch(`/api/page-guides?page=${page}`).then(r => r.ok ? r.json() : null).then((d: Info | null) => { if (live && d) setInfo(d) }).catch(() => {})
    return () => { live = false }
  }, [page])

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
        if (xhr.status >= 200 && xhr.status < 300 && info) { setInfo({ ...info, video_url: d.video_url, custom: true }); setMsg('Your recording is now this video.') } else setMsg(d.error ?? 'Upload failed.')
      } catch { setMsg('Upload failed.') }
    }
    xhr.onerror = () => { setUpload(null); setMsg('Upload failed. Check the connection.') }
    xhr.send(fd)
  }
  async function reset() {
    if (!info || !confirm('Go back to the built-in video?')) return
    const r = await fetch(`/api/page-guides?page=${page}`, { method: 'DELETE' })
    if (r.ok) { setInfo({ ...info, custom: false, video_url: `/guides/${page}.mp4` }); setMsg('Back to the built-in video.') }
  }
  if (!info) return null
  return (
    <div className="space-y-1">
      <video ref={videoRef} onEnded={onEnded} key={info.video_url} src={info.video_url} controls playsInline preload="metadata" className="mx-auto max-h-[70vh] w-full max-w-sm rounded-xl bg-black" />
      {info.can_replace && (
        <div className="flex flex-wrap items-center gap-1.5">
          <button type="button" disabled={!!upload} onClick={() => fileRef.current?.click()} className="rounded bg-blue-600 px-2 py-1 text-[12px] font-bold text-white disabled:opacity-40">{upload ? `Uploading ${upload.pct}%…` : 'Replace with my recording'}</button>
          {info.custom && <button type="button" onClick={() => void reset()} className="rounded bg-gray-100 px-2 py-1 text-[12px] font-bold text-gray-700">Use the built-in video</button>}
          {msg && <span className="text-[12px] font-semibold text-blue-700">{msg}</span>}
          <input ref={fileRef} type="file" accept="video/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) replace(f); e.target.value = '' }} />
        </div>
      )}
    </div>
  )
}
