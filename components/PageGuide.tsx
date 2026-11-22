'use client'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { areaForGuide } from '@/lib/lawAreas'

// The Laws page of a Cash page: a sheet over the page with the page's laws. Each law carries its own record (done, not done, violations) and a Record violation button.

export function LawsSheet({ areaKey, label, onClose }: { areaKey: string; label: string; onClose: () => void }) {
  // A button inside the laws (for example 'Items to count now') asks the hub to open a page: the sheet gets out of the way.
  useEffect(() => {
    const h = (e: MessageEvent) => { if (e.origin === window.location.origin && e.data?.type === 'open-counts') onClose() }
    window.addEventListener('message', h)
    return () => window.removeEventListener('message', h)
  }, [onClose])
  if (typeof document === 'undefined') return null
  return createPortal(
    <div className="fixed inset-0 z-[70] flex flex-col bg-white">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-gray-200 px-3 py-2">
        <p className="min-w-0 truncate text-[15px] font-bold text-[#14213D]">📜 {label} laws</p>
        <button type="button" onClick={onClose} className="shrink-0 rounded-lg bg-gray-100 px-3 py-1.5 text-[13px] font-bold text-gray-700">Close</button>
      </div>
      <iframe key={areaKey} src={`/laws?tile=${encodeURIComponent(areaKey)}&embed=1`} title={`${label} laws`} className="min-h-0 w-full flex-1 border-0" />
    </div>,
    document.body)
}

// The "📜 Laws" button on a Cash page.
export default function PageGuide({ page }: { page: string }) {
  const area = areaForGuide(page)
  const [open, setOpen] = useState(false)
  if (!area) return null
  return (<>
    <button type="button" onClick={() => setOpen(true)} title={`The laws, sanctions and how-to for ${area.label}`} aria-label="Laws"
      className="shrink-0 rounded-lg bg-indigo-50 px-2 py-1 text-[12px] font-bold text-indigo-700 hover:bg-indigo-100">📜<span className="max-sm:hidden"> Laws</span></button>
    {open && <LawsSheet areaKey={area.key} label={area.label} onClose={() => setOpen(false)} />}
  </>)
}
