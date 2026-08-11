'use client'
import { useState, useEffect } from 'react'
import ManageLogPanel from './ManageLogPanel'
import ContentPage from './ContentPage'
import DynamicTasksSection from './DynamicTasksSection'
import PayslipFlagsPanel from './PayslipFlagsPanel'
import SavedFlash from './SavedFlash'
import PageLawsList from './PageLawsList'
import LawsToggleBar from './LawsToggleBar'
import { useLawsPanel } from './useLawsPanel'

type ContentType = 'log' | 'notes' | 'tasks' | 'payslip_flags'
type CategoryTab = { id: number; category_id: number; label: string; content_type: ContentType }

const CONTENT_TYPE_OPTIONS: { value: ContentType; label: string }[] = [
  { value: 'log', label: 'Log (notes + photo)' },
  { value: 'notes', label: 'Notes (free text)' },
  { value: 'tasks', label: 'Tasks (to-do list)' },
  { value: 'payslip_flags', label: 'Payslip Flags (missing payslips)' },
]

// A Grony Manage category's own page -- its content is entirely whatever
// tabs have been added to it (see manage-category-tabs), each backed by one
// of a small set of reusable content types instead of bespoke code. Read
// access is open to everyone; adding/removing a tab is owner-level only.
//
// categoryId is optional because every caller now resolves it at runtime
// from a fixed label via useFixedCategoryIds (see manageViewData.ts) rather
// than passing a literal number -- it's undefined for the one render before
// that fetch resolves, during which this just shows a loading state instead
// of fetching `category_id=undefined`.
export default function DynamicCategoryPage({ categoryId, categoryLabel, canManage }: {
  categoryId: number | undefined; categoryLabel: string; canManage: boolean
}) {
  const [tabs, setTabs] = useState<CategoryTab[]>([])
  const [loading, setLoading] = useState(true)
  const lawsPanel = useLawsPanel(`showCategoryLaws_${categoryLabel}`)
  const [activeTabId, setActiveTabId] = useState<number | null>(null)
  const [showAddTab, setShowAddTab] = useState(false)
  const [newLabel, setNewLabel] = useState('')
  const [newType, setNewType] = useState<ContentType>('log')
  const [saving, setSaving] = useState(false)
  const [justAdded, setJustAdded] = useState(false)

  function load() {
    if (categoryId === undefined) return
    fetch(`/api/manage-category-tabs?category_id=${categoryId}`).then(r => r.ok ? r.json() : []).then(d => {
      const list: CategoryTab[] = Array.isArray(d) ? d : []
      setTabs(list)
      setActiveTabId(prev => (prev && list.some(t => t.id === prev)) ? prev : (list[0]?.id ?? null))
      setLoading(false)
    }).catch(() => setLoading(false))
  }
  useEffect(() => { load() }, [categoryId])

  async function addTab(e: React.FormEvent) {
    e.preventDefault()
    if (!newLabel.trim() || saving || categoryId === undefined) return
    setSaving(true)
    const res = await fetch('/api/manage-category-tabs', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category_id: categoryId, label: newLabel.trim(), content_type: newType }),
    })
    setSaving(false)
    if (res.ok) {
      const row = await res.json()
      setNewLabel(''); setNewType('log'); setShowAddTab(false)
      load()
      setActiveTabId(row.id)
      setJustAdded(true)
      setTimeout(() => setJustAdded(false), 2500)
    }
  }

  async function removeTab(id: number) {
    if (!confirm('Delete this tab and everything in it?')) return
    await fetch(`/api/manage-category-tabs?id=${id}`, { method: 'DELETE' }).catch(() => {})
    load()
  }

  const activeTab = tabs.find(t => t.id === activeTabId)

  if (loading) return <div className="py-10 text-center text-gray-400 text-sm">Loading…</div>

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="px-2 pt-2 shrink-0 flex flex-nowrap items-center gap-1.5 overflow-x-auto">
        <LawsToggleBar show={lawsPanel.show} setShow={lawsPanel.setShow}
          openForm={lawsPanel.openForm} setOpenForm={lawsPanel.setOpenForm}
          hideZeroFlags={lawsPanel.hideZeroFlags} setHideZeroFlags={lawsPanel.setHideZeroFlags} dark={false} />
      </div>
      {lawsPanel.show && (
        <div className="px-2 shrink-0">
          <div className="border border-gray-200 rounded-xl bg-white overflow-hidden">
            <PageLawsList scopeKey={categoryLabel} isItemsLaws={true} onChange={lawsPanel.bumpRefresh}
              openForm={lawsPanel.openForm} setOpenForm={lawsPanel.setOpenForm}
              hideZeroFlags={lawsPanel.hideZeroFlags} setHideZeroFlags={lawsPanel.setHideZeroFlags} />
          </div>
        </div>
      )}
      {tabs.length > 0 && (
        <div className="flex items-center gap-1 px-2 py-0.5 bg-white border-b border-gray-100 overflow-x-auto shrink-0">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setActiveTabId(t.id)}
              className={`shrink-0 text-sm font-semibold px-1.5 py-0.5 rounded-lg whitespace-nowrap border transition
                ${activeTabId === t.id ? 'bg-blue-600 text-white border-blue-600' : 'text-gray-500 border-gray-200 hover:bg-gray-100'}`}>
              {t.label}
            </button>
          ))}
          {canManage && (
            <button onClick={() => setShowAddTab(v => !v)}
              className="shrink-0 text-sm font-semibold px-1.5 py-0.5 rounded-lg whitespace-nowrap border border-dashed border-gray-300 text-gray-400 hover:bg-gray-50 transition">
              + Tab
            </button>
          )}
          {justAdded && <SavedFlash show />}
        </div>
      )}

      {showAddTab && canManage && (
        <form onSubmit={addTab} className="flex items-center gap-1.5 px-2 py-2 bg-gray-50 border-b border-gray-100 shrink-0">
          <input autoFocus value={newLabel} onChange={e => setNewLabel(e.target.value)} placeholder="Tab name *"
            className="flex-1 min-w-0 text-xs bg-white border border-gray-300 rounded px-2 py-1.5 outline-none focus:ring-1 focus:ring-blue-400" />
          <select value={newType} onChange={e => setNewType(e.target.value as ContentType)}
            className="text-xs bg-white border border-gray-300 rounded px-2 py-1.5 outline-none focus:ring-1 focus:ring-blue-400">
            {CONTENT_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <button type="submit" disabled={saving || !newLabel.trim()}
            className="shrink-0 text-xs font-semibold px-3 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 transition">
            {saving ? '…' : 'Add'}
          </button>
        </form>
      )}

      <div className="flex-1 min-h-0 overflow-y-auto">
        {tabs.length === 0 ? (
          <div className="py-10 px-4 text-center space-y-3">
            <p className="text-sm text-gray-400">{categoryLabel} has no tabs yet.</p>
            {canManage ? (
              !showAddTab && (
                <button onClick={() => setShowAddTab(true)}
                  className="text-xs font-semibold px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition">
                  + Add the first tab
                </button>
              )
            ) : (
              <p className="text-xs text-gray-300">Ask Joe or Grony to set this category up.</p>
            )}
          </div>
        ) : activeTab ? (
          <>
            {activeTab.content_type === 'log' && <ManageLogPanel category={`dyn_${activeTab.id}`} label={activeTab.label} icon="📋" />}
            {activeTab.content_type === 'notes' && <ContentPage contentKey={`dyn_${activeTab.id}`} title={activeTab.label} />}
            {activeTab.content_type === 'tasks' && <DynamicTasksSection scopeKey={`dyn_${activeTab.id}`} />}
            {activeTab.content_type === 'payslip_flags' && <PayslipFlagsPanel />}
            {canManage && (
              <div className="px-3 pb-4">
                <button onClick={() => removeTab(activeTab.id)} className="text-[10px] text-red-400 hover:text-red-600 font-semibold">
                  Delete this tab
                </button>
              </div>
            )}
          </>
        ) : null}
      </div>
    </div>
  )
}
