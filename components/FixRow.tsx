'use client'
import { useState } from 'react'

// A row in the "fix" lists: a label and a Fix button that opens the form underneath. `roomy` = the larger spacing used on the Staff page; `truncate` keeps the label on one line.
export default function FixRow({ label, sub, children, roomy = false, truncate = false }: { label: React.ReactNode; sub?: React.ReactNode; children: React.ReactNode; roomy?: boolean; truncate?: boolean }) {
  const [open, setOpen] = useState(false)
  return (
    <div>
      <div className={`flex items-center justify-between ${roomy ? 'px-3' : 'px-2'} py-1.5 gap-2`}>
        <div className={`min-w-0 flex-1${truncate ? ' truncate' : ''}`}>
          <span className={`${roomy ? 'text-[12px]' : 'text-[12px]'} text-gray-900 font-semibold`}>{label}</span>
          {sub && <span className={`ml-2 ${roomy ? 'text-[12px]' : 'text-[12px]'} text-gray-400`}>{sub}</span>}
        </div>
        <button onClick={() => setOpen(o => !o)}
          className={`shrink-0 ${roomy ? 'text-[12px] px-2' : 'text-[12px] px-1.5'} font-semibold py-0.5 rounded bg-blue-50 text-blue-600 hover:bg-blue-100 transition`}>
          {open ? 'Close' : 'Fix'}
        </button>
      </div>
      {open && <div className={`${roomy ? 'px-3' : 'px-2'} pb-2 border-t border-gray-50 space-y-1.5 pt-1.5`}>{children}</div>}
    </div>
  )
}
