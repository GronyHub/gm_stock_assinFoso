'use client'
import { useEffect, useRef, useState } from 'react'

// Shrinks a photo in the browser before upload (phones send 5-10 MB photos): longest side 1400 px, JPEG.
async function shrink(file: File): Promise<File> {
  try {
    const bmp = await createImageBitmap(file)
    const sc = Math.min(1, 1400 / Math.max(bmp.width, bmp.height))
    const c = document.createElement('canvas'); c.width = Math.round(bmp.width * sc); c.height = Math.round(bmp.height * sc)
    c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height)
    const blob: Blob | null = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.85))
    return blob ? new File([blob], 'photo.jpg', { type: 'image/jpeg' }) : file
  } catch { return file }
}

// One photo for an item: shows it, and lets staff add / change / remove it.
export default function ItemPicture({ itemId }: { itemId: number }) {
  const [url, setUrl] = useState<string | null | undefined>(undefined)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const input = useRef<HTMLInputElement>(null)
  useEffect(() => {
    setUrl(undefined)
    fetch(`/api/items/${itemId}/picture`).then(r => r.json()).then(d => setUrl(d?.image_url ?? null)).catch(() => setUrl(null))
  }, [itemId])
  async function upload(f: File) {
    setBusy(true); setErr('')
    try {
      const fd = new FormData(); fd.append('file', await shrink(f))
      const r = await fetch(`/api/items/${itemId}/picture`, { method: 'POST', body: fd }); const d = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(d.error ?? 'Could not save the photo')
      setUrl(d.image_url)
    } catch (e) { setErr((e as Error).message) }
    setBusy(false)
  }
  async function remove() {
    if (!confirm('Remove this item\'s photo?')) return
    setBusy(true); await fetch(`/api/items/${itemId}/picture`, { method: 'DELETE' }).catch(() => {}); setUrl(null); setBusy(false)
  }
  return (
    <div className="flex items-center gap-3 border-b border-gray-200 bg-white px-3 py-2">
      <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-gray-200 bg-gray-50 text-[10px] text-gray-400">
        {url ? <img src={url} alt="" className="h-full w-full object-cover" /> : url === undefined ? '…' : 'No photo'}
      </div>
      <div className="space-y-1">
        <p className="text-[10px] font-semibold text-gray-600">Item photo (used in adverts)</p>
        <div className="flex flex-wrap gap-1.5">
          <button type="button" disabled={busy} onClick={() => input.current?.click()} className="rounded bg-blue-600 px-2.5 py-1 text-[10px] font-bold text-white disabled:opacity-40">{busy ? 'Saving…' : url ? 'Change photo' : 'Add photo'}</button>
          {url && <button type="button" disabled={busy} onClick={() => void remove()} className="rounded bg-red-50 px-2.5 py-1 text-[10px] font-bold text-red-700">Remove</button>}
        </div>
        {err && <p className="text-[10px] text-red-600">{err}</p>}
        <input ref={input} type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) void upload(f); e.target.value = '' }} />
      </div>
    </div>
  )
}
