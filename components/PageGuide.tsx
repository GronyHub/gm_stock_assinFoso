'use client'
import { useState } from 'react'
import { createPortal } from 'react-dom'
import { areaForGuide } from '@/lib/lawAreas'

// The "📜 Laws" button on a Cash page. It opens this page's own laws (the same embedded rules the Manage pages show
// on their Rules tab) in a sheet over the page, so nothing leaves the page and the rest of the app stays where it was.
export default function PageGuide({ page }: { page: string }) {
  const area = areaForGuide(page)
  const [open, setOpen] = useState(false)
  if (!area) return null
  return (<>
    <button type="button" onClick={() => setOpen(true)} title={`The laws, sanctions and how-to for ${area.label}`}
      className="shrink-0 rounded-lg bg-indigo-50 px-2 py-1 text-[12px] font-bold text-indigo-700 hover:bg-indigo-100">📜 Laws</button>
    {open && typeof document !== 'undefined' && createPortal(
      <div className="fixed inset-0 z-[70] flex flex-col bg-white">
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-gray-200 px-3 py-2">
          <p className="min-w-0 truncate text-[15px] font-bold text-[#14213D]">📜 {area.label} laws</p>
          <button type="button" onClick={() => setOpen(false)} className="shrink-0 rounded-lg bg-gray-100 px-3 py-1.5 text-[13px] font-bold text-gray-700">Close</button>
        </div>
        <iframe src={`/laws?tile=${area.key}&embed=1`} title={`${area.label} laws`} className="min-h-0 w-full flex-1 border-0" />
      </div>,
      document.body)}
  </>)
}
