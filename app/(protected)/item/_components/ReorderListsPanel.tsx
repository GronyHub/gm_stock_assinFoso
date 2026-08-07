'use client'
import { useState } from 'react'
import { applyPaneOrder, buildPaneRuns, flattenPaneRuns, type PaneOrderMap } from './paneOrder'
import SavedFlash from './SavedFlash'

type Item = { key: string; label: string; icon?: string; group?: string }
type GroupOverride = { group_name: string | null; standalone: boolean }

// flattenPaneRuns needs a group->label lookup, but a Cash row's group IS
// its own label already (see effectiveCashItems in item/page.tsx) -- this
// just hands any group string straight back.
const IDENTITY_LABELS: Record<string, string> = new Proxy({}, { get: (_, prop: string) => prop })

// Inline instead of a plain <select> with a hardcoded option list, since
// a section here can be any text an owner-level account has typed, not a
// fixed set -- "+ New section…" reveals a one-off text input the same way
// the rename pencil elsewhere in this panel does.
function SectionPicker({ current, groupNames, onPick }: { current: string | null; groupNames: string[]; onPick: (name: string | null) => void }) {
  const [addingNew, setAddingNew] = useState(false)
  const [newName, setNewName] = useState('')
  if (addingNew) {
    return (
      <span className="flex items-center gap-1">
        <input autoFocus value={newName} onChange={e => setNewName(e.target.value)} placeholder="Section name"
          onKeyDown={e => {
            if (e.key === 'Enter') { onPick(newName.trim() || null); setAddingNew(false); setNewName('') }
            if (e.key === 'Escape') setAddingNew(false)
          }}
          className="text-[10px] border border-gray-300 rounded px-1.5 py-0.5 w-24 outline-none focus:ring-1 focus:ring-blue-400" />
        <button onClick={() => { onPick(newName.trim() || null); setAddingNew(false); setNewName('') }}
          className="text-green-600 text-xs font-bold px-0.5">✓</button>
        <button onClick={() => setAddingNew(false)} className="text-gray-400 text-xs font-bold px-0.5">×</button>
      </span>
    )
  }
  return (
    <select value={current ?? ''} onChange={e => {
      if (e.target.value === '__new__') { setAddingNew(true); return }
      onPick(e.target.value || null)
    }} className="text-[10px] border border-gray-300 rounded px-1 py-0.5 bg-white text-gray-700">
      <option value="">No section</option>
      {groupNames.map(g => <option key={g} value={g}>{g}</option>)}
      <option value="__new__">+ New section…</option>
    </select>
  )
}

// Reached from Settings -- lets an owner-level account change the order,
// label, and (Cash only) section Grony Cash's/Grony Manage's/Team's rows
// appear with for everyone, instead of the fixed order/label/section they
// were declared with (CASH_ITEMS/MANAGE_LIST_ITEMS/STAFF_TEAM_ITEMS).
// Shares paneOrder/setPaneOrder, paneLabels/setPaneLabels, and
// paneGroups/setPaneGroups with item/page.tsx itself, so a change here is
// reflected in the live pane immediately, not just after a refresh.
//
// Renaming only ever overrides a row's own display label (see
// /api/pane-labels), and moving a row only ever overrides its `group`
// (see /api/pane-groups) -- a row's `key` still drives routing,
// PageToolIcons's scopeKey, and every task/notes/laws/flag lookup either
// way, so neither can orphan any of that data.
//
// Section editing (the picker + Standalone checkbox) is Cash-only --
// Manage's own groups (Advert, Grony 1 to 10 checks) and Team (no groups
// at all) aren't backed by /api/pane-groups, so those two tabs keep the
// plain flat reorder/rename list they always had.
export default function ReorderListsPanel({ cashItems, manageItems, staffItems, paneOrder, setPaneOrder, paneLabels, setPaneLabels, paneGroups, setPaneGroups }: {
  cashItems: Item[]
  manageItems: Item[]
  staffItems: Item[]
  paneOrder: PaneOrderMap
  setPaneOrder: React.Dispatch<React.SetStateAction<PaneOrderMap>>
  paneLabels: Record<string, string>
  setPaneLabels: React.Dispatch<React.SetStateAction<Record<string, string>>>
  paneGroups: Record<string, GroupOverride>
  setPaneGroups: React.Dispatch<React.SetStateAction<Record<string, GroupOverride>>>
}) {
  const [tab, setTab] = useState<'cash' | 'manage' | 'team'>('cash')
  const [saving, setSaving] = useState(false)
  const [justSaved, setJustSaved] = useState(false)
  const [renamingKey, setRenamingKey] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')

  const source = tab === 'cash' ? cashItems : tab === 'manage' ? manageItems : staffItems
  const list = applyPaneOrder(source, tab === 'team' ? undefined : paneOrder[tab])
  // Grouped-for-display only, on Cash -- move() below still works off the
  // flat `list`/its own index (via findIndex), so up/down stays correct
  // even where buildPaneRuns visually pulls same-section rows together.
  const rows = tab === 'cash'
    ? flattenPaneRuns(buildPaneRuns(list), IDENTITY_LABELS)
    : list.map(item => ({ item, header: undefined as string | undefined, divider: false }))
  const groupNames = tab === 'cash' ? [...new Set(cashItems.map(i => i.group).filter((g): g is string => !!g))].sort() : []

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

  async function saveGroup(item: Item, groupName: string | null, standalone: boolean) {
    setPaneGroups(prev => ({ ...prev, [item.key]: { group_name: groupName, standalone } }))
    setSaving(true)
    const res = await fetch('/api/pane-groups', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: item.key, groupName, standalone }),
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
          : tab === 'cash'
          ? 'Arrows move a row, the pencil renames it, and Section moves it into a different group (or check Standalone to make it its own) -- changes apply to everyone\'s pane right away.'
          : 'Use the arrows to move a row up or down, or the pencil to rename it -- changes apply to everyone\'s pane right away.'}
      </p>
      <div className="space-y-1">
        {rows.map(({ item, header }) => {
          const i = list.findIndex(x => x.key === item.key)
          const override = paneGroups[item.key]
          return (
          <div key={item.key}>
            {header && (
              <p className="px-1 pt-2 pb-1"><span className="text-[8px] font-extrabold text-red-700 bg-yellow-400 uppercase tracking-wide rounded px-1.5 py-0.5">{header}</span></p>
            )}
            <div className="flex flex-col gap-1.5 bg-white border border-gray-200 rounded-lg px-3 py-2">
              <div className="flex items-center gap-2">
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
              {tab === 'cash' && renamingKey !== item.key && (
                <div className="flex items-center gap-1.5 pl-7 flex-wrap">
                  <span className="text-[9px] text-gray-400 shrink-0">Section</span>
                  <SectionPicker current={item.group ?? null} groupNames={groupNames}
                    onPick={name => saveGroup(item, name, override?.standalone ?? false)} />
                  <label className="flex items-center gap-1 text-[9px] text-gray-500 cursor-pointer select-none ml-auto shrink-0">
                    <input type="checkbox" checked={override?.standalone ?? false}
                      onChange={e => saveGroup(item, override?.group_name ?? null, e.target.checked)}
                      className="w-3 h-3 accent-blue-600" />
                    Standalone
                  </label>
                </div>
              )}
            </div>
          </div>
          )
        })}
      </div>
      {justSaved && <SavedFlash show />}
    </div>
  )
}
