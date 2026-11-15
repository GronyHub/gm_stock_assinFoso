'use client'
import { useEffect, useRef, useState } from 'react'

// Shrinks a photo in the browser before upload (phones send 5-10 MB photos): longest side `max` px, JPEG.
async function shrink(file: File, max = 1400, quality = 0.85): Promise<File> {
  try {
    const bmp = await createImageBitmap(file)
    const sc = Math.min(1, max / Math.max(bmp.width, bmp.height))
    const c = document.createElement('canvas'); c.width = Math.round(bmp.width * sc); c.height = Math.round(bmp.height * sc)
    c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height)
    const blob: Blob | null = await new Promise(r => c.toBlob(r, 'image/jpeg', quality))
    return blob ? new File([blob], 'photo.jpg', { type: 'image/jpeg' }) : file
  } catch { return file }
}

type Match = { title: string; thumb: string; full: string; page: string; licence: string; author: string }

// One photo for an item. Three ways to add or change it: take a photo with the phone's camera, upload one from the device,
// or find a free photo on Wikimedia Commons (nothing is attached until someone taps "Use this photo").
export default function ItemPicture({ itemId, name, group }: { itemId: number; name?: string; group?: string | null }) {
  const [url, setUrl] = useState<string | null | undefined>(undefined)
  const [credit, setCredit] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const camera = useRef<HTMLInputElement>(null)
  const device = useRef<HTMLInputElement>(null)
  const [finder, setFinder] = useState(false)
  const [q, setQ] = useState(name ?? '')
  const [matches, setMatches] = useState<Match[] | null>(null)
  const [searching, setSearching] = useState(false)
  useEffect(() => {
    setUrl(undefined)
    fetch(`/api/items/${itemId}/picture`).then(r => r.json()).then(d => { setUrl(d?.image_url ?? null); setCredit(d?.image_credit ?? null) }).catch(() => setUrl(null))
  }, [itemId])
  async function upload(f: File) {
    setBusy(true); setErr('')
    try {
      const fd = new FormData()
      fd.append('file', await shrink(f))
      fd.append('thumb', await shrink(f, 360, 0.8))   // the small copy the Live tiles use
      const r = await fetch(`/api/items/${itemId}/picture`, { method: 'POST', body: fd }); const d = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(d.error ?? 'Could not save the photo')
      setUrl(d.image_url); setCredit(null)
    } catch (e) { setErr((e as Error).message) }
    setBusy(false)
  }
  async function remove() {
    if (!confirm('Remove this item\'s photo?')) return
    setBusy(true); await fetch(`/api/items/${itemId}/picture`, { method: 'DELETE' }).catch(() => {}); setUrl(null); setCredit(null); setBusy(false)
  }
  async function search() {
    setSearching(true); setErr(''); setMatches(null)
    try {
      const r = await fetch(`/api/items/photo-finder?q=${encodeURIComponent(q.trim())}&group=${encodeURIComponent(group ?? '')}`); const d = await r.json()
      if (!r.ok) throw new Error(d?.error ?? 'Search failed')
      setMatches(Array.isArray(d?.matches) ? d.matches.slice(0, 8) : [])
    } catch (e) { setErr((e as Error).message) }
    setSearching(false)
  }
  async function useMatch(m: Match) {
    setBusy(true); setErr('')
    try {
      const r = await fetch(`/api/items/${itemId}/picture/web`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: m.full, thumb: m.thumb, page: m.page, licence: m.licence, author: m.author }) })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(d.error ?? 'Could not attach the photo')
      setUrl(d.image_url); setCredit(d.image_credit ?? null); setFinder(false); setMatches(null)
    } catch (e) { setErr((e as Error).message) }
    setBusy(false)
  }
  const btn = 'rounded px-2.5 py-1 text-[12px] font-bold disabled:opacity-40'
  return (
    <div className="border-b border-gray-200 bg-white px-3 py-2">
      <div className="flex items-center gap-3">
        <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-gray-200 bg-gray-50 text-[12px] text-gray-400">
          {url ? <img src={url} alt="" className="h-full w-full object-cover" /> : url === undefined ? '…' : 'No photo'}
        </div>
        <div className="space-y-1">
          <p className="text-[12px] font-semibold text-gray-600">Item photo</p>
          <div className="flex flex-wrap gap-1.5">
            <button type="button" disabled={busy} onClick={() => camera.current?.click()} className={`${btn} bg-blue-600 text-white`}>{busy ? 'Saving…' : '📷 Take photo'}</button>
            <button type="button" disabled={busy} onClick={() => device.current?.click()} className={`${btn} bg-gray-100 text-gray-800`}>Upload</button>
            <button type="button" disabled={busy} onClick={() => { setFinder(f => !f); if (!finder && !matches) void search() }} className={`${btn} bg-gray-100 text-gray-800`}>Find on web</button>
            {url && <button type="button" disabled={busy} onClick={() => void remove()} className={`${btn} bg-red-50 text-red-700`}>Remove</button>}
          </div>
          {credit && <p className="max-w-[260px] truncate text-[12px] text-gray-400" title={credit}>Photo: {credit.split(' · http')[0]}</p>}
          {err && <p className="text-[12px] text-red-600">{err}</p>}
        </div>
        <input ref={camera} type="file" accept="image/*" capture="environment" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) void upload(f); e.target.value = '' }} />
        <input ref={device} type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) void upload(f); e.target.value = '' }} />
      </div>
      {finder && (
        <div className="mt-2 space-y-2 rounded-lg border border-amber-200 bg-amber-50 p-2">
          <p className="text-[12px] font-bold text-amber-900">Free photos from Wikimedia Commons. Check the photo shows this item before you use it.</p>
          <div className="flex gap-1.5">
            <input value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') void search() }} placeholder="What to search for"
              className="min-w-0 flex-1 rounded border border-gray-300 bg-white px-2 py-1 text-[12px]" />
            <button type="button" disabled={searching || !q.trim()} onClick={() => void search()} className={`${btn} bg-amber-600 text-white`}>{searching ? 'Searching…' : 'Search'}</button>
          </div>
          {matches && matches.length === 0 && <p className="text-[12px] text-gray-600">No photos found. Try fewer or different words, or take a photo yourself.</p>}
          <div className="grid grid-cols-2 gap-2">
            {(matches ?? []).map(m => (
              <div key={m.full} className="space-y-1 rounded border border-gray-200 bg-white p-1">
                <img src={m.thumb} alt="" loading="lazy" className="h-24 w-full rounded object-cover" />
                <p className="truncate text-[11px] text-gray-500" title={`${m.author} · ${m.licence}`}>{m.author || 'Unknown'} · {m.licence}</p>
                <button type="button" disabled={busy} onClick={() => void useMatch(m)} className={`${btn} w-full bg-green-600 text-white`}>Use this photo</button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
