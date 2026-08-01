'use client'
import { useState } from 'react'
import { applyPaneOrder, type PaneOrderMap } from './paneOrder'
import SavedFlash from './SavedFlash'

type Item = { key: string; label: string; icon?: string }

// Reached from Settings -- lets an owner-level account change the order
// Grony Cash's and Grony Manage's rows appear in for everyone, instead of
// the fixed order they were declared in (CASH_ITEMS/MANAGE_LIST_ITEMS).
// Shares paneOrder/setPaneOrder with item/page.tsx itself, so a move here
// is reflected in the live pane immediately, not just after a refresh.
export default function ReorderListsPanel({ cashItems, manageItems, paneOrder, setPaneOrder }: {
  cashItems: Item[]
  manageItems: Item[]
  paneOrder: PaneOrderMap
  setPaneOrder: React.Dispatch<React.SetStateAction<PaneOrderMap>>
}) {
  const [tab, setTab] = useState<'cash' | 'manage'>('cash')
  const [saving, setSaving] = useState(false)
  const [justSaved, setJustSaved] = useState(false)

  const source = tab === 'cash' ? cashItems : manageItems
  const list = applyPaneOrder(source, paneOrder[tab])

  async function move(index: number, dir: -1 | 1) {
    const target = index + dir
    if (target < 0 || target >= list.length) return
    const next = [...list]
    ;[next[index], next[target]] = [next[target], next[index]]
    const order = next.map(i => i.key)
    setPaneOrder(prev => ({ ...prev, [tab]: order }))
    setSaving(true)
    const res = await fetch('/api/pane-order', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind: tab, order }),
    }).catch(() => null)
    setSaving(false)
    if (res?.ok) { setJustSaved(true); setTimeout(() => setJustSaved(false), 1500) }
  }

  return (
    <div className="space-y-3">
      <h1 className="text-lg font-bold text-gray-900">Reorder Lists</h1>
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
        <button onClick={() => setTab('cash')}
          className={`flex-1 text-sm font-semibold py-2 rounded-lg transition ${tab === 'cash' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
          Grony Cash
        </button>
        <button onClick={() => setTab('manage')}
          className={`flex-1 text-sm font-semibold py-2 rounded-lg transition ${tab === 'manage' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
          Grony Manage
        </button>
      </div>
      <p className="text-xs text-gray-400">Use the arrows to move a row up or down -- changes apply to everyone&apos;s pane right away.</p>
      <div className="space-y-1">
        {list.map((item, i) => (
          <div key={item.key} className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-2">
            {item.icon && <span className="text-base leading-none">{item.icon}</span>}
            <span className="flex-1 text-sm text-gray-800 truncate">{item.label}</span>
            <button onClick={() => move(i, -1)} disabled={i === 0 || saving} title="Move up"
              className="w-7 h-7 flex items-center justify-center rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 disabled:opacity-30 transition">▲</button>
            <button onClick={() => move(i, 1)} disabled={i === list.length - 1 || saving} title="Move down"
              className="w-7 h-7 flex items-center justify-center rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 disabled:opacity-30 transition">▼</button>
          </div>
        ))}
      </div>
      {justSaved && <SavedFlash show />}
    </div>
  )
}
