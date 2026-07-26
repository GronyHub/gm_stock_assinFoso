'use client'
import { useState } from 'react'
import LossFeedTab from './LossFeedTab'
import LossByItemTab from './LossByItemTab'

type SubView = 'byDate' | 'byItem' | 'byTarget'

const SUB_TABS: { key: SubView; label: string }[] = [
  { key: 'byDate',   label: 'Loss by Date' },
  { key: 'byItem',   label: 'Loss by Item' },
  { key: 'byTarget', label: 'Loss by Target' },
]

// Three ways to look at the same underlying loss data -- by date
// (LossFeedTab, the original/only view here -- a chronological feed of
// every loss as it was detected), by item (LossByItemTab -- ranked by each
// item's own running total), and by target (placeholder; content TBD).
export default function LossOverviewTab({ search }: { search: string }) {
  const [sub, setSub] = useState<SubView>('byDate')
  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-stretch gap-1 px-2 py-1.5 shrink-0 border-b border-gray-100">
        {SUB_TABS.map(t => (
          <button key={t.key} onClick={() => setSub(t.key)}
            className={`flex-1 min-w-0 text-center text-[11px] font-bold px-2 py-1.5 rounded-lg transition truncate
              ${sub === t.key ? 'bg-red-600 text-white' : 'text-gray-500 hover:bg-gray-100'}`}>
            {t.label}
          </button>
        ))}
      </div>
      <div className="flex-1 min-h-0">
        {sub === 'byDate' && <LossFeedTab search={search} kind="loss" />}
        {sub === 'byItem' && <LossByItemTab search={search} />}
        {sub === 'byTarget' && (
          <div className="py-20 text-center text-gray-400 text-xs">Coming soon.</div>
        )}
      </div>
    </div>
  )
}
