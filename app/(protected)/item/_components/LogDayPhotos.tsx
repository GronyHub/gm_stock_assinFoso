'use client'
import { useState } from 'react'
import { useAttachments, AttachmentPicker, type Attachment } from './attachmentsShared'

// Sales Log day row: the photos (attached forms) of that day's receipts -- what Sales Rec / Summary used to hold.
// Tap 📎 to view them, add more (📎 Upload / 📷 Photo) or remove one; they save on the day's walk-in receipt (or
// its only receipt), the same field Summary used, so nothing already attached is lost.
export type DayReceipt = { id: number; is_gmc: boolean | null; attachments: Attachment[] | null }

export default function LogDayPhotos({ receipts, onSaved }: {
  receipts: DayReceipt[]
  onSaved: (receiptId: number, attachments: Attachment[]) => void
}) {
  const main = receipts.find(r => !r.is_gmc) ?? receipts[0] ?? null
  const others = receipts.filter(r => r !== main && (r.attachments?.length ?? 0) > 0)
  const count = receipts.reduce((s, r) => s + (r.attachments?.length ?? 0), 0)
  const [open, setOpen] = useState(false)
  const att = useAttachments(main?.attachments ?? [])
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  if (!main) return null
  async function save() {
    if (!main) return
    if (att.isUploading) { setErr('Still uploading, please wait…'); return }
    if (att.hasError) { setErr('A photo failed to upload: remove it or try again.'); return }
    setBusy(true); setErr('')
    try {
      const r = await fetch(`/api/sales/${main.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ attachments: att.saved }) })
      if (!r.ok) throw new Error()
      onSaved(main.id, att.saved); setOpen(false)
    } catch { setErr('Could not save. Try again.') }
    setBusy(false)
  }

  return (
    <span className="relative inline-block">
      <button type="button" onClick={() => { att.reset(main.attachments ?? []); setErr(''); setOpen(o => !o) }}
        title={count ? `${count} photo${count === 1 ? '' : 's'} attached: tap to view or add` : 'Attach a photo of the day\'s form'}
        className={`rounded px-1 text-[8px] font-semibold leading-none ${count ? 'text-blue-700 hover:bg-blue-100' : 'text-gray-400 hover:bg-gray-100'}`}>
        📎{count || '+'}
      </button>
      {open && (
        <span className="absolute left-0 top-full z-30 mt-0.5 block w-64 rounded-lg border border-gray-200 bg-white p-2 text-left shadow-lg">
          <span className="mb-1 block text-[10px] font-bold text-gray-700">Photos for this day</span>
          {others.map(o => (
            <span key={o.id} className="mb-1 block text-[9px] text-gray-500">
              {o.is_gmc ? 'GMC' : 'Other'} receipt: {(o.attachments ?? []).map((a, i) => (
                <a key={i} href={a.url} target="_blank" rel="noopener noreferrer" className="mr-1 text-blue-600 underline">{a.name || `photo ${i + 1}`}</a>
              ))}
            </span>
          ))}
          <AttachmentPicker items={att.items} onAdd={att.addFiles} onRemove={att.remove} disabled={busy} />
          {err && <span className="mt-1 block text-[9px] text-red-600">{err}</span>}
          <span className="mt-1.5 flex gap-1">
            <button type="button" onClick={() => void save()} disabled={busy}
              className="rounded bg-blue-600 px-2 py-0.5 text-[10px] font-bold text-white disabled:opacity-40">{busy ? 'Saving…' : 'Save'}</button>
            <button type="button" onClick={() => setOpen(false)} className="rounded bg-gray-100 px-2 py-0.5 text-[10px] font-bold text-gray-700">Close</button>
          </span>
        </span>
      )}
    </span>
  )
}
