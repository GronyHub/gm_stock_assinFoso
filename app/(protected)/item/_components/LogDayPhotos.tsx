'use client'
import { useState } from 'react'
import type { Attachment } from './attachmentsShared'

// Sales Log day row: the photos (attached forms) a day's receipts already have, from before Live Sale -- view
// only. Photos stopped being required once sales were tapped in, so nothing new is attached here, and days
// without photos show nothing.
export type DayReceipt = { id: number; is_gmc: boolean | null; attachments: Attachment[] | null }

export default function LogDayPhotos({ receipts }: { receipts: DayReceipt[] }) {
  const [open, setOpen] = useState(false)
  const all = receipts.flatMap(r => (r.attachments ?? []).map(a => ({ ...a, gmc: !!r.is_gmc })))
  if (all.length === 0) return null
  return (
    <span className="relative inline-block">
      <button type="button" onClick={() => setOpen(o => !o)} title={`${all.length} photo${all.length === 1 ? '' : 's'}: tap to view`}
        className="rounded px-1 text-[8px] font-semibold leading-none text-blue-700 hover:bg-blue-100">📎{all.length}</button>
      {open && (
        <span className="absolute left-0 top-full z-30 mt-0.5 block w-56 rounded-lg border border-gray-200 bg-white p-2 text-left shadow-lg">
          <span className="mb-1 block text-[10px] font-bold text-gray-700">Photos for this day</span>
          <span className="flex flex-wrap gap-1.5">
            {all.map((a, i) => (
              <a key={i} href={a.url} target="_blank" rel="noopener noreferrer" title={a.name}
                className="block h-12 w-12 overflow-hidden rounded border border-gray-200 bg-gray-100">
                {a.type?.startsWith('image/') ? <img src={a.url} alt={a.name} className="h-full w-full object-cover" /> : <span className="flex h-full items-center justify-center text-[9px] text-gray-500">PDF</span>}
              </a>
            ))}
          </span>
          <button type="button" onClick={() => setOpen(false)} className="mt-1.5 rounded bg-gray-100 px-2 py-0.5 text-[10px] font-bold text-gray-700">Close</button>
        </span>
      )}
    </span>
  )
}
