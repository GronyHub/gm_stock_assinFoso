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

export function useAttachments(initial: Attachment[] = []) {
  const [items, setItems] = useState<PendingAttachment[]>(initial.map(toPending))

  // Re-seeds the list -- called from an "edit" entry point (e.g. startEdit
  // in SalesTab) the same way editForm/editLines get reset there, since this
  // hook lives once at the component's top level, not per-row.
  function reset(next: Attachment[] = []) {
    setItems(next.map(toPending))
  }

  async function uploadOne(file: File) {
    const localUrl = URL.createObjectURL(file)
    setItems(prev => [...prev, { url: '', type: file.type, name: file.name, localUrl, uploading: true }])
    const fd = new FormData()
    fd.append('file', file)
    try {
      const res = await fetch('/api/sales/upload', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Upload failed')
      setItems(prev => prev.map(m => m.localUrl === localUrl
        ? { ...m, uploading: false, url: data.url, type: data.contentType, name: data.name ?? m.name }
        : m))
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Upload failed'
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
              {m.type === 'application/pdf' ? (
                <div className="w-full h-full flex items-center justify-center bg-gray-200 text-gray-500 text-[8px] font-bold">PDF</div>
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={m.localUrl} alt={m.name} className="w-full h-full object-cover" />
              )}
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
    </div>
  )
}
