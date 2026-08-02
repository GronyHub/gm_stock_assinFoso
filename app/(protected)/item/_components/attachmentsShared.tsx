'use client'
import { useRef, useState } from 'react'

// Photo/scan of a paper sales form attached to a receipt -- shared between
// the New Sale page and Sales' own Edit Receipt form (SalesTab.tsx) so both
// upload through the same /api/sales/upload endpoint and store the same
// {url,type,name} shape in sales_receipts.attachments.
export type Attachment = { url: string; type: string; name: string }
type PendingAttachment = Attachment & { localUrl: string; uploading: boolean; error?: string }

function toPending(a: Attachment): PendingAttachment {
  // A saved attachment's `url` is already a fetchable authenticated path
  // (/api/sales/media?p=...), so it doubles as the thumbnail's localUrl.
  return { ...a, localUrl: a.url, uploading: false }
}

const MAX_DIMENSION = 1800
const JPEG_QUALITY = 0.82
const SKIP_COMPRESSION_UNDER = 3 * 1024 * 1024 // already small enough, don't bother re-encoding

// A phone camera photo of a paper form can easily run 8-15MB at full
// resolution -- comfortably over the request-body limit Vercel's serverless
// functions enforce, which drops the connection before our upload route
// ever runs (surfaces client-side as a bare "Failed to fetch", no server
// error to show). Downscaling/re-encoding here keeps the form perfectly
// legible while landing well under that ceiling. PDFs and already-small
// images pass through untouched; any decode failure (e.g. an unsupported
// format) just falls back to uploading the original file as-is.
async function compressIfNeeded(file: File): Promise<File> {
  if (!file.type.startsWith('image/') || file.type === 'image/gif' || file.size <= SKIP_COMPRESSION_UNDER) return file
  try {
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height))
    const w = Math.round(bitmap.width * scale)
    const h = Math.round(bitmap.height * scale)
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) { bitmap.close(); return file }
    ctx.drawImage(bitmap, 0, 0, w, h)
    bitmap.close()
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY))
    if (!blob) return file
    const newName = file.name.replace(/\.\w+$/, '') + '.jpg'
    return new File([blob], newName, { type: 'image/jpeg' })
  } catch {
    return file
  }
}

export function useAttachments(initial: Attachment[] = []) {
  const [items, setItems] = useState<PendingAttachment[]>(initial.map(toPending))

  // Re-seeds the list -- called from an "edit" entry point (e.g. startEdit
  // in SalesTab) the same way editForm/editLines get reset there, since this
  // hook lives once at the component's top level, not per-row.
  function reset(next: Attachment[] = []) {
    setItems(next.map(toPending))
  }

  async function uploadAttempt(file: File) {
    const toSend = await compressIfNeeded(file)
    const fd = new FormData()
    fd.append('file', toSend)
    const res = await fetch('/api/sales/upload', { method: 'POST', body: fd })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error ?? 'Upload failed')
    return data
  }

  async function uploadOne(file: File) {
    const localUrl = URL.createObjectURL(file)
    setItems(prev => [...prev, { url: '', type: file.type, name: file.name, localUrl, uploading: true }])
    try {
      let data
      try {
        data = await uploadAttempt(file)
      } catch {
        // A file picked from Google Drive (or another cloud provider) isn't
        // actually on the device yet -- the OS is still fetching its bytes
        // in the background when the picker hands it to the page, and the
        // very first read can fail transiently while that finishes. One
        // quiet retry, after giving it a moment, clears this up without the
        // user needing to notice or re-pick the file themselves.
        await new Promise(r => setTimeout(r, 1200))
        data = await uploadAttempt(file)
      }
      setItems(prev => prev.map(m => m.localUrl === localUrl
        ? { ...m, uploading: false, url: data.url, type: data.contentType, name: data.name ?? m.name }
        : m))
    } catch (e) {
      // A bare "Failed to fetch" surviving both attempts is the browser
      // aborting the request itself rather than a server-side rejection --
      // give a reason a non-developer can actually act on instead of the
      // raw browser wording.
      const message = e instanceof Error && e.message !== 'Failed to fetch'
        ? e.message
        : 'Could not reach the server. If this file is from Google Drive or another cloud app, try saving it to your phone first and uploading that copy instead.'
      setItems(prev => prev.map(m => m.localUrl === localUrl ? { ...m, uploading: false, error: message } : m))
    }
  }

  function addFiles(files: FileList | null) {
    if (!files) return
    Array.from(files).forEach(uploadOne)
  }

  function remove(localUrl: string) {
    setItems(prev => prev.filter(m => m.localUrl !== localUrl))
  }

  return {
    items, addFiles, remove, reset,
    saved: items.filter(m => m.url && !m.error).map(({ url, type, name }) => ({ url, type, name })),
    isUploading: items.some(m => m.uploading),
    hasError: items.some(m => m.error),
  }
}

export function AttachmentPicker({ items, onAdd, onRemove, disabled }: {
  items: PendingAttachment[]
  onAdd: (files: FileList | null) => void
  onRemove: (localUrl: string) => void
  disabled?: boolean
}) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1.5">
        <button type="button" onClick={() => fileInputRef.current?.click()} disabled={disabled}
          className="shrink-0 flex items-center gap-1 text-[10px] font-semibold text-gray-500 hover:text-blue-600 disabled:opacity-40 bg-gray-100 hover:bg-blue-50 rounded px-2 py-1 transition">
          📎 Upload
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,application/pdf"
          multiple
          className="hidden"
          onChange={e => { onAdd(e.target.files); e.target.value = '' }}
        />
        <button type="button" onClick={() => cameraInputRef.current?.click()} disabled={disabled}
          className="shrink-0 flex items-center gap-1 text-[10px] font-semibold text-gray-500 hover:text-blue-600 disabled:opacity-40 bg-gray-100 hover:bg-blue-50 rounded px-2 py-1 transition">
          📷 Photo
        </button>
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={e => { onAdd(e.target.files); e.target.value = '' }}
        />
      </div>
      {items.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {items.map(m => (
            <div key={m.localUrl} className="relative w-11 h-11 rounded-md overflow-hidden border border-gray-200 bg-gray-100 shrink-0">
              {/* Opens in a new tab -- localUrl is the local blob preview
                  while still uploading, or the saved server URL once done,
                  so this works the same either way. The remove button below
                  is a sibling, not nested inside, so it stays clickable on
                  its own without needing to stop this link's click. */}
              <a href={m.localUrl} target="_blank" rel="noopener noreferrer" className="block w-full h-full">
                {m.type === 'application/pdf' ? (
                  <div className="w-full h-full flex items-center justify-center bg-gray-200 text-gray-500 text-[8px] font-bold">PDF</div>
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={m.localUrl} alt={m.name} className="w-full h-full object-cover" />
                )}
              </a>
              {m.uploading && (
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                  <span className="text-white text-[8px] font-semibold">…</span>
                </div>
              )}
              {m.error && (
                <div className="absolute inset-0 bg-red-500/70 flex items-center justify-center" title={m.error}>
                  <span className="text-white text-[7px] font-semibold text-center px-0.5">!</span>
                </div>
              )}
              <button type="button" onClick={() => onRemove(m.localUrl)} title="Remove"
                className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-black/60 text-white text-[9px] flex items-center justify-center leading-none">
                ×
              </button>
            </div>
          ))}
        </div>
      )}
      {/* A failed upload's thumbnail still renders (from the local blob
          URL) with only a small red corner badge -- easy to miss, and
          without this the caller would otherwise just silently drop it on
          save. Spelled out here so it can't go unnoticed. */}
      {items.filter(m => m.error).map(m => (
        <p key={`err-${m.localUrl}`} className="text-[9px] text-red-600 font-medium">
          &quot;{m.name}&quot; failed to attach — {m.error}
        </p>
      ))}
    </div>
  )
}
