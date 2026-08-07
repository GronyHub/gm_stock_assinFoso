'use client'
import { useState } from 'react'
import { applyPaneOrder, type PaneOrderMap } from './paneOrder'
import SavedFlash from './SavedFlash'

type Item = { key: string; label: string; icon?: string }

// Reached from Settings -- lets an owner-level account change the order
// Grony Cash's, Grony Manage's, and Team's rows appear in for everyone,
// instead of the fixed order/label they were declared with
// (CASH_ITEMS/MANAGE_LIST_ITEMS/STAFF_TEAM_ITEMS). Shares paneOrder/
// setPaneOrder and paneLabels/setPaneLabels with item/page.tsx itself, so a
// move or rename here is reflected in the live pane immediately, not just
// after a refresh.
//
// Renaming only ever overrides the row's own display label (see
// /api/pane-labels) -- its `key` still drives routing, PageToolIcons's
// scopeKey, and every task/notes/laws/flag lookup, so renaming "Vendors" to
// "Suppliers" here never moves or orphans anything already saved under the
// Vendors scope.
export default function ReorderListsPanel({ cashItems, manageItems, staffItems, paneOrder, setPaneOrder, paneLabels, setPaneLabels }: {
  cashItems: Item[]
  manageItems: Item[]
  staffItems: Item[]
  paneOrder: PaneOrderMap
  setPaneOrder: React.Dispatch<React.SetStateAction<PaneOrderMap>>
  paneLabels: Record<string, string>
  setPaneLabels: React.Dispatch<React.SetStateAction<Record<string, string>>>
}) {
  const [tab, setTab] = useState<'cash' | 'manage' | 'team'>('cash')
  const [saving, setSaving] = useState(false)
  const [justSaved, setJustSaved] = useState(false)
  const [renamingKey, setRenamingKey] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')

  const source = tab === 'cash' ? cashItems : tab === 'manage' ? manageItems : staffItems
  const list = applyPaneOrder(source, tab === 'team' ? undefined : paneOrder[tab])

  async function move(index: number, dir: -1 | 1) {
    if (tab === 'team') return
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

  function startRename(item: Item) {
    setRenamingKey(item.key)
    setRenameValue(paneLabels[item.key] ?? item.label)
  }

  async function saveRename(item: Item) {
    const trimmed = renameValue.trim()
    const isDefault = trimmed === item.label
    setPaneLabels(prev => {
      const next = { ...prev }
      if (!trimmed || isDefault) delete next[item.key]; else next[item.key] = trimmed
      return next
    })
    setRenamingKey(null)
    setSaving(true)
    const res = await fetch('/api/pane-labels', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: item.key, label: isDefault ? '' : trimmed }),
    }).catch(() => null)
    setSaving(false)
    if (res?.ok) { setJustSaved(true); setTimeout(() => setJustSaved(false), 1500) }
  }

  return (
    <div className="space-y-3">
      <h1 className="text-lg font-bold text-gray-900">Reorder &amp; Rename Lists</h1>
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
        <button onClick={() => setTab('cash')}
          className={`flex-1 text-sm font-semibold py-2 rounded-lg transition ${tab === 'cash' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
          Grony Cash
        </button>
        <button onClick={() => setTab('manage')}
          className={`flex-1 text-sm font-semibold py-2 rounded-lg transition ${tab === 'manage' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
          Grony Manage
        </button>
        <button onClick={() => setTab('team')}
          className={`flex-1 text-sm font-semibold py-2 rounded-lg transition ${tab === 'team' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
          Team
        </button>
      </div>
      <p className="text-xs text-gray-400">
        {tab === 'team'
          ? 'Tap the pencil to rename a row -- changes apply to everyone\'s pane right away.'
          : 'Use the arrows to move a row up or down, or the pencil to rename it -- changes apply to everyone\'s pane right away.'}
      </p>
      <div className="space-y-1">
        {list.map((item, i) => (
          <div key={item.key} className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-2">
            {item.icon && <span className="text-base leading-none shrink-0">{item.icon}</span>}
            {renamingKey === item.key ? (
              <>
                <input autoFocus value={renameValue} onChange={e => setRenameValue(e.target.value)}
                  placeholder={item.label}
                  onKeyDown={e => {
                    if (e.key === 'Enter') saveRename(item)
                    if (e.key === 'Escape') setRenamingKey(null)
                  }}
                  className="flex-1 min-w-0 text-sm border border-gray-300 rounded px-2 py-1 outline-none focus:ring-1 focus:ring-blue-400" />
                <button onClick={() => saveRename(item)} title="Save" disabled={saving}
                  className="shrink-0 text-green-600 hover:text-green-700 px-1 text-sm font-bold disabled:opacity-40">✓</button>
                <button onClick={() => setRenamingKey(null)} title="Cancel"
                  className="shrink-0 text-gray-400 hover:text-gray-600 px-1 text-sm font-bold">×</button>
              </>
            ) : (
              <>
                <span className="flex-1 text-sm text-gray-800 truncate">{paneLabels[item.key] ?? item.label}</span>
                <button onClick={() => startRename(item)} title="Rename"
                  className="shrink-0 text-gray-300 hover:text-gray-600 px-1 text-sm">✎</button>
                {tab !== 'team' && <>
                  <button onClick={() => move(i, -1)} disabled={i === 0 || saving} title="Move up"
                    className="w-7 h-7 flex items-center justify-center rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 disabled:opacity-30 transition">▲</button>
                  <button onClick={() => move(i, 1)} disabled={i === list.length - 1 || saving} title="Move down"
                    className="w-7 h-7 flex items-center justify-center rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 disabled:opacity-30 transition">▼</button>
                </>}
              </>
            )}
          </div>
        ))}
      </div>
      {justSaved && <SavedFlash show />}
    </div>
  )
}
