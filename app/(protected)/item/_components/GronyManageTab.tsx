'use client'
import { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
import ClosingReportLogView from './ClosingReportLogView'
import ManageLogPanel from './ManageLogPanel'
import TrainingTab from './TrainingTab'
import AdvertTab from './AdvertTab'
import DynamicCategoryPage from './DynamicCategoryPage'

// Staff (Times/Payslips/Violations/Role/Analytics/Assignments) moved to its
// own top-level "Staff" tab, one per person -- see item/page.tsx. Rota stays
// here since it's a shared weekly schedule across everyone, not one
// person's record.
const RotaTab = dynamic(() => import('../../staff/StaffClient').then(m => ({ default: m.RotaTab })), {
  ssr: false,
  loading: () => <div className="py-10 text-center text-gray-400 text-sm">Loading…</div>,
})
const LogsPage = dynamic(() => import('../../logs/page'), {
  ssr: false,
  loading: () => <div className="py-10 text-center text-gray-400 text-sm">Loading…</div>,
})

export type ManageView =
  | 'rota' | 'advert' | 'staff_dress'
  | 'arrangement' | 'cleanliness' | 'future' | 'customer_display'
  | 'staff_display' | 'training' | 'repair_works' | 'quality_assurance' | 'logs'

// Simple dated log/checklist categories -- no existing data behind them, so
// each gets a ManageLogPanel (notes + optional photo, viewable as history).
// Training gets its own richer sub-tabs (Tutorial/Laws/Assessment) instead.
const LOG_CATEGORIES: { key: ManageView; label: string; icon: string }[] = [
  { key: 'arrangement',      label: 'Arrangement',       icon: '🪑' },
  { key: 'cleanliness',      label: 'Cleanliness',       icon: '🧹' },
  { key: 'future',           label: 'Future',            icon: '🔭' },
  { key: 'customer_display', label: 'Customer Display',  icon: '🖼️' },
  { key: 'staff_display',    label: 'Staff Display',     icon: '📌' },
  { key: 'repair_works',     label: 'Repair Works',      icon: '🔧' },
  { key: 'quality_assurance', label: 'Quality Assurance', icon: '✅' },
]

// The drawer's fixed contents, top to bottom -- one flat list, no nested
// groups.
const DRAWER_ITEMS: { key: ManageView; label: string; icon?: string }[] = [
  { key: 'advert', label: 'Advert' },
  { key: 'staff_dress', label: 'Dress Code' },
  ...LOG_CATEGORIES.map(c => ({ key: c.key, label: c.label, icon: c.icon })),
  { key: 'rota', label: 'Rota' },
  { key: 'training', label: 'Training' },
  { key: 'logs', label: 'Logs' },
]

type DynamicCategory = { id: number; label: string }

// Promoted from Home's "🗂️ Grony Manage" submenu to its own top-level tab,
// mirroring Grony Cash: Cash covers the money aspect, Manage covers
// everything else (count duties, item hygiene, shift scheduling, and the
// shop's day-to-day operational checklist categories).
export default function GronyManageTab({ initialView, role, username }: { initialView?: ManageView; role: string; username: string }) {
  const [view, setView] = useState<ManageView>(initialView ?? 'advert')
  // User-added categories (see manage-categories) -- append after the fixed
  // ones in the drawer. Selecting one is a separate mode from `view` above
  // (null = a fixed category is active) rather than folding into the
  // ManageView union, since these ids are open-ended, not a fixed set.
  const [dynamicCategories, setDynamicCategories] = useState<DynamicCategory[]>([])
  const [activeDynamicId, setActiveDynamicId] = useState<number | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [showAddCategory, setShowAddCategory] = useState(false)
  const [newCategoryLabel, setNewCategoryLabel] = useState('')
  const [savingCategory, setSavingCategory] = useState(false)
  // Same gate throughout this file -- Rota's edit controls, and adding/
  // removing a category or one of its tabs, are all owner-level only.
  // Viewing is open to everyone.
  const canManage = role === 'owner' || ['joe', 'grony'].includes(username.toLowerCase())

  function loadDynamicCategories() {
    fetch('/api/manage-categories').then(r => r.ok ? r.json() : []).then(d => {
      setDynamicCategories(Array.isArray(d) ? d : [])
    }).catch(() => {})
  }
  useEffect(() => { loadDynamicCategories() }, [])

  // Driven by the global search (page.tsx) landing here already knowing
  // which sub-tab to show -- also covers re-arriving at a different one
  // while this page is already mounted, not just the first mount.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (initialView) { setView(initialView); setActiveDynamicId(null) }
  }, [initialView])

  const logCategory = LOG_CATEGORIES.find(c => c.key === view)
  const activeDynamic = dynamicCategories.find(c => c.id === activeDynamicId)
  const currentLabel = activeDynamic ? activeDynamic.label : (DRAWER_ITEMS.find(v => v.key === view)?.label ?? 'Grony Manage')

  function pick(key: ManageView) {
    setView(key)
    setActiveDynamicId(null)
    setDrawerOpen(false)
  }
  function pickDynamic(id: number) {
    setActiveDynamicId(id)
    setDrawerOpen(false)
  }

  async function addCategory(e: React.FormEvent) {
    e.preventDefault()
    if (!newCategoryLabel.trim() || savingCategory) return
    setSavingCategory(true)
    const res = await fetch('/api/manage-categories', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label: newCategoryLabel.trim() }),
    })
    setSavingCategory(false)
    if (res.ok) {
      const row = await res.json()
      setNewCategoryLabel(''); setShowAddCategory(false)
      loadDynamicCategories()
      setActiveDynamicId(row.id)
      setDrawerOpen(false)
    }
  }

  async function removeCategory(id: number, label: string) {
    if (!confirm(`Delete "${label}" and everything in it?`)) return
    await fetch(`/api/manage-categories?id=${id}`, { method: 'DELETE' }).catch(() => {})
    if (activeDynamicId === id) setActiveDynamicId(null)
    loadDynamicCategories()
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Trigger bar -- tap to open the drawer instead of scrolling a long
          horizontal tab strip. Shows which category is currently open so
          it also works as a breadcrumb. */}
      <button onClick={() => setDrawerOpen(true)}
        className="shrink-0 flex items-center gap-2 px-3 py-2.5 bg-white border-b border-gray-200 text-left hover:bg-gray-50 transition">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-500 shrink-0">
          <line x1="4" y1="6" x2="20" y2="6" />
          <line x1="4" y1="12" x2="20" y2="12" />
          <line x1="4" y1="18" x2="20" y2="18" />
        </svg>
        <span className="text-sm font-bold text-gray-900">{currentLabel}</span>
      </button>

      {/* Drawer -- slides in from the left, covers most of the screen on
          mobile. Backdrop tap (or picking a category) closes it. */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/30" onClick={() => setDrawerOpen(false)} />
          <div className="absolute left-0 top-0 h-full w-72 max-w-[80%] bg-white shadow-xl overflow-y-auto">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 sticky top-0 bg-white">
              <p className="font-bold text-gray-900">Grony Manage</p>
              <button onClick={() => setDrawerOpen(false)} aria-label="Close"
                className="text-gray-400 hover:text-gray-600 text-2xl leading-none px-1">×</button>
            </div>
            <div className="py-2">
              {DRAWER_ITEMS.map(entry => (
                <button key={entry.key} onClick={() => pick(entry.key)}
                  className={`w-full flex items-center gap-2 text-left px-4 py-2.5 text-sm font-medium transition
                    ${!activeDynamic && view === entry.key ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-gray-700 hover:bg-gray-50'}`}>
                  {entry.icon && <span>{entry.icon}</span>}{entry.label}
                </button>
              ))}

              {dynamicCategories.length > 0 && (
                <div className="mt-2 pt-2 border-t border-gray-100">
                  <p className="px-4 pb-1 text-[10px] font-bold text-gray-400 uppercase tracking-wide">Added by you</p>
                  {dynamicCategories.map(c => (
                    <div key={c.id} className="flex items-center">
                      <button onClick={() => pickDynamic(c.id)}
                        className={`flex-1 min-w-0 text-left px-4 py-2.5 text-sm font-medium truncate transition
                          ${activeDynamicId === c.id ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-gray-700 hover:bg-gray-50'}`}>
                        {c.label}
                      </button>
                      {canManage && (
                        <button onClick={() => removeCategory(c.id, c.label)} title="Delete category"
                          className="shrink-0 px-3 text-gray-300 hover:text-red-500 font-bold">×</button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {canManage && (
                <div className="mt-2 pt-2 border-t border-gray-100 px-4">
                  {showAddCategory ? (
                    <form onSubmit={addCategory} className="space-y-1.5 py-1.5">
                      <input autoFocus value={newCategoryLabel} onChange={e => setNewCategoryLabel(e.target.value)}
                        placeholder="Category name *"
                        className="w-full text-xs bg-gray-50 border border-gray-300 rounded px-2 py-1.5 outline-none focus:ring-1 focus:ring-blue-400" />
                      <div className="flex items-center gap-1.5">
                        <button type="submit" disabled={savingCategory || !newCategoryLabel.trim()}
                          className="flex-1 text-xs font-semibold px-3 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 transition">
                          {savingCategory ? 'Saving…' : 'Add'}
                        </button>
                        <button type="button" onClick={() => { setShowAddCategory(false); setNewCategoryLabel('') }}
                          className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 transition">
                          Cancel
                        </button>
                      </div>
                    </form>
                  ) : (
                    <button onClick={() => setShowAddCategory(true)}
                      className="w-full text-left py-2.5 text-sm font-semibold text-blue-600 hover:bg-blue-50 rounded-lg transition">
                      + Add Category
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 min-h-0 overflow-y-auto">
        {activeDynamic ? (
          <DynamicCategoryPage categoryId={activeDynamic.id} categoryLabel={activeDynamic.label} canManage={canManage} />
        ) : (<>
          {view === 'rota' && <div className="px-2"><RotaTab canManage={canManage} /></div>}
          {view === 'advert' && <AdvertTab />}
          {view === 'staff_dress' && <ClosingReportLogView field="no_tshirt_staff" label="Dress Code" icon="👕" />}
          {view === 'training' && <TrainingTab />}
          {view === 'logs' && <div className="px-2"><LogsPage /></div>}
          {logCategory && <ManageLogPanel category={logCategory.key} label={logCategory.label} icon={logCategory.icon} />}
        </>)}
      </div>
    </div>
  )
}
