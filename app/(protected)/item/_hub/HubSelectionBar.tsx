'use client'
import MoneyText from '@/components/MoneyText'
import type { HubCtx } from './useHubState'

// Shown while items are selected on the Live tiles (long-press): how many, the total, and what to do with them.
export default function HubSelectionBar({ h }: { h: HubCtx }) {
  const { liveSelectedIds, setLiveSelectedIds, selectedLiveItems, selectionLine, sellSelectedTogether, jobFromSelected } = h
  if (!liveSelectedIds.length) return null
  const items = selectedLiveItems()
  const total = items.reduce((s, it) => { const l = selectionLine(it); return s + l.qty * l.price }, 0)
  return (
    <div role="region" aria-label="Selected items" className="fixed inset-x-0 bottom-[84px] z-40 flex items-center gap-2 border-t border-gray-600 bg-gray-900 px-3 py-2 text-white shadow-lg sm:bottom-0 print:hidden">
      <span className="min-w-0 flex-1 truncate text-sm font-bold">{liveSelectedIds.length} selected · <MoneyText v={total} /></span>
      <button type="button" onClick={sellSelectedTogether} className="shrink-0 rounded-lg bg-green-600 px-3 py-1.5 text-xs font-bold text-white">Sell together</button>
      <button type="button" onClick={jobFromSelected} className="shrink-0 rounded-lg bg-amber-400 px-3 py-1.5 text-xs font-bold text-gray-900">🧾 Job</button>
      <button type="button" onClick={() => setLiveSelectedIds([])} aria-label="Clear selection" className="shrink-0 rounded-lg bg-white/15 px-2.5 py-1.5 text-xs font-bold text-white">✕</button>
    </div>
  )
}
